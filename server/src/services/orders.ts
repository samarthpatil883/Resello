import { Types } from 'mongoose';
import { HttpError } from '../middleware/errors';
import { Item } from '../models/Item';
import { Order } from '../models/Order';
import { Review } from '../models/Review';

export type OrderSide = 'buyer' | 'seller';

export async function getOrdersForUser(userId: string, side: OrderSide) {
  const userObjectId = new Types.ObjectId(userId);
  const orders = await Order.find(
    side === 'buyer' ? { buyerId: userObjectId } : { sellerId: userObjectId },
  )
    .sort({ createdAt: -1 })
    .lean();
  if (orders.length === 0) return [];

  const orderIds = orders.map((order) => order._id);
  const itemIds = orders.map((order) => order.itemId);
  const [items, reviews] = await Promise.all([
    Item.find({ _id: { $in: itemIds } })
      .select('_id title')
      .lean(),
    Review.find({ orderId: { $in: orderIds } })
      .select('orderId rating')
      .lean(),
  ]);
  const titlesByItemId = new Map(items.map((item) => [item._id.toString(), item.title]));
  const ratingsByOrderId = new Map(
    reviews.map((review) => [review.orderId.toString(), review.rating]),
  );

  return orders.map((order) => ({
    id: order._id.toString(),
    itemId: order.itemId.toString(),
    title: titlesByItemId.get(order.itemId.toString()) ?? 'Unavailable item',
    price: Number(order.price),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    completionApprovals: {
      buyer: Boolean(order.buyerCompletedAt),
      seller: Boolean(order.sellerCompletedAt),
    },
    rating: ratingsByOrderId.get(order._id.toString()) ?? null,
  }));
}

export async function approveOrderCompletion(userId: string, orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new HttpError(400, 'INVALID_ORDER_ID', 'The order ID is invalid.');
  }
  const userObjectId = new Types.ObjectId(userId);
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'This order could not be found.');

  const isBuyer = order.buyerId.equals(userObjectId);
  const isSeller = order.sellerId.equals(userObjectId);
  if (!isBuyer && !isSeller) {
    throw new HttpError(403, 'ORDER_FORBIDDEN', 'You are not a buyer or seller on this order.');
  }
  if (order.status === 'CANCELLED') {
    throw new HttpError(409, 'ORDER_NOT_COMPLETABLE', 'A cancelled order cannot be completed.');
  }
  if (order.status === 'COMPLETED') {
    return {
      orderId: order._id.toString(),
      status: order.status,
      completionApprovals: { buyer: true, seller: true },
    };
  }

  if (order.status !== 'PLACED' && order.status !== 'CONFIRMED') {
    throw new HttpError(409, 'ORDER_NOT_COMPLETABLE', 'This order cannot be completed.');
  }

  const approvalField = isBuyer ? 'buyerCompletedAt' : 'sellerCompletedAt';
  await Order.updateOne(
    { _id: order._id, status: { $in: ['PLACED', 'CONFIRMED'] }, [approvalField]: null },
    { $set: { [approvalField]: new Date() } },
  );
  const updated = await Order.findById(order._id);
  if (!updated) throw new HttpError(404, 'ORDER_NOT_FOUND', 'This order could not be found.');

  if (updated.buyerCompletedAt && updated.sellerCompletedAt && updated.status !== 'COMPLETED') {
    const completed = await Order.findOneAndUpdate(
      {
        _id: updated._id,
        status: { $in: ['PLACED', 'CONFIRMED'] },
        buyerCompletedAt: { $ne: null },
        sellerCompletedAt: { $ne: null },
      },
      { $set: { status: 'COMPLETED' } },
      { new: true },
    );
    if (completed) {
      await Item.updateOne(
        { _id: completed.itemId, status: 'PENDING', reservedFor: completed.buyerId },
        { $set: { status: 'SOLD', reservedFor: null } },
      );
    }
  }

  const result = await Order.findById(order._id);
  if (!result) throw new HttpError(404, 'ORDER_NOT_FOUND', 'This order could not be found.');
  return {
    orderId: result._id.toString(),
    status: result.status,
    completionApprovals: {
      buyer: Boolean(result.buyerCompletedAt),
      seller: Boolean(result.sellerCompletedAt),
    },
  };
}

export async function createSellerRating(
  userId: string,
  orderId: string,
  rating: number,
  comment: string,
) {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new HttpError(400, 'INVALID_ORDER_ID', 'The order ID is invalid.');
  }
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'This order could not be found.');
  if (!order.buyerId.equals(new Types.ObjectId(userId))) {
    throw new HttpError(
      403,
      'ORDER_FORBIDDEN',
      'Only the buyer on this order can rate the seller.',
    );
  }
  if (order.status !== 'COMPLETED') {
    throw new HttpError(
      409,
      'ORDER_NOT_COMPLETED',
      'Both the buyer and seller must approve completion before a rating can be submitted.',
    );
  }
  if (await Review.exists({ orderId: order._id })) {
    throw new HttpError(409, 'RATING_ALREADY_SUBMITTED', 'You have already rated this order.');
  }

  try {
    const review = await Review.create({
      orderId: order._id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      rating,
      comment,
    });
    return {
      id: review._id.toString(),
      rating: review.rating,
      comment: review.comment,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw new HttpError(409, 'RATING_ALREADY_SUBMITTED', 'You have already rated this order.');
    }
    throw error;
  }
}

export async function getSellerRatingSummary(sellerId: Types.ObjectId) {
  const [summary] = await Review.aggregate<{ averageRating: number; ratingCount: number }>([
    { $match: { sellerId } },
    { $group: { _id: null, averageRating: { $avg: '$rating' }, ratingCount: { $sum: 1 } } },
  ]);
  return {
    averageRating: summary ? Math.round(summary.averageRating * 10) / 10 : null,
    ratingCount: summary?.ratingCount ?? 0,
  };
}
