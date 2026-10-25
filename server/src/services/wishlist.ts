import { Types } from 'mongoose';
import { Item } from '../models/Item';
import { WishlistItem } from '../models/WishlistItem';
import { HttpError } from '../middleware/errors';
import { toItemRecord } from './items';

export async function getWishlistForUser(userId: string) {
  const userObjectId = new Types.ObjectId(userId);
  const savedItems = await WishlistItem.find({ userId: userObjectId })
    .sort({ createdAt: -1 })
    .lean();
  if (savedItems.length === 0) return [];

  const activeItems = await Item.find({
    _id: { $in: savedItems.map((savedItem) => savedItem.itemId) },
    status: 'ACTIVE',
  });
  const activeById = new Map(activeItems.map((item) => [item._id.toString(), toItemRecord(item)]));
  const unavailableIds = savedItems
    .map((savedItem) => savedItem.itemId)
    .filter((itemId) => !activeById.has(itemId.toString()));

  if (unavailableIds.length > 0) {
    await WishlistItem.deleteMany({ userId: userObjectId, itemId: { $in: unavailableIds } });
  }

  return savedItems
    .map((savedItem) => activeById.get(savedItem.itemId.toString()))
    .filter((item) => item !== undefined);
}

export async function addWishlistItem(userId: string, itemId: string) {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new HttpError(400, 'INVALID_ITEM_ID', 'The item ID is invalid.');
  }

  const userObjectId = new Types.ObjectId(userId);
  const itemObjectId = new Types.ObjectId(itemId);
  const item = await Item.findOne({ _id: itemObjectId, status: 'ACTIVE' });
  if (!item) {
    throw new HttpError(404, 'ITEM_NOT_FOUND', 'This active listing could not be found.');
  }

  try {
    await WishlistItem.create({ userId: userObjectId, itemId: itemObjectId });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw new HttpError(409, 'WISHLIST_ITEM_EXISTS', 'This listing is already in your wishlist.');
    }
    throw error;
  }

  const stillActive = await Item.exists({ _id: itemObjectId, status: 'ACTIVE' });
  if (!stillActive) {
    await WishlistItem.deleteOne({ userId: userObjectId, itemId: itemObjectId });
    throw new HttpError(404, 'ITEM_NOT_FOUND', 'This active listing could not be found.');
  }

  return toItemRecord(item);
}

export async function removeWishlistItem(userId: string, itemId: string) {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new HttpError(400, 'INVALID_ITEM_ID', 'The item ID is invalid.');
  }

  await WishlistItem.deleteOne({
    userId: new Types.ObjectId(userId),
    itemId: new Types.ObjectId(itemId),
  });
}
