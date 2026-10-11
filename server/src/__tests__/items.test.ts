import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../app';
import { env } from '../config/env';
import { Item } from '../models/Item';
import { Order } from '../models/Order';
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

async function createSession(onboarded = true, coordinates: [number, number] | null = null) {
  const user = await User.create({
    name: 'Samarth Patil',
    email: `samarth.${new mongoose.Types.ObjectId().toString()}@pccoepune.org`,
    passwordHash: 'unused-test-hash',
    emailVerifiedAt: new Date(),
    sellerOnboardedAt: onboarded ? new Date() : null,
    campusLocation: coordinates ? { type: 'Point', coordinates } : null,
  });
  const token = jwt.sign(
    { sub: user._id.toString(), ver: user.authVersion },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' },
  );
  return { id: user._id.toString(), cookie: `accessToken=${token}` };
}

const pngImage = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

function publishItem(
  cookie: string,
  images: Buffer[] = [pngImage],
  fields: { title?: string; price?: number; condition?: string } = {},
) {
  const upload = request(app)
    .post('/api/items')
    .set('Cookie', cookie)
    .field('title', fields.title ?? 'Engineering Mathematics')
    .field('description', 'Used textbook in good condition')
    .field('price', String(fields.price ?? 250))
    .field('condition', fields.condition ?? 'GOOD');
  images.forEach((image, index) => {
    upload.attach('images', image, { filename: `item-${index + 1}.png`, contentType: 'image/png' });
  });
  return upload;
}

function editItem(cookie: string, itemId: string, images: Buffer[] = []) {
  const update = request(app)
    .patch(`/api/items/${itemId}`)
    .set('Cookie', cookie)
    .field('title', 'Updated Mathematics Textbook')
    .field('description', 'Updated condition and details')
    .field('price', '275')
    .field('condition', 'LIKE_NEW');
  images.forEach((image, index) => {
    update.attach('images', image, {
      filename: `extra-${index + 1}.png`,
      contentType: 'image/png',
    });
  });
  return update;
}

describe('MongoDB-backed items API', () => {
  it('requires a verified session for the item feed and listing creation', async () => {
    const publish = await request(app)
      .post('/api/items')
      .field('title', 'Test item')
      .attach('image', pngImage, { filename: 'item.png', contentType: 'image/png' });
    const feed = await request(app).get('/api/items');
    const sellerStats = await request(app).get('/api/me/seller-stats');

    expect(publish.status).toBe(401);
    expect(feed.status).toBe(401);
    expect(sellerStats.status).toBe(401);
  });

  it('requires seller onboarding before accepting a listing', async () => {
    const seller = await createSession(false);
    const response = await publishItem(seller.cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('SELLER_ONBOARDING_REQUIRED');
    expect(await Item.countDocuments()).toBe(0);
  });

  it('stores a listing and its image in MongoDB for authenticated campus users', async () => {
    const seller = await createSession();
    const response = await publishItem(seller.cookie);

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      seller_id: seller.id,
      title: 'Engineering Mathematics',
      description: 'Used textbook in good condition',
      price: 250,
      image_url: `/items/${response.body.item.id}/image`,
      image_urls: [`/items/${response.body.item.id}/images/0`],
    });

    const image = await request(app).get(`/api${response.body.item.image_url}`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toMatch(/^image\/png/);
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.from(image.body).equals(pngImage)).toBe(true);

    const buyer = await createSession();
    const feed = await request(app).get('/api/items').set('Cookie', buyer.cookie);
    expect(feed.status).toBe(200);
    expect(feed.body.items).toHaveLength(1);
    expect(feed.body.items[0].id).toBe(response.body.item.id);
  });

  it('filters the buyer feed by condition, price, and new listings, then sorts by price', async () => {
    const seller = await createSession();
    const buyer = await createSession();
    await publishItem(seller.cookie, [pngImage], {
      title: 'New affordable calculator',
      price: 150,
      condition: 'NEW',
    });
    await publishItem(seller.cookie, [pngImage], {
      title: 'Good condition calculator',
      price: 500,
      condition: 'GOOD',
    });
    const priceSorted = await request(app)
      .get('/api/items')
      .query({ sort: 'price_asc' })
      .set('Cookie', buyer.cookie);
    expect(priceSorted.body.items.map((item: { price: number }) => item.price)).toEqual([150, 500]);

    await Item.collection.updateOne(
      { title: 'New affordable calculator' },
      { $set: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } },
    );

    const filtered = await request(app)
      .get('/api/items')
      .query({
        condition: 'NEW',
        maxPrice: 200,
        newOnly: 'true',
        sort: 'price_asc',
      })
      .set('Cookie', buyer.cookie);
    expect(filtered.status).toBe(200);
    expect(filtered.body.items).toEqual([]);

    await Item.collection.updateOne(
      { title: 'New affordable calculator' },
      { $set: { createdAt: new Date() } },
    );
    const result = await request(app)
      .get('/api/items')
      .query({ minPrice: 100, maxPrice: 200, condition: 'NEW', newOnly: 'true' })
      .set('Cookie', buyer.cookie);

    expect(result.status).toBe(200);
    expect(result.body.items).toHaveLength(1);
    expect(result.body.items[0]).toMatchObject({
      title: 'New affordable calculator',
      price: 150,
      condition: 'NEW',
    });
  });

  it('returns nearest listings with approximate distances and applies a radius', async () => {
    const nearSeller = await createSession(true, [73.76, 18.65]);
    const farSeller = await createSession(true, [73.81, 18.65]);
    const buyer = await createSession();
    await publishItem(nearSeller.cookie, [pngImage], { title: 'Nearby item' });
    await publishItem(farSeller.cookie, [pngImage], { title: 'Farther item' });

    const nearby = await request(app)
      .get('/api/items')
      .query({
        maxDistanceKm: 1,
        latitude: 18.65,
        longitude: 73.76,
        sort: 'nearest',
      })
      .set('Cookie', buyer.cookie);
    expect(nearby.status).toBe(200);
    expect(nearby.body.items).toHaveLength(1);
    expect(nearby.body.items[0].title).toBe('Nearby item');
    expect(nearby.body.items[0].distance_km).toBeLessThan(1);

    const sorted = await request(app)
      .get('/api/items')
      .query({ latitude: 18.65, longitude: 73.76, sort: 'nearest' })
      .set('Cookie', buyer.cookie);
    expect(sorted.body.items.map((item: { title: string }) => item.title)).toEqual([
      'Nearby item',
      'Farther item',
    ]);
  });

  it('rejects inverted price ranges and incomplete location coordinates', async () => {
    const buyer = await createSession();
    const invertedPrices = await request(app)
      .get('/api/items')
      .query({ minPrice: 500, maxPrice: 100 })
      .set('Cookie', buyer.cookie);
    const incompleteLocation = await request(app)
      .get('/api/items')
      .query({ maxDistanceKm: 5, latitude: 18.65 })
      .set('Cookie', buyer.cookie);

    expect(invertedPrices.status).toBe(400);
    expect(incompleteLocation.status).toBe(400);
  });

  it('stores multiple photos in upload order and serves each image publicly', async () => {
    const seller = await createSession();
    const secondImage = Buffer.concat([pngImage, Buffer.from([0x42])]);
    const listing = await publishItem(seller.cookie, [pngImage, secondImage]);

    expect(listing.status).toBe(201);
    expect(listing.body.item.image_urls).toEqual([
      `/items/${listing.body.item.id}/images/0`,
      `/items/${listing.body.item.id}/images/1`,
    ]);

    const first = await request(app).get(`/api${listing.body.item.image_urls[0]}`);
    const second = await request(app).get(`/api${listing.body.item.image_urls[1]}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.from(first.body).equals(pngImage)).toBe(true);
    expect(Buffer.from(second.body).equals(secondImage)).toBe(true);
  });

  it('rejects more than five photos in one listing', async () => {
    const seller = await createSession();
    const response = await publishItem(
      seller.cookie,
      Array.from({ length: 6 }, () => pngImage),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TOO_MANY_IMAGES');
    expect(await Item.countDocuments()).toBe(0);
  });

  it('rejects photo uploads exceeding the combined size limit', async () => {
    const seller = await createSession();
    const largeImages = Array.from({ length: 4 }, () => {
      const image = Buffer.alloc(4 * 1024 * 1024);
      pngImage.copy(image);
      return image;
    });
    const response = await publishItem(seller.cookie, largeImages);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('TOTAL_IMAGE_SIZE_EXCEEDED');
    expect(await Item.countDocuments()).toBe(0);
  });

  it('continues to serve legacy listings that only have one stored image', async () => {
    const seller = await createSession();
    const legacy = await Item.create({
      sellerId: seller.id,
      title: 'Old single-photo item',
      description: 'Existing record',
      price: 50,
      imageData: pngImage,
      imageContentType: 'image/png',
    });
    const details = await request(app)
      .get(`/api/items/${legacy.id}`)
      .set('Cookie', (await createSession()).cookie);

    expect(details.body.item.image_urls).toEqual([`/items/${legacy.id}/images/0`]);
    const image = await request(app).get(`/api/items/${legacy.id}/images/0`);
    expect(image.status).toBe(200);
    expect(Buffer.from(image.body).equals(pngImage)).toBe(true);
  });

  it('does not show a seller their own listings', async () => {
    const seller = await createSession();
    await publishItem(seller.cookie);

    const response = await request(app).get('/api/items').set('Cookie', seller.cookie);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it('returns live owner-scoped seller dashboard counts', async () => {
    const seller = await createSession();
    const buyer = await createSession();
    const anotherSeller = await createSession();
    await publishItem(seller.cookie);
    const reserved = await publishItem(seller.cookie);
    const completed = await publishItem(seller.cookie);
    const otherSellerListing = await publishItem(anotherSeller.cookie);
    await Item.findByIdAndUpdate(reserved.body.item.id, { $set: { status: 'PENDING' } });
    await Item.findByIdAndUpdate(completed.body.item.id, { $set: { status: 'SOLD' } });

    await Order.create({
      buyerId: buyer.id,
      sellerId: seller.id,
      itemId: reserved.body.item.id,
      price: 250,
      status: 'PLACED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING_COLLECTION',
      deliveryNotes: '',
    });
    await Order.create({
      buyerId: buyer.id,
      sellerId: seller.id,
      itemId: completed.body.item.id,
      price: 275,
      status: 'COMPLETED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING_COLLECTION',
      deliveryNotes: '',
    });
    await Order.create({
      buyerId: seller.id,
      sellerId: anotherSeller.id,
      itemId: otherSellerListing.body.item.id,
      price: 100,
      status: 'PLACED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING_COLLECTION',
      deliveryNotes: '',
    });

    const response = await request(app).get('/api/me/seller-stats').set('Cookie', seller.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      activeListings: 1,
      needsYourAction: 1,
      completedSales: 1,
      averageRating: null,
      ratingCount: 0,
    });
    expect(response.body.activeListings).toBeGreaterThan(0);
    expect(response.body.activeListings).toBe(
      await Item.countDocuments({ sellerId: seller.id, status: 'ACTIVE' }),
    );
  });

  it('returns all statuses of only the authenticated seller listings', async () => {
    const seller = await createSession();
    const otherSeller = await createSession();
    const active = await publishItem(seller.cookie);
    const sold = await publishItem(seller.cookie);
    await Item.findByIdAndUpdate(sold.body.item.id, { $set: { status: 'SOLD' } });
    await publishItem(otherSeller.cookie);

    const response = await request(app).get('/api/items/mine').set('Cookie', seller.cookie);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([active.body.item.id, sold.body.item.id]),
    );
    expect(
      response.body.items.find((item: { id: string }) => item.id === sold.body.item.id).status,
    ).toBe('SOLD');
  });

  it('allows the owner to edit listing details and add more photos', async () => {
    const seller = await createSession();
    const listing = await publishItem(seller.cookie);
    const secondImage = Buffer.concat([pngImage, Buffer.from([0x42])]);

    const updated = await editItem(seller.cookie, listing.body.item.id, [secondImage]);

    expect(updated.status).toBe(200);
    expect(updated.body.item).toMatchObject({
      id: listing.body.item.id,
      title: 'Updated Mathematics Textbook',
      description: 'Updated condition and details',
      price: 275,
      image_urls: [
        `/items/${listing.body.item.id}/images/0`,
        `/items/${listing.body.item.id}/images/1`,
      ],
    });
    const newImage = await request(app).get(`/api${updated.body.item.image_urls[1]}`);
    expect(newImage.status).toBe(200);
    expect(Buffer.from(newImage.body).equals(secondImage)).toBe(true);
  });

  it('prevents a different seller from editing or retrieving another seller listings', async () => {
    const owner = await createSession();
    const otherSeller = await createSession();
    const listing = await publishItem(owner.cookie);

    const [editResponse, listingsResponse] = await Promise.all([
      editItem(otherSeller.cookie, listing.body.item.id),
      request(app).get('/api/items/mine').set('Cookie', otherSeller.cookie),
    ]);

    expect(editResponse.status).toBe(404);
    expect(editResponse.body.error.code).toBe('ITEM_NOT_FOUND');
    expect(listingsResponse.body.items).toEqual([]);
  });

  it('does not allow editing reserved listings', async () => {
    const seller = await createSession();
    const listing = await publishItem(seller.cookie);
    await Item.findByIdAndUpdate(listing.body.item.id, { $set: { status: 'PENDING' } });

    const response = await editItem(seller.cookie, listing.body.item.id);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ITEM_NOT_EDITABLE');
  });

  it('rejects image additions that exceed the five-photo and 15 MiB listing limits', async () => {
    const seller = await createSession();
    const listing = await publishItem(seller.cookie);
    const tooMany = await editItem(
      seller.cookie,
      listing.body.item.id,
      Array.from({ length: 5 }, () => pngImage),
    );

    const largeImages = Array.from({ length: 3 }, () => {
      const image = Buffer.alloc(5 * 1024 * 1024);
      pngImage.copy(image);
      return image;
    });
    const tooLarge = await editItem(seller.cookie, listing.body.item.id, largeImages);

    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.code).toBe('TOO_MANY_IMAGES');
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body.error.code).toBe('TOTAL_IMAGE_SIZE_EXCEEDED');
  });

  it('returns item details and creates a COD order while reserving the item', async () => {
    const seller = await createSession();
    const buyer = await createSession();
    const listing = await publishItem(seller.cookie);
    const itemId = listing.body.item.id as string;

    const details = await request(app).get(`/api/items/${itemId}`).set('Cookie', buyer.cookie);
    expect(details.status).toBe(200);
    expect(details.body.item.title).toBe('Engineering Mathematics');
    expect(details.body.item.status).toBe('ACTIVE');

    const checkout = await request(app)
      .post('/api/checkout')
      .set('Cookie', buyer.cookie)
      .send({ itemIds: [itemId], paymentMethod: 'COD', deliveryNotes: 'Meet at the library' });

    expect(checkout.status).toBe(201);
    expect(checkout.body.orders).toHaveLength(1);
    expect(checkout.body.orders[0]).toMatchObject({
      itemId,
      title: 'Engineering Mathematics',
      price: 250,
      status: 'PLACED',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING_COLLECTION',
    });
    expect(await Item.findById(itemId).select('+imageData')).toMatchObject({
      status: 'PENDING',
      reservedFor: new mongoose.Types.ObjectId(buyer.id),
    });
    expect(await Order.countDocuments({ buyerId: buyer.id })).toBe(1);
  });

  it('allows only one buyer to reserve an item at checkout', async () => {
    const seller = await createSession();
    const buyer1 = await createSession();
    const buyer2 = await createSession();
    const listing = await publishItem(seller.cookie);
    const itemId = listing.body.item.id as string;

    const responses = await Promise.all([
      request(app)
        .post('/api/checkout')
        .set('Cookie', buyer1.cookie)
        .send({ itemIds: [itemId], paymentMethod: 'COD' }),
      request(app)
        .post('/api/checkout')
        .set('Cookie', buyer2.cookie)
        .send({ itemIds: [itemId], paymentMethod: 'COD' }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await Order.countDocuments({ itemId })).toBe(1);
  });

  it('completes an order only after both buyer and seller approve the handover', async () => {
    const seller = await createSession();
    const buyer = await createSession();
    const listing = await publishItem(seller.cookie);
    const itemId = listing.body.item.id as string;
    const checkout = await request(app)
      .post('/api/checkout')
      .set('Cookie', buyer.cookie)
      .send({ itemIds: [itemId], paymentMethod: 'COD' });
    const orderId = checkout.body.orders[0].id as string;

    const buyerOrders = await request(app)
      .get('/api/orders?side=buyer')
      .set('Cookie', buyer.cookie);
    const sellerOrders = await request(app)
      .get('/api/orders?side=seller')
      .set('Cookie', seller.cookie);
    expect(buyerOrders.body.orders[0]).toMatchObject({
      id: orderId,
      itemId,
      title: 'Engineering Mathematics',
      status: 'PLACED',
      completionApprovals: { buyer: false, seller: false },
      rating: null,
    });
    expect(sellerOrders.body.orders[0].id).toBe(orderId);

    const buyerApproval = await request(app)
      .post(`/api/orders/${orderId}/completion-approval`)
      .set('Cookie', buyer.cookie);
    expect(buyerApproval.status).toBe(200);
    expect(buyerApproval.body).toMatchObject({
      status: 'PLACED',
      completionApprovals: { buyer: true, seller: false },
    });
    expect((await Order.findById(orderId))?.status).toBe('PLACED');

    const prematureRating = await request(app)
      .post(`/api/orders/${orderId}/rating`)
      .set('Cookie', buyer.cookie)
      .send({ rating: 5, comment: 'Great handover' });
    expect(prematureRating.status).toBe(409);
    expect(prematureRating.body.error.code).toBe('ORDER_NOT_COMPLETED');

    const sellerApproval = await request(app)
      .post(`/api/orders/${orderId}/completion-approval`)
      .set('Cookie', seller.cookie);
    expect(sellerApproval.status).toBe(200);
    expect(sellerApproval.body).toMatchObject({
      status: 'COMPLETED',
      completionApprovals: { buyer: true, seller: true },
    });
    expect((await Order.findById(orderId))?.status).toBe('COMPLETED');
    expect((await Item.findById(itemId))?.status).toBe('SOLD');
  });

  it('allows only order participants to approve completion', async () => {
    const seller = await createSession();
    const buyer = await createSession();
    const stranger = await createSession();
    const listing = await publishItem(seller.cookie);
    const checkout = await request(app)
      .post('/api/checkout')
      .set('Cookie', buyer.cookie)
      .send({ itemIds: [listing.body.item.id], paymentMethod: 'COD' });
    const orderId = checkout.body.orders[0].id as string;

    const strangerApproval = await request(app)
      .post(`/api/orders/${orderId}/completion-approval`)
      .set('Cookie', stranger.cookie);
    const invalidSide = await request(app)
      .get('/api/orders?side=admin')
      .set('Cookie', buyer.cookie);

    expect(strangerApproval.status).toBe(403);
    expect(strangerApproval.body.error.code).toBe('ORDER_FORBIDDEN');
    expect(invalidSide.status).toBe(400);
    expect(invalidSide.body.error.code).toBe('INVALID_ORDER_SIDE');
  });

  it('lets a buyer rate a completed order once and reflects the seller average', async () => {
    const seller = await createSession();
    const buyer = await createSession();
    const listing = await publishItem(seller.cookie);
    const checkout = await request(app)
      .post('/api/checkout')
      .set('Cookie', buyer.cookie)
      .send({ itemIds: [listing.body.item.id], paymentMethod: 'COD' });
    const orderId = checkout.body.orders[0].id as string;
    await request(app)
      .post(`/api/orders/${orderId}/completion-approval`)
      .set('Cookie', buyer.cookie);
    await request(app)
      .post(`/api/orders/${orderId}/completion-approval`)
      .set('Cookie', seller.cookie);

    const rating = await request(app)
      .post(`/api/orders/${orderId}/rating`)
      .set('Cookie', buyer.cookie)
      .send({ rating: 4, comment: 'Smooth exchange' });
    const duplicateRating = await request(app)
      .post(`/api/orders/${orderId}/rating`)
      .set('Cookie', buyer.cookie)
      .send({ rating: 5 });
    const buyerOrders = await request(app)
      .get('/api/orders?side=buyer')
      .set('Cookie', buyer.cookie);
    const sellerStats = await request(app).get('/api/me/seller-stats').set('Cookie', seller.cookie);

    expect(rating.status).toBe(201);
    expect(rating.body.review).toMatchObject({ rating: 4, comment: 'Smooth exchange' });
    expect(duplicateRating.status).toBe(409);
    expect(duplicateRating.body.error.code).toBe('RATING_ALREADY_SUBMITTED');
    expect(buyerOrders.body.orders[0].rating).toBe(4);
    expect(sellerStats.body).toMatchObject({ averageRating: 4, ratingCount: 1 });
  });

  it('rejects seller ratings from anyone other than the buyer', async () => {
    const seller = await createSession();
    const buyer = await createSession();
    const stranger = await createSession();
    const listing = await publishItem(seller.cookie);
    const checkout = await request(app)
      .post('/api/checkout')
      .set('Cookie', buyer.cookie)
      .send({ itemIds: [listing.body.item.id], paymentMethod: 'COD' });
    const orderId = checkout.body.orders[0].id as string;
    await request(app)
      .post(`/api/orders/${orderId}/completion-approval`)
      .set('Cookie', buyer.cookie);
    await request(app)
      .post(`/api/orders/${orderId}/completion-approval`)
      .set('Cookie', seller.cookie);

    const sellerRating = await request(app)
      .post(`/api/orders/${orderId}/rating`)
      .set('Cookie', seller.cookie)
      .send({ rating: 5 });
    const strangerRating = await request(app)
      .post(`/api/orders/${orderId}/rating`)
      .set('Cookie', stranger.cookie)
      .send({ rating: 5 });
    const invalidRating = await request(app)
      .post(`/api/orders/${orderId}/rating`)
      .set('Cookie', buyer.cookie)
      .send({ rating: 6 });

    expect(sellerRating.status).toBe(403);
    expect(strangerRating.status).toBe(403);
    expect(invalidRating.status).toBe(400);
  });

  it('rejects unsupported and invalid image uploads', async () => {
    const seller = await createSession();
    const unsupported = await request(app)
      .post('/api/items')
      .set('Cookie', seller.cookie)
      .field('title', 'Test item')
      .field('description', 'Test description')
      .field('price', '10')
      .attach('images', Buffer.from('not an image'), {
        filename: 'item.svg',
        contentType: 'image/svg+xml',
      });
    const invalid = await publishItem(seller.cookie, [Buffer.from('not a PNG')]);

    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error.code).toBe('UNSUPPORTED_IMAGE_TYPE');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_IMAGE');
    expect(await Item.countDocuments()).toBe(0);
  });
});
