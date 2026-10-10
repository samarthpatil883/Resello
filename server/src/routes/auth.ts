import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { Mode, OtpPurpose, PickupPreference } from '@resello/shared';
import { env } from '../config/env';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, getAuthenticatedUser, HttpError } from '../middleware/errors';
import { User, type UserDocument } from '../models/User';
import { createAndSendOtp, verifyOtp } from '../services/otp';
import { normalizeCollegeEmail } from '../validators/collegeEmail';

const router = Router();
const emailSchema = z.string().email();
function createAuthRateLimit() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'OTP_IP_RATE_LIMITED', message: 'Too many requests. Try again later.' },
      });
    },
  });
}

const authRateLimit = createAuthRateLimit();
const otpIssueRateLimit = createAuthRateLimit();

function publicUser(user: UserDocument) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    lastActiveMode: user.lastActiveMode,
    sellerOnboardedAt: user.sellerOnboardedAt?.toISOString() ?? null,
    campusLocation: user.campusLocation,
    pickupPreference: user.pickupPreference,
    phone: user.phone,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function cookieOptions(maxAge: number, path: string) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path,
    maxAge,
  };
}

async function issueSession(user: UserDocument, res: Response) {
  const accessToken = jwt.sign(
    { sub: user._id.toString(), ver: user.authVersion, jti: randomUUID() },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' },
  );
  const refreshToken = jwt.sign(
    { sub: user._id.toString(), ver: user.authVersion, jti: randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' },
  );
  const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
  await User.updateOne({ _id: user._id }, { $set: { refreshTokenHash } });
  res.cookie('accessToken', accessToken, cookieOptions(15 * 60 * 1000, '/api'));
  res.cookie('refreshToken', refreshToken, cookieOptions(30 * 24 * 60 * 60 * 1000, '/api/auth'));
}

function tokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const resendSchema = z.object({
  email: emailSchema,
  purpose: z.nativeEnum(OtpPurpose).default(OtpPurpose.VERIFY_EMAIL),
});

router.post(
  '/auth/register',
  otpIssueRateLimit,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: emailSchema,
        password: z.string().min(10).max(128),
        confirmPassword: z.string(),
      })
      .parse(req.body);

    if (body.password !== body.confirmPassword) {
      throw new HttpError(400, 'PASSWORDS_DO_NOT_MATCH', 'Passwords do not match.');
    }

    const email = normalizeCollegeEmail(body.email, env.ALLOWED_EMAIL_DOMAINS);
    const existing = await User.findOne({ email });

    if (existing?.emailVerifiedAt) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'This email is already registered. Log in instead.');
    }

    if (existing?.isSuspended) {
      throw new HttpError(
        403,
        'ACCOUNT_SUSPENDED',
        'Your account has been suspended. Contact the Resello admin.',
      );
    }

    if (!existing) {
      const passwordHash = await bcrypt.hash(body.password, 12);
      await User.create({ name: body.name, email, passwordHash });
    } else {
      const passwordHash = await bcrypt.hash(body.password, 12);
      await User.updateOne({ _id: existing._id }, { $set: { name: body.name, passwordHash } });
    }

    const { resendAvailableInSec } = await createAndSendOtp(email, OtpPurpose.VERIFY_EMAIL);
    res.status(201).json({ status: 'VERIFICATION_REQUIRED', resendAvailableInSec });
  }),
);

router.post(
  '/auth/verify-email',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) })
      .parse(req.body);
    const email = normalizeCollegeEmail(body.email, env.ALLOWED_EMAIL_DOMAINS);
    const user = await User.findOne({ email }).select('+authVersion');

    if (!user) throw new HttpError(400, 'OTP_INVALID', 'That code is not right or has expired.');
    if (user.isSuspended)
      throw new HttpError(
        403,
        'ACCOUNT_SUSPENDED',
        'Your account has been suspended. Contact the Resello admin.',
      );
    if (user.emailVerifiedAt)
      throw new HttpError(
        400,
        'OTP_ALREADY_USED',
        'This account is already verified. Please log in.',
      );

    const valid = await verifyOtp(email, OtpPurpose.VERIFY_EMAIL, body.code);
    if (!valid) throw new HttpError(400, 'OTP_INVALID', 'That code is not right or has expired.');

    user.emailVerifiedAt = new Date();
    await user.save();
    await issueSession(user, res);
    res.json({ user: publicUser(user) });
  }),
);

router.post(
  '/auth/resend-otp',
  otpIssueRateLimit,
  asyncHandler(async (req, res) => {
    const body = resendSchema.parse(req.body);
    const email = normalizeCollegeEmail(body.email, env.ALLOWED_EMAIL_DOMAINS);
    const user = await User.findOne({ email });

    if (body.purpose === OtpPurpose.VERIFY_EMAIL && (!user || user.emailVerifiedAt)) {
      throw new HttpError(
        400,
        'OTP_UNAVAILABLE',
        'A verification code is not available for this account.',
      );
    }
    if (
      body.purpose === OtpPurpose.RESET_PASSWORD &&
      (!user?.emailVerifiedAt || user.isSuspended)
    ) {
      throw new HttpError(
        400,
        'OTP_UNAVAILABLE',
        'A password reset code is not available for this account.',
      );
    }

    res.json(await createAndSendOtp(email, body.purpose));
  }),
);

router.post(
  '/auth/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ email: emailSchema, password: z.string().min(1).max(128) })
      .parse(req.body);
    const email = normalizeCollegeEmail(body.email, env.ALLOWED_EMAIL_DOMAINS);
    const user = await User.findOne({ email }).select('+passwordHash +authVersion');
    if (!user) {
      await bcrypt.hash(body.password, 12);
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordValid)
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    if (user.isSuspended)
      throw new HttpError(
        403,
        'ACCOUNT_SUSPENDED',
        'Your account has been suspended. Contact the Resello admin.',
      );
    if (!user.emailVerifiedAt)
      throw new HttpError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Please verify your college email to continue.',
      );

    await issueSession(user, res);
    res.json({ user: publicUser(user) });
  }),
);

router.post(
  '/auth/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) throw new HttpError(401, 'INVALID_SESSION', 'Please log in again.');

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      throw new HttpError(401, 'INVALID_SESSION', 'Please log in again.');
    }

    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') {
      throw new HttpError(401, 'INVALID_SESSION', 'Please log in again.');
    }

    const user = await User.findById(payload.sub).select('+authVersion +refreshTokenHash');
    if (
      !user ||
      user.authVersion !== payload.ver ||
      user.isSuspended ||
      !user.emailVerifiedAt ||
      !user.refreshTokenHash ||
      !tokenMatches(token, user.refreshTokenHash)
    ) {
      throw new HttpError(401, 'INVALID_SESSION', 'Please log in again.');
    }

    await issueSession(user, res);
    res.json({ user: publicUser(user) });
  }),
);

router.post(
  '/auth/logout',
  asyncHandler(async (req, res) => {
    const sessionTokens = [
      { value: req.cookies?.accessToken as string | undefined, secret: env.JWT_ACCESS_SECRET },
      { value: req.cookies?.refreshToken as string | undefined, secret: env.JWT_REFRESH_SECRET },
    ];
    for (const sessionToken of sessionTokens) {
      if (!sessionToken.value) continue;
      try {
        const payload = jwt.verify(sessionToken.value, sessionToken.secret) as JwtPayload;
        if (typeof payload.sub === 'string') {
          await User.updateOne(
            { _id: payload.sub },
            { $inc: { authVersion: 1 }, $unset: { refreshTokenHash: 1 } },
          );
          break;
        }
      } catch {
        continue;
      }
    }

    res.clearCookie('accessToken', cookieOptions(0, '/api'));
    res.clearCookie('refreshToken', cookieOptions(0, '/api/auth'));
    res.json({ status: 'ok' });
  }),
);

router.post(
  '/auth/forgot-password',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = z.object({ email: emailSchema }).parse(req.body);
    const email = normalizeCollegeEmail(body.email, env.ALLOWED_EMAIL_DOMAINS);
    const user = await User.findOne({ email });
    if (user?.emailVerifiedAt && !user.isSuspended) {
      await createAndSendOtp(email, OtpPurpose.RESET_PASSWORD);
    }
    res.json({ message: 'If a verified account exists, a reset code has been sent.' });
  }),
);

router.post(
  '/auth/reset-password',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: emailSchema,
        code: z.string().regex(/^\d{6}$/),
        newPassword: z.string().min(10).max(128),
      })
      .parse(req.body);
    const email = normalizeCollegeEmail(body.email, env.ALLOWED_EMAIL_DOMAINS);
    const user = await User.findOne({ email }).select('+authVersion');
    if (!user || !user.emailVerifiedAt || user.isSuspended) {
      throw new HttpError(400, 'OTP_INVALID', 'That code is not right or has expired.');
    }
    if (!(await verifyOtp(email, OtpPurpose.RESET_PASSWORD, body.code))) {
      throw new HttpError(400, 'OTP_INVALID', 'That code is not right or has expired.');
    }

    user.passwordHash = await bcrypt.hash(body.newPassword, 12);
    user.authVersion += 1;
    user.refreshTokenHash = null;
    await user.save();
    res.json({ message: 'Password reset successfully. Please log in.' });
  }),
);

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(getAuthenticatedUser(req)), badgeCounts: { buy: 0, sell: 0 } });
});

router.patch(
  '/me/mode',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { mode } = z.object({ mode: z.nativeEnum(Mode) }).parse(req.body);
    const user = getAuthenticatedUser(req);
    user.lastActiveMode = mode;
    await user.save();
    res.json({ lastActiveMode: mode });
  }),
);

router.get('/me/badges', requireAuth, (_req, res) => {
  res.json({ buy: 0, sell: 0 });
});

router.post(
  '/me/seller-onboarding',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        campusLocation: z.object({
          type: z.literal('Point'),
          coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
        }),
        pickupPreference: z.nativeEnum(PickupPreference),
        phone: z.string().max(30).optional(),
      })
      .parse(req.body);

    const user = getAuthenticatedUser(req);
    user.campusLocation = body.campusLocation;
    user.pickupPreference = body.pickupPreference;
    user.phone = body.phone ?? null;
    user.sellerOnboardedAt = new Date();
    await user.save();
    res.json({ sellerOnboardedAt: user.sellerOnboardedAt.toISOString() });
  }),
);

export { router as authRouter };
