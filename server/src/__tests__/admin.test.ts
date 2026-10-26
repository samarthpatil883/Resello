import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Mode, UserRole } from '@resello/shared';
import { app } from '../app';
import { env } from '../config/env';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { Item } from '../models/Item';
import { Notification } from '../models/Notification';
import { Order } from '../models/Order';
import { Review } from '../models/Review';
import { User } from '../models/User';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function createAccount(role: UserRole = UserRole.STUDENT) {
  const user = await User.create({
    name: role === UserRole.ADMIN ? 'Resello Admin' : 'Campus Student',
    email: `${role.toLowerCase()}.${new mongoose.Types.ObjectId().toString()}@pccoepune.org`,
    passwordHash: await bcrypt.hash('test-admin-password', 10),
    role,
    emailVerifiedAt: new Date(),
    isSuspended: false,
    authVersion: 0,
    lastActiveMode: Mode.BUY,
  });
  const token = jwt.sign(
    { sub: user._id.toString(), ver: user.authVersion },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' },
  );
  return { id: user._id.toString(), cookie: `accessToken=${token}`, email: user.email };
}

describe('administrator access and management API', () => {
  it('denies unauthenticated and non-admin accounts access to every admin endpoint', async () => {
    const student = await createAccount();
    const endpoints = [
      request(app).get('/api/admin/stats'),
      request(app).get('/api/admin/users'),
      request(app).get('/api/admin/listings'),
      request(app).get('/api/admin/reviews'),
      request(app).get('/api/admin/transactions'),
      request(app).get('/api/admin/activity'),
      request(app).post('/api/admin/actions/suspend-user').send({
        userId: student.id,
        reason: 'Test restriction',
      }),
    ];
    const anonymous = await request(app).get('/api/admin/stats');
    const denied = await Promise.all(
      endpoints.map((endpoint) => endpoint.set('Cookie', student.cookie)),
    );

    expect(anonymous.status).toBe(401);
    denied.forEach((response) => {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ADMIN_ACCESS_REQUIRED');
    });
  });

  it('shows dashboard stats, user activity counts, listings and transaction records only to admin', async () => {
    const admin = await createAccount(UserRole.ADMIN);
    const buyer = await createAccount();
    const seller = await createAccount();
    const activeItem = await Item.create({
      sellerId: seller.id,
      title: 'Active calculator',
      description: 'Ready for campus pickup',
      price: 500,
      status: 'ACTIVE',
      images: [],
    });
    await Item.create({
      sellerId: seller.id,
      title: 'Reserved book',
      description: 'Reserved for a buyer',
      price: 150,
      status: 'PENDING',
      images: [],
    });
    const completedOrder = await Order.create({
      buyerId: buyer.id,
      sellerId: seller.id,
      itemId: activeItem._id,
      price: 500,
      status: 'COMPLETED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING_COLLECTION',
    });

    const [stats, users, listings, transactions] = await Promise.all([
      request(app).get('/api/admin/stats').set('Cookie', admin.cookie),
      request(app).get('/api/admin/users').set('Cookie', admin.cookie),
      request(app)
        .get('/api/admin/listings')
        .query({ search: 'calculator' })
        .set('Cookie', admin.cookie),
      request(app).get('/api/admin/transactions').set('Cookie', admin.cookie),
    ]);

    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({
      users: 2,
      suspendedUsers: 0,
      activeListings: 1,
      pendingListings: 1,
      orders: 1,
      completedOrders: 1,
      revenue: 500,
    });
    expect(users.body.users).toHaveLength(2);
    expect(users.body.users.find((user: { id: string }) => user.id === seller.id)).toMatchObject({
      listingCount: 2,
      saleCount: 1,
    });
    expect(users.body.users.find((user: { id: string }) => user.id === buyer.id)).toMatchObject({
      purchaseCount: 1,
    });
    expect(listings.body.listings).toHaveLength(1);
    expect(listings.body.listings[0].seller).toMatchObject({ email: seller.email });
    expect(transactions.body.transactions).toHaveLength(1);
    expect(transactions.body.transactions[0]).toMatchObject({
      id: completedOrder._id.toString(),
      buyer: { email: buyer.email },
      seller: { email: seller.email },
      amount: 500,
      status: 'COMPLETED',
    });
  });

  it('lets administrators inspect seller ratings and reviews with seller search and pagination', async () => {
    const admin = await createAccount(UserRole.ADMIN);
    const reviewer = await createAccount();
    const seller = await createAccount();
    const item = await Item.create({
      sellerId: seller.id,
      title: 'Reviewed campus calculator',
      description: 'Working condition',
      price: 450,
      status: 'SOLD',
      images: [],
    });
    const order = await Order.create({
      buyerId: reviewer.id,
      sellerId: seller.id,
      itemId: item._id,
      price: 450,
      status: 'COMPLETED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING_COLLECTION',
    });
    await Review.create({
      orderId: order._id,
      buyerId: reviewer.id,
      sellerId: seller.id,
      rating: 5,
      comment: 'Friendly seller and the item matched the description.',
    });

    const response = await request(app)
      .get('/api/admin/reviews')
      .query({ search: seller.email, page: 1, limit: 1 })
      .set('Cookie', admin.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      totalPages: 1,
      reviews: [
        {
          orderId: order._id.toString(),
          rating: 5,
          comment: 'Friendly seller and the item matched the description.',
          seller: { name: 'Campus Student', email: seller.email },
          reviewer: { name: 'Campus Student', email: reviewer.email },
          item: 'Reviewed campus calculator',
        },
      ],
    });

    const noMatch = await request(app)
      .get('/api/admin/reviews')
      .query({ search: 'nobody@pccoepune.org' })
      .set('Cookie', admin.cookie);
    expect(noMatch.status).toBe(200);
    expect(noMatch.body).toMatchObject({ reviews: [], total: 0 });
  });

  it('audits listing actions and suspensions, revokes sessions, delists inventory, and restores access', async () => {
    const admin = await createAccount(UserRole.ADMIN);
    const student = await createAccount();
    const item = await Item.create({
      sellerId: student.id,
      title: 'Student listing',
      description: 'Listed by a student',
      price: 200,
      status: 'ACTIVE',
      images: [],
    });
    const removeResponse = await request(app)
      .post('/api/admin/actions/remove-listing')
      .set('Cookie', admin.cookie)
      .send({ listingId: item._id.toString(), reason: 'Prohibited campus item' });
    expect(removeResponse.status).toBe(200);
    expect((await Item.findById(item._id))?.status).toBe('REMOVED');
    expect(
      await Notification.findOne({
        recipientId: student.id,
        relatedId: item._id,
        type: 'LISTING_REMOVED',
      }).lean(),
    ).toMatchObject({
      mode: Mode.SELL,
      title: 'Listing removed by Resello',
    });

    const auditFeed = await request(app).get('/api/admin/activity').set('Cookie', admin.cookie);
    expect(auditFeed.body.activity).toMatchObject([
      {
        type: 'LISTING_REMOVED',
        targetType: 'LISTING',
        targetId: item._id.toString(),
        reason: 'Prohibited campus item',
      },
    ]);

    const studentItem = await Item.create({
      sellerId: student.id,
      title: 'Another student listing',
      description: 'Active item',
      price: 100,
      status: 'ACTIVE',
      images: [],
    });
    const suspendResponse = await request(app)
      .post('/api/admin/actions/suspend-user')
      .set('Cookie', admin.cookie)
      .send({ userId: student.id, reason: 'Repeated marketplace abuse' });
    expect(suspendResponse.status).toBe(200);
    const suspendedStudent = await User.findById(student.id)
      .select('+authVersion +refreshTokenHash')
      .lean();
    expect(suspendedStudent).toMatchObject({
      isSuspended: true,
      authVersion: 1,
      refreshTokenHash: null,
    });
    expect((await Item.findById(studentItem._id))?.status).toBe('REMOVED');
    expect((await request(app).get('/api/admin/stats').set('Cookie', student.cookie)).status).toBe(
      401,
    );

    const restoreResponse = await request(app)
      .post('/api/admin/actions/suspend-user')
      .set('Cookie', admin.cookie)
      .send({ userId: student.id, suspended: false, reason: 'Appeal accepted' });
    expect(restoreResponse.status).toBe(200);
    expect((await User.findById(student.id))?.isSuspended).toBe(false);
    expect((await Item.findById(studentItem._id))?.status).toBe('REMOVED');
    expect(await AdminAuditLog.countDocuments()).toBe(3);

    const selfSuspend = await request(app)
      .post('/api/admin/actions/suspend-user')
      .set('Cookie', admin.cookie)
      .send({ userId: admin.id, reason: 'Testing guard' });
    expect(selfSuspend.status).toBe(400);
    expect(selfSuspend.body.error.code).toBe('CANNOT_SUSPEND_SELF');
  });

  it('requires a reason and only removes active listings', async () => {
    const admin = await createAccount(UserRole.ADMIN);
    const seller = await createAccount();
    const reserved = await Item.create({
      sellerId: seller.id,
      title: 'Reserved listing',
      description: 'Already reserved',
      price: 300,
      status: 'PENDING',
      images: [],
    });
    const noReason = await request(app)
      .post('/api/admin/actions/remove-listing')
      .set('Cookie', admin.cookie)
      .send({ listingId: reserved._id.toString(), reason: '' });
    const reservedRemoval = await request(app)
      .post('/api/admin/actions/remove-listing')
      .set('Cookie', admin.cookie)
      .send({ listingId: reserved._id.toString(), reason: 'Reserved already' });
    expect(noReason.status).toBe(400);
    expect(reservedRemoval.status).toBe(404);
    expect((await Item.findById(reserved._id))?.status).toBe('PENDING');
  });
});
