import { NotificationType } from '@resello/shared';
import { Types } from 'mongoose';
import { HttpError } from '../middleware/errors';
import { Item } from '../models/Item';
import { Order } from '../models/Order';
import { Review } from '../models/Review';
import { User } from '../models/User';
import {
  notifyOrderCancelled,
  notifyOrderCompleted,
  notifySellerReview,
  removeNotificationsForRelatedIds,
} from './notifications';

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
  const sellerIds = [
    ...new Set(
      orders
        .filter((order) => side === 'buyer' && order.status !== 'CANCELLED')
        .map((order) => order.sellerId.toString()),
    ),
  ].map((id) => new Types.ObjectId(id));
  const [items, reviews, sellers] = await Promise.all([
    Item.find({ _id: { $in: itemIds } })
      .select('_id title')
      .lean(),
    Review.find({ orderId: { $in: orderIds } })
      .select('orderId rating')
      .lean(),
    User.find({ _id: { $in: sellerIds } })
      .select('name email phone department pickupPreference')
      .lean(),
  ]);
  const titlesByItemId = new Map(items.map((item) => [item._id.toString(), item.title]));
  const ratingsByOrderId = new Map(
    reviews.map((review) => [review.orderId.toString(), review.rating]),
  );
  const sellersById = new Map(sellers.map((seller) => [seller._id.toString(), seller]));

  return orders.map((order) => {
    const seller =
      side === 'buyer' && order.status !== 'CANCELLED'
        ? sellersById.get(order.sellerId.toString())
        : null;
    return {
      id: order._id.toString(),
      itemId: order.itemId.toString(),
      title: order.itemTitle ?? titlesByItemId.get(order.itemId.toString()) ?? 'Unavailable item',
      price: Number(order.price),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      completionApprovals: {
        buyer: Boolean(order.buyerCompletedAt),
        seller: Boolean(order.sellerCompletedAt),
      },
      rating: ratingsByOrderId.get(order._id.toString()) ?? null,
      sellerDetails: seller
        ? {
            name: seller.name,
            email: seller.email,
            phone: seller.phone,
            department: seller.department,
            pickupPreference: seller.pickupPreference,
          }
        : null,
    };
  });
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
    await notifyOrderCompleted(order);
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
      await notifyOrderCompleted(completed);
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

export async function cancelBuyerOrder(userId: string, orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new HttpError(400, 'INVALID_ORDER_ID', 'The order ID is invalid.');
  }
  const buyerObjectId = new Types.ObjectId(userId);
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      buyerId: buyerObjectId,
      status: 'PLACED',
      buyerCompletedAt: null,
      sellerCompletedAt: null,
    },
    { $set: { status: 'CANCELLED' } },
    { new: true },
  );

  if (!order) {
    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) {
      throw new HttpError(404, 'ORDER_NOT_FOUND', 'This order could not be found.');
    }
    if (!existingOrder.buyerId.equals(buyerObjectId)) {
      throw new HttpError(403, 'ORDER_FORBIDDEN', 'Only the buyer on this order can cancel it.');
    }
    throw new HttpError(
      409,
      'ORDER_NOT_CANCELLABLE',
      'Only a newly placed order can be cancelled before either participant approves completion.',
    );
  }

  const releasedListing = await Item.updateOne(
    { _id: order.itemId, status: 'PENDING', reservedFor: buyerObjectId },
    { $set: { status: 'ACTIVE', reservedFor: null } },
  );
  if (releasedListing.modifiedCount !== 1) {
    await Order.updateOne(
      {
        _id: order._id,
        status: 'CANCELLED',
        buyerCompletedAt: null,
        sellerCompletedAt: null,
      },
      { $set: { status: 'PLACED' } },
    );
    throw new HttpError(
      409,
      'LISTING_RELEASE_FAILED',
      'The reserved listing could not be made available. Please try again or contact support.',
    );
  }

  try {
    await notifyOrderCancelled(order);
  } catch (error) {
    await removeNotificationsForRelatedIds([order._id], [NotificationType.ORDER_CANCELLED]);
    await Item.updateOne(
      { _id: order.itemId, status: 'ACTIVE', reservedFor: null },
      { $set: { status: 'PENDING', reservedFor: buyerObjectId } },
    );
    await Order.updateOne({ _id: order._id, status: 'CANCELLED' }, { $set: { status: 'PLACED' } });
    throw error;
  }

  return {
    orderId: order._id.toString(),
    status: order.status,
    listingStatus: 'ACTIVE' as const,
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
    await notifySellerReview({
      sellerId: review.sellerId,
      rating: review.rating,
      orderId: review.orderId,
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
