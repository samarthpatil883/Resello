import { Mode, NotificationType, UserRole } from '@resello/shared';
import { Types } from 'mongoose';
import { HttpError } from '../middleware/errors';
import { Notification } from '../models/Notification';
import { User } from '../models/User';

interface NewNotification {
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  mode: Mode;
  relatedId: Types.ObjectId | null;
}

interface OrderNotificationInput {
  _id: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  itemTitle?: string;
}

function toNotificationRecord(notification: {
  _id: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  mode: Mode;
  relatedId: Types.ObjectId | null;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    mode: notification.mode,
    relatedId: notification.relatedId?.toString() ?? null,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

async function createNotifications(notifications: NewNotification[]) {
  if (notifications.length === 0) return;
  await Notification.bulkWrite(
    notifications.map((notification) => ({
      updateOne: {
        filter: {
          recipientId: notification.recipientId,
          type: notification.type,
          relatedId: notification.relatedId,
        },
        update: { $setOnInsert: notification },
        upsert: true,
      },
    })),
    { ordered: true },
  );
}

export async function notifyNewListing(item: {
  _id: Types.ObjectId;
  sellerId: Types.ObjectId;
  title: string;
}) {
  const users = await User.find({
    _id: { $ne: item.sellerId },
    role: UserRole.STUDENT,
    emailVerifiedAt: { $ne: null },
    isSuspended: false,
  })
    .select('_id')
    .lean();
  await createNotifications(
    users.map((user) => ({
      recipientId: user._id,
      type: NotificationType.NEW_LISTING,
      title: 'New item listed',
      body: `${item.title} is now available in the marketplace.`,
      mode: Mode.BUY,
      relatedId: item._id,
    })),
  );
}

function orderNotifications(
  order: OrderNotificationInput,
  type: NotificationType,
  buyerTitle: string,
  buyerBody: string,
  sellerTitle: string,
  sellerBody: string,
): NewNotification[] {
  const itemTitle = order.itemTitle || 'your item';
  return [
    {
      recipientId: order.buyerId,
      type,
      title: buyerTitle,
      body: buyerBody.replace('{item}', itemTitle),
      mode: Mode.BUY,
      relatedId: order._id,
    },
    {
      recipientId: order.sellerId,
      type,
      title: sellerTitle,
      body: sellerBody.replace('{item}', itemTitle),
      mode: Mode.SELL,
      relatedId: order._id,
    },
  ];
}

export async function notifyOrderPlaced(orders: OrderNotificationInput[]) {
  await createNotifications(
    orders.flatMap((order) =>
      orderNotifications(
        order,
        NotificationType.ORDER_PLACED,
        'Purchase placed',
        'Your order for {item} has been placed.',
        'New sale',
        'A buyer has placed an order for {item}.',
      ),
    ),
  );
}

export async function notifyOrderCancelled(order: OrderNotificationInput) {
  await createNotifications(
    orderNotifications(
      order,
      NotificationType.ORDER_CANCELLED,
      'Order cancelled',
      'Your order for {item} was cancelled and the listing is available again.',
      'Order cancelled',
      'The buyer cancelled the order for {item}; your listing is available again.',
    ),
  );
}

export async function notifyOrderCompleted(order: OrderNotificationInput) {
  await createNotifications(
    orderNotifications(
      order,
      NotificationType.ORDER_COMPLETED,
      'Purchase complete',
      'Your purchase of {item} has been marked complete.',
      'Sale complete',
      'Your sale of {item} has been marked complete.',
    ),
  );
}

export async function notifySellerReview(review: {
  sellerId: Types.ObjectId;
  rating: number;
  orderId: Types.ObjectId;
}) {
  await createNotifications([
    {
      recipientId: review.sellerId,
      type: NotificationType.NEW_REVIEW,
      title: 'New seller review',
      body: `A buyer left you a ${review.rating}-star rating.`,
      mode: Mode.SELL,
      relatedId: review.orderId,
    },
  ]);
}

export async function notifyAdminListingRemoved(item: {
  _id: Types.ObjectId;
  sellerId: Types.ObjectId;
  title: string;
}) {
  await createNotifications([
    {
      recipientId: item.sellerId,
      type: NotificationType.LISTING_REMOVED,
      title: 'Listing removed by Resello',
      body: `Your listing “${item.title}” was removed by an administrator.`,
      mode: Mode.SELL,
      relatedId: item._id,
    },
  ]);
}

export async function removeNotificationsForRelatedIds(
  relatedIds: Types.ObjectId[],
  types?: NotificationType[],
) {
  if (relatedIds.length === 0) return;
  await Notification.deleteMany({
    relatedId: { $in: relatedIds },
    ...(types ? { type: { $in: types } } : {}),
  });
}

export async function getNotificationsForUser(
  userId: string,
  { page, limit }: { page: number; limit: number },
) {
  const recipientId = new Types.ObjectId(userId);
  const filter = { recipientId };
  const [notifications, unreadCount, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ ...filter, readAt: null }),
    Notification.countDocuments(filter),
  ]);
  return {
    notifications: notifications.map(toNotificationRecord),
    unreadCount,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new HttpError(400, 'INVALID_NOTIFICATION_ID', 'The notification ID is invalid.');
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: new Types.ObjectId(userId) },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();
  if (!notification) {
    throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'This notification could not be found.');
  }
  return toNotificationRecord(notification);
}

export async function markAllNotificationsRead(userId: string) {
  const result = await Notification.updateMany(
    { recipientId: new Types.ObjectId(userId), readAt: null },
    { $set: { readAt: new Date() } },
  );
  return { updatedCount: result.modifiedCount };
}
