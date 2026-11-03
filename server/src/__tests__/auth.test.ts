import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../app';
import { User } from '../models/User';
import { OtpToken } from '../models/OtpToken';
import { Notification } from '../models/Notification';
import { sendOtpEmail } from '../services/mail';
import { notifySellerReview } from '../services/notifications';
import bcrypt from 'bcryptjs';

jest.mock('../services/mail', () => ({ sendOtpEmail: jest.fn().mockResolvedValue(undefined) }));

const sendOtp = jest.mocked(sendOtpEmail);
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), OtpToken.init()]);
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
  sendOtp.mockClear();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function register(email = 'samarth.patil24@pccoepune.org') {
  return request(app).post('/api/auth/register').send({
    name: 'Samarth Patil',
    email,
    password: 'a-strong-password',
    confirmPassword: 'a-strong-password',
  });
}

describe('college email registration and verification', () => {
  it('updates profile and notification preferences, manages an avatar, and changes password safely', async () => {
    await register();
    const verification = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'samarth.patil24@pccoepune.org', code: sendOtp.mock.calls[0][1] });
    const verificationCookieHeader = verification.headers['set-cookie'];
    const cookies = Array.isArray(verificationCookieHeader)
      ? verificationCookieHeader
      : [verificationCookieHeader].filter((value): value is string => typeof value === 'string');

    const profile = await request(app).patch('/api/me/profile').set('Cookie', cookies).send({
      name: 'Samarth P.',
      department: 'Computer Engineering',
      graduationYear: 2027,
      bio: 'PCCOE student',
      phone: '9876543210',
    });
    expect(profile.status).toBe(200);
    expect(profile.body.user).toMatchObject({
      name: 'Samarth P.',
      email: 'samarth.patil24@pccoepune.org',
      department: 'Computer Engineering',
      graduationYear: 2027,
      bio: 'PCCOE student',
      phone: '9876543210',
    });

    const emailEdit = await request(app)
      .patch('/api/me/profile')
      .set('Cookie', cookies)
      .send({ email: 'different.student@pccoepune.org' });
    expect(emailEdit.status).toBe(400);

    const preferences = {
      orderUpdates: true,
      marketplaceUpdates: false,
      reviewUpdates: false,
      accountUpdates: true,
    };
    const savedPreferences = await request(app)
      .put('/api/me/notification-preferences')
      .set('Cookie', cookies)
      .send(preferences);
    expect(savedPreferences.status).toBe(200);
    expect(savedPreferences.body.preferences).toEqual(preferences);
    expect(
      (await request(app).get('/api/me/notification-preferences').set('Cookie', cookies)).body
        .preferences,
    ).toEqual(preferences);

    const user = await User.findOne({ email: 'samarth.patil24@pccoepune.org' });
    if (!user) throw new Error('Expected the verified test user to exist.');
    await notifySellerReview({
      sellerId: user._id,
      rating: 5,
      orderId: new mongoose.Types.ObjectId(),
    });
    expect(await Notification.countDocuments({ recipientId: user._id })).toBe(0);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const uploadedAvatar = await request(app)
      .post('/api/me/avatar')
      .set('Cookie', cookies)
      .attach('avatar', png, { filename: 'profile.png', contentType: 'image/png' });
    expect(uploadedAvatar.status).toBe(200);
    expect(uploadedAvatar.body.user.avatarUrl).toContain('/api/me/avatar?v=');
    const avatar = await request(app).get('/api/me/avatar').set('Cookie', cookies);
    expect(avatar.status).toBe(200);
    expect(avatar.headers['content-type']).toContain('image/png');
    expect(
      (await request(app).delete('/api/me/avatar').set('Cookie', cookies)).body.user.avatarUrl,
    ).toBeNull();

    const wrongPassword = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookies)
      .send({ currentPassword: 'wrong-password', newPassword: 'another-strong-password' });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.error.code).toBe('CURRENT_PASSWORD_INCORRECT');

    const changedPassword = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookies)
      .send({ currentPassword: 'a-strong-password', newPassword: 'another-strong-password' });
    expect(changedPassword.status).toBe(200);
    const rotatedCookieHeader = changedPassword.headers['set-cookie'];
    const rotatedCookies = Array.isArray(rotatedCookieHeader)
      ? rotatedCookieHeader
      : [rotatedCookieHeader].filter((value): value is string => typeof value === 'string');
    expect((await request(app).get('/api/auth/me').set('Cookie', cookies)).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', rotatedCookies)).status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'samarth.patil24@pccoepune.org', password: 'another-strong-password' })
      ).status,
    ).toBe(200);
  }, 30_000);

  it('registers a college email, verifies the OTP and sets HttpOnly session cookies', async () => {
    const registration = await register('SAMARTH.Patil24@PCCOEPUNE.ORG');
    expect(registration.status).toBe(201);
    expect(registration.body).toEqual({
      status: 'VERIFICATION_REQUIRED',
      resendAvailableInSec: 30,
    });
    expect(sendOtp).toHaveBeenCalledTimes(1);

    const code = sendOtp.mock.calls[0][1];
    const verification = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'samarth.patil24@pccoepune.org', code });
    expect(verification.status).toBe(200);
    expect(verification.body.user.email).toBe('samarth.patil24@pccoepune.org');
    expect(verification.body.accessToken).toBeUndefined();
    const cookieHeader = verification.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeader)
      ? cookieHeader
      : [cookieHeader].filter((value): value is string => typeof value === 'string');
    expect(
      cookies.some((cookie) => cookie.startsWith('accessToken=') && cookie.includes('HttpOnly')),
    ).toBe(true);
    expect(
      cookies.some((cookie) => cookie.startsWith('refreshToken=') && cookie.includes('HttpOnly')),
    ).toBe(true);

    const session = await request(app).get('/api/auth/me').set('Cookie', cookies);
    expect(session.status).toBe(200);
    expect(session.body.user.email).toBe('samarth.patil24@pccoepune.org');
    expect(session.body.badgeCounts).toEqual({ buy: 0, sell: 0 });

    const mode = await request(app)
      .patch('/api/me/mode')
      .set('Cookie', cookies)
      .send({ mode: 'SELL' });
    expect(mode.status).toBe(200);
    expect(mode.body.lastActiveMode).toBe('SELL');
    const onboarding = await request(app)
      .post('/api/me/seller-onboarding')
      .set('Cookie', cookies)
      .send({
        campusLocation: { type: 'Point', coordinates: [73.76, 18.65] },
        pickupPreference: 'ON_CAMPUS',
      });
    expect(onboarding.status).toBe(200);
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', cookies)).body.user.sellerOnboardedAt,
    ).toBeTruthy();
  });

  it.each([
    ['x@gmail.com', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    ['x@mail.pccoepune.org', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    ['x@pccoepune.org.evil.com', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    ['x+shop@pccoepune.org', 'EMAIL_ALIAS_NOT_ALLOWED'],
  ])('rejects %s without sending an email', async (email, code) => {
    const response = await register(email);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(code);
    expect(sendOtp).not.toHaveBeenCalled();
    expect(await User.countDocuments()).toBe(0);
  });

  it('allows five incorrect codes, invalidates the code, and blocks later verification', async () => {
    await register();
    const correctCode = sendOtp.mock.calls[0][1];
    const wrongCode = correctCode === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'samarth.patil24@pccoepune.org', code: wrongCode });
      expect(response.status).toBe(400);
    }

    const response = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'samarth.patil24@pccoepune.org', code: correctCode });
    expect(response.status).toBe(400);
    expect(
      (await User.findOne({ email: 'samarth.patil24@pccoepune.org' }))?.emailVerifiedAt,
    ).toBeNull();
  });

  it('rejects expired and already-used codes', async () => {
    await register();
    const code = sendOtp.mock.calls[0][1];
    await OtpToken.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'samarth.patil24@pccoepune.org', code });
    expect(expired.status).toBe(400);

    await OtpToken.deleteMany({});
    await register('another.student24@pccoepune.org');
    const nextCode = sendOtp.mock.calls.at(-1)?.[1];
    const firstUse = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'another.student24@pccoepune.org', code: nextCode });
    const secondUse = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'another.student24@pccoepune.org', code: nextCode });
    expect(firstUse.status).toBe(200);
    expect(secondUse.status).toBe(400);
  });

  it('enforces resend cooldowns and the five-codes-per-hour email cap', async () => {
    await register();
    const cooldown = await request(app)
      .post('/api/auth/resend-otp')
      .send({ email: 'samarth.patil24@pccoepune.org', purpose: 'VERIFY_EMAIL' });
    expect(cooldown.status).toBe(429);
    expect(cooldown.body.error.code).toBe('OTP_RESEND_COOLDOWN');
    expect(sendOtp).toHaveBeenCalledTimes(1);

    await OtpToken.deleteMany({});
    const oldEnough = new Date(Date.now() - 35_000);
    await OtpToken.create(
      Array.from({ length: 5 }, () => ({
        emailNormalized: 'samarth.patil24@pccoepune.org',
        purpose: 'VERIFY_EMAIL',
        codeHash: '0'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: oldEnough,
      })),
    );
    const hourlyLimit = await request(app)
      .post('/api/auth/resend-otp')
      .send({ email: 'samarth.patil24@pccoepune.org', purpose: 'VERIFY_EMAIL' });
    expect(hourlyLimit.status).toBe(429);
    expect(hourlyLimit.body.error.code).toBe('OTP_RATE_LIMITED');
    expect(sendOtp).toHaveBeenCalledTimes(1);
  });

  it('logs in only after verification and rotates the cookie-backed session', async () => {
    await register();
    const loginBeforeVerify = await request(app)
      .post('/api/auth/login')
      .send({ email: 'samarth.patil24@pccoepune.org', password: 'a-strong-password' });
    expect(loginBeforeVerify.status).toBe(403);
    expect(loginBeforeVerify.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const code = sendOtp.mock.calls[0][1];
    const verified = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'samarth.patil24@pccoepune.org', code });
    expect(verified.status).toBe(200);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'samarth.patil24@pccoepune.org', password: 'a-strong-password' });
    expect(login.status).toBe(200);

    const loginCookies = login.headers['set-cookie'];
    const refreshCookie = (Array.isArray(loginCookies) ? loginCookies : [loginCookies]).find(
      (cookie) => typeof cookie === 'string' && cookie.startsWith('refreshToken='),
    );
    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie ?? '');
    expect(refresh.status).toBe(200);
    expect(refresh.headers['set-cookie']).toBeDefined();

    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie ?? '');
    expect(replay.status).toBe(401);

    const logoutCookies = refresh.headers['set-cookie'];
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', Array.isArray(logoutCookies) ? logoutCookies : [logoutCookies]);
    expect(logout.status).toBe(200);
    const rotatedRefreshCookie = (
      Array.isArray(logoutCookies) ? logoutCookies : [logoutCookies]
    ).find((cookie) => typeof cookie === 'string' && cookie.startsWith('refreshToken='));
    const loggedOutRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', rotatedRefreshCookie ?? '');
    expect(loggedOutRefresh.status).toBe(401);
  });

  it('blocks suspended users and revokes their sessions', async () => {
    const passwordHash = await bcrypt.hash('a-strong-password', 10);
    const user = await User.create({
      name: 'Samarth Patil',
      email: 'samarth.patil24@pccoepune.org',
      passwordHash,
      emailVerifiedAt: new Date(),
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'a-strong-password' });
    const accessCookies = login.headers['set-cookie'];
    const cookies = Array.isArray(accessCookies) ? accessCookies : [accessCookies];

    await User.updateOne({ _id: user._id }, { $set: { isSuspended: true } });
    const me = await request(app).get('/api/auth/me').set('Cookie', cookies);
    expect(me.status).toBe(401);
    const suspendedLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'a-strong-password' });
    expect(suspendedLogin.status).toBe(403);
    expect(suspendedLogin.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});
