import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OtpPurpose } from '@resello/shared';
import { env } from '../config/env';
import { OtpToken } from '../models/OtpToken';
import { sendOtpEmail } from './mail';

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const HOURLY_EMAIL_LIMIT = 5;
const MAX_ATTEMPTS = 5;

export class OtpRequestError extends Error {
  constructor(
    public readonly code: 'OTP_RESEND_COOLDOWN' | 'OTP_RATE_LIMITED',
    message: string,
    public readonly status: number,
    public readonly retryAfterSec = 0,
  ) {
    super(message);
    this.name = 'OtpRequestError';
  }
}

function hashCode(email: string, code: string): string {
  return createHmac('sha256', env.OTP_SECRET).update(`${email}:${code}`).digest('hex');
}

export async function createAndSendOtp(email: string, purpose: OtpPurpose) {
  const now = new Date();
  const previous = await OtpToken.findOne({ emailNormalized: email, purpose }).sort({
    createdAt: -1,
  });

  if (previous && previous.createdAt.getTime() + RESEND_COOLDOWN_MS > now.getTime()) {
    const retryAfterSec = Math.ceil(
      (previous.createdAt.getTime() + RESEND_COOLDOWN_MS - now.getTime()) / 1000,
    );
    throw new OtpRequestError(
      'OTP_RESEND_COOLDOWN',
      'Please wait before requesting another code.',
      429,
      retryAfterSec,
    );
  }

  const hourlyCount = await OtpToken.countDocuments({
    emailNormalized: email,
    createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) },
  });

  if (hourlyCount >= HOURLY_EMAIL_LIMIT) {
    throw new OtpRequestError(
      'OTP_RATE_LIMITED',
      'Too many codes requested. Try again in an hour.',
      429,
      3600,
    );
  }

  await OtpToken.updateMany(
    { emailNormalized: email, purpose, consumedAt: null },
    { $set: { consumedAt: now } },
  );

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await OtpToken.create({
    emailNormalized: email,
    purpose,
    codeHash: hashCode(email, code),
    expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
  });
  await sendOtpEmail(email, code, purpose);

  return { resendAvailableInSec: RESEND_COOLDOWN_MS / 1000 };
}

export async function verifyOtp(email: string, purpose: OtpPurpose, code: string) {
  const now = new Date();
  const token = await OtpToken.findOne({
    emailNormalized: email,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: MAX_ATTEMPTS },
  }).sort({ createdAt: -1 });

  if (!token) return false;

  const actual = Buffer.from(hashCode(email, code), 'hex');
  const expected = Buffer.from(token.codeHash, 'hex');
  const matches = actual.length === expected.length && timingSafeEqual(actual, expected);

  if (!matches) {
    const update = await OtpToken.findOneAndUpdate(
      { _id: token._id, consumedAt: null, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (update && (update.attempts ?? 0) >= MAX_ATTEMPTS) {
      await OtpToken.updateOne(
        { _id: update._id, consumedAt: null },
        { $set: { consumedAt: now } },
      );
    }
    return false;
  }

  const consumed = await OtpToken.findOneAndUpdate(
    { _id: token._id, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } },
    { $set: { consumedAt: now } },
    { new: true },
  );

  return consumed !== null;
}
