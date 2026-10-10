import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../app';
import { User } from '../models/User';
import { OtpToken } from '../models/OtpToken';
import { sendOtpEmail } from '../services/mail';
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
