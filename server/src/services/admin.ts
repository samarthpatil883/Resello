import { UserRole } from '@resello/shared';
import { Types } from 'mongoose';
import { HttpError } from '../middleware/errors';
import { AdminAuditLog, type AdminAuditAction } from '../models/AdminAuditLog';
import { Item } from '../models/Item';
import { Order } from '../models/Order';
import { Review } from '../models/Review';
import { User } from '../models/User';

export interface AdminPagination {
  page: number;
  limit: number;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function paginationResult<T>(records: T[], total: number, { page, limit }: AdminPagination) {
  return {
    records,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getAdminStats() {
  const [users, suspendedUsers, activeListings, orders, completed, pendingListings] =
    await Promise.all([
      User.countDocuments({ role: UserRole.STUDENT }),
      User.countDocuments({ role: UserRole.STUDENT, isSuspended: true }),
      Item.countDocuments({ status: 'ACTIVE' }),
      Order.countDocuments(),
      Order.aggregate<{ total: number; count: number }>([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$price' }, count: { $sum: 1 } } },
      ]),
      Item.countDocuments({ status: 'PENDING' }),
    ]);
  return {
    users,
    suspendedUsers,
    activeListings,
    pendingListings,
    orders,
    completedOrders: completed[0]?.count ?? 0,
    revenue: completed[0]?.total ?? 0,
  };
}

export async function getAdminUsers(
  pagination: AdminPagination,
  search: string,
  status?: 'ACTIVE' | 'SUSPENDED',
) {
  const filter: Record<string, unknown> = { role: UserRole.STUDENT };
  if (status) filter.isSuspended = status === 'SUSPENDED';
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name email role emailVerifiedAt sellerOnboardedAt isSuspended createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  const userIds = users.map((user) => user._id);
  const [listingCounts, buyerOrderCounts, sellerOrderCounts] = await Promise.all([
    Item.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { sellerId: { $in: userIds } } },
      { $group: { _id: '$sellerId', count: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { buyerId: { $in: userIds } } },
      { $group: { _id: '$buyerId', count: { $sum: 1 } } },
    ]),
    Order.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { sellerId: { $in: userIds } } },
      { $group: { _id: '$sellerId', count: { $sum: 1 } } },
    ]),
  ]);
  const countsById = (counts: Array<{ _id: Types.ObjectId; count: number }>) =>
    new Map(counts.map(({ _id, count }) => [_id.toString(), count]));
  const listingsByUser = countsById(listingCounts);
  const purchasesByUser = countsById(buyerOrderCounts);
  const salesByUser = countsById(sellerOrderCounts);

  return paginationResult(
    users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
      sellerOnboarded: Boolean(user.sellerOnboardedAt),
      suspended: user.isSuspended,
      joinedAt: user.createdAt.toISOString(),
      listingCount: listingsByUser.get(user._id.toString()) ?? 0,
      purchaseCount: purchasesByUser.get(user._id.toString()) ?? 0,
      saleCount: salesByUser.get(user._id.toString()) ?? 0,
    })),
    total,
    pagination,
  );
}

export async function getAdminListings(
  pagination: AdminPagination,
  search: string,
  status?: 'ACTIVE' | 'PENDING' | 'SOLD' | 'REMOVED',
) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }
  const [items, total] = await Promise.all([
    Item.find(filter)
      .select('-images.data -imageData')
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    Item.countDocuments(filter),
  ]);
  const sellers = await User.find({ _id: { $in: items.map((item) => item.sellerId) } })
    .select('name email')
    .lean();
  const sellersById = new Map(sellers.map((seller) => [seller._id.toString(), seller]));
  return paginationResult(
    items.map((item) => {
      const seller = sellersById.get(item.sellerId.toString());
      return {
        id: item._id.toString(),
        title: item.title,
        description: item.description,
        price: Number(item.price),
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        seller: seller
          ? { id: seller._id.toString(), name: seller.name, email: seller.email }
          : null,
      };
    }),
    total,
    pagination,
  );
}

export async function getAdminTransactions(pagination: AdminPagination) {
  const [orders, total] = await Promise.all([
    Order.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    Order.countDocuments(),
  ]);
  const [parties, items] = await Promise.all([
    User.find({ _id: { $in: orders.flatMap((order) => [order.buyerId, order.sellerId]) } })
      .select('name email')
      .lean(),
    Item.find({ _id: { $in: orders.map((order) => order.itemId) } })
      .select('title')
      .lean(),
  ]);
  const partiesById = new Map(parties.map((party) => [party._id.toString(), party]));
  const itemsById = new Map(items.map((item) => [item._id.toString(), item]));
  const transactions = orders.map((order) => {
    const buyer = partiesById.get(order.buyerId.toString());
    const seller = partiesById.get(order.sellerId.toString());
    const item = itemsById.get(order.itemId.toString());
    return {
      id: order._id.toString(),
      item: item?.title ?? 'Unavailable item',
      buyer: buyer ? { name: buyer.name, email: buyer.email } : null,
      seller: seller ? { name: seller.name, email: seller.email } : null,
      amount: Number(order.price),
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
    };
  });
  return paginationResult(transactions, total, pagination);
}

export async function getAdminReviews(pagination: AdminPagination, search: string) {
  const sellerFilter: Record<string, unknown> = { role: UserRole.STUDENT };
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    sellerFilter.$or = [{ name: pattern }, { email: pattern }];
  }
  const sellers = await User.find(sellerFilter).select('_id name email').lean();
  if (sellers.length === 0) return paginationResult([], 0, pagination);

  const reviewFilter = { sellerId: { $in: sellers.map((seller) => seller._id) } };
  const [reviews, total] = await Promise.all([
    Review.find(reviewFilter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    Review.countDocuments(reviewFilter),
  ]);
  const [orders, reviewers] = await Promise.all([
    Order.find({ _id: { $in: reviews.map((review) => review.orderId) } })
      .select('_id itemId')
      .lean(),
    User.find({ _id: { $in: reviews.map((review) => review.buyerId) } })
      .select('name email')
      .lean(),
  ]);
  const items = await Item.find({ _id: { $in: orders.map((order) => order.itemId) } })
    .select('_id title')
    .lean();
  const sellersById = new Map(sellers.map((seller) => [seller._id.toString(), seller]));
  const reviewersById = new Map(reviewers.map((reviewer) => [reviewer._id.toString(), reviewer]));
  const ordersById = new Map(orders.map((order) => [order._id.toString(), order]));
  const itemsById = new Map(items.map((item) => [item._id.toString(), item]));
  const records = reviews.map((review) => {
    const seller = sellersById.get(review.sellerId.toString());
    const reviewer = reviewersById.get(review.buyerId.toString());
    const order = ordersById.get(review.orderId.toString());
    const item = order ? itemsById.get(order.itemId.toString()) : undefined;
    return {
      id: review._id.toString(),
      orderId: review.orderId.toString(),
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      seller: seller ? { name: seller.name, email: seller.email } : null,
      reviewer: reviewer ? { name: reviewer.name, email: reviewer.email } : null,
      item: item?.title ?? 'Unavailable item',
    };
  });
  return paginationResult(records, total, pagination);
}

export async function getAdminActivity(pagination: AdminPagination) {
  const [actions, total] = await Promise.all([
    AdminAuditLog.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    AdminAuditLog.countDocuments(),
  ]);
  const admins = await User.find({ _id: { $in: actions.map((action) => action.adminId) } })
    .select('name email')
    .lean();
  const adminsById = new Map(admins.map((admin) => [admin._id.toString(), admin]));
  const activity = actions.map((action) => {
    const admin = adminsById.get(action.adminId.toString());
    return {
      id: action._id.toString(),
      type: action.action,
      targetType: action.targetType,
      targetId: action.targetId.toString(),
      reason: action.reason,
      admin: admin ? { name: admin.name, email: admin.email } : null,
      createdAt: action.createdAt.toISOString(),
    };
  });
  return paginationResult(activity, total, pagination);
}

async function writeAudit(
  adminId: string,
  action: AdminAuditAction,
  targetType: 'USER' | 'LISTING',
  targetId: Types.ObjectId,
  reason: string,
) {
  await AdminAuditLog.create({
    adminId: new Types.ObjectId(adminId),
    action,
    targetType,
    targetId,
    reason,
  });
}

export async function removeAdminListing(adminId: string, listingId: string, reason: string) {
  if (!Types.ObjectId.isValid(listingId)) {
    throw new HttpError(400, 'INVALID_LISTING_ID', 'The listing ID is invalid.');
  }
  const item = await Item.findOneAndUpdate(
    { _id: listingId, status: 'ACTIVE' },
    { $set: { status: 'REMOVED' } },
    { new: true },
  );
  if (!item) {
    throw new HttpError(404, 'ACTIVE_LISTING_NOT_FOUND', 'Only an active listing can be removed.');
  }
  await writeAudit(adminId, 'LISTING_REMOVED', 'LISTING', item._id, reason);
  return { listingId: item._id.toString(), status: item.status };
}

export async function dismissAdminListing(adminId: string, listingId: string, reason: string) {
  if (!Types.ObjectId.isValid(listingId)) {
    throw new HttpError(400, 'INVALID_LISTING_ID', 'The listing ID is invalid.');
  }
  const item = await Item.findById(listingId).select('_id');
  if (!item) throw new HttpError(404, 'LISTING_NOT_FOUND', 'This listing could not be found.');
  await writeAudit(adminId, 'DISMISSED', 'LISTING', item._id, reason);
  return { listingId: item._id.toString(), dismissed: true };
}

export async function setAdminUserSuspension(
  adminId: string,
  userId: string,
  suspended: boolean,
  reason: string,
) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new HttpError(400, 'INVALID_USER_ID', 'The user ID is invalid.');
  }
  const adminObjectId = new Types.ObjectId(adminId);
  const userObjectId = new Types.ObjectId(userId);
  if (adminObjectId.equals(userObjectId)) {
    throw new HttpError(400, 'CANNOT_SUSPEND_SELF', 'Administrators cannot suspend themselves.');
  }
  const user = await User.findOne({ _id: userObjectId, role: UserRole.STUDENT }).select(
    '+authVersion +refreshTokenHash',
  );
  if (!user) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'This student account was not found.');
  if (user.isSuspended === suspended) {
    throw new HttpError(
      409,
      'USER_STATUS_UNCHANGED',
      suspended ? 'This student is already suspended.' : 'This student is not suspended.',
    );
  }
  user.isSuspended = suspended;
  user.authVersion += 1;
  user.refreshTokenHash = null;
  await user.save();
  if (suspended) {
    await Item.updateMany(
      { sellerId: userObjectId, status: 'ACTIVE' },
      { $set: { status: 'REMOVED' } },
    );
  }
  await writeAudit(
    adminId,
    suspended ? 'USER_SUSPENDED' : 'USER_RESTORED',
    'USER',
    userObjectId,
    reason,
  );
  return { userId: userObjectId.toString(), suspended };
}
