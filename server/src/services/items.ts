import { Types } from 'mongoose';
import { ConditionType } from '@resello/shared';
import { Item, type ItemImageContentType } from '../models/Item';
import { Order } from '../models/Order';
import { HttpError } from '../middleware/errors';
import { getSellerRatingSummary } from './orders';

export const MAX_ITEM_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ITEM_IMAGES = 5;
export const MAX_ITEM_IMAGES_TOTAL_BYTES = 15 * 1024 * 1024;

export interface ItemRecord {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  image_urls: string[];
  condition?: ConditionType;
  distance_km?: number;
  status: 'ACTIVE' | 'PENDING' | 'SOLD' | 'REMOVED';
  created_at: string;
}

export interface BuyerItemFilters {
  search: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ConditionType;
  newOnly: boolean;
  maxDistanceKm?: number;
  latitude?: number;
  longitude?: number;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'nearest';
}

export interface SellerDashboardStats {
  activeListings: number;
  needsYourAction: number;
  completedSales: number;
  averageRating: number | null;
  ratingCount: number;
}

interface NewItem {
  sellerId: string;
  title: string;
  description: string;
  price: number;
  condition: ConditionType;
  location: { type: 'Point'; coordinates: [number, number] } | null;
  images: Array<{ data: Buffer; contentType: ItemImageContentType }>;
}

interface ItemChanges {
  title: string;
  description: string;
  price: number;
  condition: ConditionType;
  images: Array<{ data: Buffer; contentType: ItemImageContentType }>;
}

function getImageByteLength(data: Buffer | { length: () => number }) {
  return typeof data.length === 'function' ? data.length() : data.length;
}

function toItemRecord(
  item: {
    _id: Types.ObjectId;
    sellerId: Types.ObjectId;
    title: string;
    description: string;
    price: number;
    condition?: ConditionType;
    status: ItemRecord['status'];
    createdAt: Date;
    imageCount?: number;
  },
  distanceKm?: number,
): ItemRecord {
  const imageCount = Math.max(item.imageCount ?? 0, 1);
  const image_urls = Array.from(
    { length: imageCount },
    (_, index) => `/items/${item._id.toString()}/images/${index}`,
  );
  return {
    id: item._id.toString(),
    seller_id: item.sellerId.toString(),
    title: item.title,
    description: item.description,
    price: Number(item.price),
    image_url: `/items/${item._id.toString()}/image`,
    image_urls,
    ...(item.condition ? { condition: item.condition } : {}),
    ...(distanceKm !== undefined ? { distance_km: distanceKm } : {}),
    status: item.status,
    created_at: item.createdAt.toISOString(),
  };
}

export async function createItem(item: NewItem): Promise<ItemRecord> {
  const created = await Item.create({
    sellerId: new Types.ObjectId(item.sellerId),
    title: item.title,
    description: item.description,
    price: item.price,
    condition: item.condition,
    location: item.location,
    images: item.images,
    imageCount: item.images.length,
  });
  return toItemRecord(created);
}

export async function getItemById(itemId: string): Promise<ItemRecord | null> {
  if (!Types.ObjectId.isValid(itemId)) return null;
  const item = await Item.findById(itemId).lean();
  return item ? toItemRecord(item) : null;
}

export async function checkoutItems(buyerId: string, itemIds: string[], deliveryNotes: string) {
  const buyerObjectId = new Types.ObjectId(buyerId);
  const reservedItems: Array<{
    _id: Types.ObjectId;
    sellerId: Types.ObjectId;
    title: string;
    price: number;
  }> = [];
  const createdOrderIds: Types.ObjectId[] = [];

  try {
    for (const itemId of itemIds) {
      if (!Types.ObjectId.isValid(itemId)) {
        throw new HttpError(400, 'INVALID_ITEM_ID', 'One or more item IDs are invalid.');
      }

      const item = await Item.findOneAndUpdate(
        {
          _id: itemId,
          status: 'ACTIVE',
          sellerId: { $ne: buyerObjectId },
        },
        { $set: { status: 'PENDING', reservedFor: buyerObjectId } },
        { new: true },
      );
      if (!item) {
        throw new HttpError(
          409,
          'ITEM_UNAVAILABLE',
          'An item is no longer available or belongs to your seller account.',
        );
      }
      reservedItems.push(item);
    }

    const orders = [];
    for (const item of reservedItems) {
      const order = await Order.create({
        buyerId: buyerObjectId,
        sellerId: item.sellerId,
        itemId: item._id,
        price: item.price,
        status: 'PLACED',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING_COLLECTION',
        deliveryNotes,
      });
      createdOrderIds.push(order._id);
      orders.push({
        id: order._id.toString(),
        itemId: item._id.toString(),
        title: item.title,
        price: Number(item.price),
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      });
    }
    return orders;
  } catch (error) {
    if (createdOrderIds.length > 0) await Order.deleteMany({ _id: { $in: createdOrderIds } });
    if (reservedItems.length > 0) {
      await Item.updateMany(
        { _id: { $in: reservedItems.map((item) => item._id) }, reservedFor: buyerObjectId },
        { $set: { status: 'ACTIVE', reservedFor: null } },
      );
    }
    throw error;
  }
}

export async function getItemImage(itemId: string, imageIndex = 0) {
  if (!Types.ObjectId.isValid(itemId)) return null;

  const item = await Item.findById(itemId).select('+imageData +images.data');
  if (!item) return null;

  const image = item.images[imageIndex];
  if (image) return { data: image.data, contentType: image.contentType };
  if (imageIndex === 0 && item.imageData && item.imageContentType) {
    return { data: item.imageData, contentType: item.imageContentType };
  }
  return null;
}

export async function getActiveItemsForBuyer(
  sellerId: string,
  filters: BuyerItemFilters,
): Promise<ItemRecord[]> {
  const match: Record<string, unknown> = {
    status: 'ACTIVE',
    sellerId: { $ne: new Types.ObjectId(sellerId) },
  };
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    match.price = {
      ...(filters.minPrice !== undefined ? { $gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { $lte: filters.maxPrice } : {}),
    };
  }
  if (filters.condition) match.condition = filters.condition;
  if (filters.newOnly) {
    match.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  }
  if (filters.search) {
    const escapedSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchPattern = new RegExp(escapedSearch, 'i');
    match.$or = [{ title: searchPattern }, { description: searchPattern }];
  }

  const sortOrder = {
    newest: { createdAt: -1, _id: -1 },
    price_asc: { price: 1, createdAt: -1 },
    price_desc: { price: -1, createdAt: -1 },
    nearest: null,
  } satisfies Record<BuyerItemFilters['sort'], Record<string, 1 | -1> | null>;

  if (filters.latitude !== undefined && filters.longitude !== undefined) {
    const aggregation = await Item.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [filters.longitude, filters.latitude],
          },
          key: 'location',
          distanceField: 'distanceMeters',
          spherical: true,
          ...(filters.maxDistanceKm !== undefined
            ? { maxDistance: filters.maxDistanceKm * 1000 }
            : {}),
        },
      },
      { $match: match },
      { $project: { imageData: 0, imageContentType: 0, 'images.data': 0 } },
      ...(filters.sort === 'nearest' ? [] : [{ $sort: sortOrder[filters.sort] }]),
    ]);
    return (
      aggregation as Array<Parameters<typeof toItemRecord>[0] & { distanceMeters: number }>
    ).map((item) => toItemRecord(item, item.distanceMeters / 1000));
  }

  const items = await Item.find(match)
    .sort(sortOrder[filters.sort] ?? { createdAt: -1 })
    .lean();
  return items.map(toItemRecord);
}

export async function getItemsForSeller(sellerId: string): Promise<ItemRecord[]> {
  const items = await Item.find({ sellerId: new Types.ObjectId(sellerId) })
    .sort({ updatedAt: -1 })
    .lean();
  return items.map(toItemRecord);
}

export async function getSellerDashboardStats(sellerId: string): Promise<SellerDashboardStats> {
  const sellerObjectId = new Types.ObjectId(sellerId);
  const [activeListings, needsYourAction, completedSales, ratingSummary] = await Promise.all([
    Item.countDocuments({ sellerId: sellerObjectId, status: 'ACTIVE' }),
    Order.countDocuments({ sellerId: sellerObjectId, status: 'PLACED' }),
    Order.countDocuments({ sellerId: sellerObjectId, status: 'COMPLETED' }),
    getSellerRatingSummary(sellerObjectId),
  ]);

  return {
    activeListings,
    needsYourAction,
    completedSales,
    ...ratingSummary,
  };
}

export async function updateSellerItem(
  sellerId: string,
  itemId: string,
  changes: ItemChanges,
): Promise<ItemRecord> {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new HttpError(400, 'INVALID_ITEM_ID', 'The item ID is invalid.');
  }

  const sellerObjectId = new Types.ObjectId(sellerId);
  const existing = await Item.findOne({ _id: itemId, sellerId: sellerObjectId })
    .select('+imageData +images.data')
    .lean();
  if (!existing) {
    throw new HttpError(
      404,
      'ITEM_NOT_FOUND',
      'This listing was not found in your seller account.',
    );
  }
  if (existing.status !== 'ACTIVE') {
    throw new HttpError(
      409,
      'ITEM_NOT_EDITABLE',
      'Only active listings can be edited. Reserved or sold items cannot be changed.',
    );
  }

  const currentImages = existing.images ?? [];
  const legacyImage =
    currentImages.length === 0 && existing.imageData && existing.imageContentType
      ? [{ data: existing.imageData, contentType: existing.imageContentType }]
      : [];
  const currentImageCount = Math.max(
    existing.imageCount ?? 0,
    currentImages.length + legacyImage.length,
  );
  if (currentImageCount + changes.images.length > MAX_ITEM_IMAGES) {
    throw new HttpError(
      400,
      'TOO_MANY_IMAGES',
      `A listing can have no more than ${MAX_ITEM_IMAGES} photos.`,
    );
  }

  const existingImageBytes = [...legacyImage, ...currentImages].reduce(
    (total, image) => total + getImageByteLength(image.data),
    0,
  );
  const newImageBytes = changes.images.reduce(
    (total, image) => total + getImageByteLength(image.data),
    0,
  );
  if (existingImageBytes + newImageBytes > MAX_ITEM_IMAGES_TOTAL_BYTES) {
    throw new HttpError(
      413,
      'TOTAL_IMAGE_SIZE_EXCEEDED',
      'The total size of all listing photos must be 15 MB or less.',
    );
  }

  const filter = {
    _id: existing._id,
    sellerId: sellerObjectId,
    status: 'ACTIVE',
    imageCount:
      typeof existing.imageCount === 'number' ? existing.imageCount : { $exists: false as const },
  };
  const update = legacyImage.length
    ? {
        $set: {
          title: changes.title,
          description: changes.description,
          price: changes.price,
          condition: changes.condition,
          images: [...legacyImage, ...changes.images],
          imageCount: currentImageCount + changes.images.length,
        },
        $unset: { imageData: '', imageContentType: '' },
      }
    : {
        $set: {
          title: changes.title,
          description: changes.description,
          price: changes.price,
          condition: changes.condition,
          ...(changes.images.length > 0
            ? { imageCount: currentImageCount + changes.images.length }
            : {}),
        },
        ...(changes.images.length > 0
          ? {
              $push: { images: { $each: changes.images } },
            }
          : {}),
      };

  const updated = await Item.findOneAndUpdate(filter, update, { new: true }).lean();
  if (!updated) {
    throw new HttpError(
      409,
      'ITEM_NOT_EDITABLE',
      'This listing changed or became unavailable. Refresh and try again.',
    );
  }
  return toItemRecord(updated);
}
