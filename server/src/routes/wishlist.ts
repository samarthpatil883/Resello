import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, getAuthenticatedUser, HttpError } from '../middleware/errors';
import { addWishlistItem, getWishlistForUser, removeWishlistItem } from '../services/wishlist';

const router = Router();

router.get(
  '/wishlist',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const items = await getWishlistForUser(user._id.toString());
    res.status(200).json({ items });
  }),
);

router.post(
  '/wishlist',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ listingId: z.string().min(1) }).parse(req.body);
    const user = getAuthenticatedUser(req);
    const item = await addWishlistItem(user._id.toString(), body.listingId);
    res.status(201).json({ item });
  }),
);

router.delete(
  '/wishlist/:listingId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const listingId = req.params.listingId;
    if (typeof listingId !== 'string') {
      throw new HttpError(400, 'INVALID_ITEM_ID', 'The item ID is invalid.');
    }
    const user = getAuthenticatedUser(req);
    await removeWishlistItem(user._id.toString(), listingId);
    res.status(200).json({ success: true });
  }),
);

export { router as wishlistRouter };
