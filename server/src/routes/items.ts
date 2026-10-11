import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ConditionType } from '@resello/shared';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, getAuthenticatedUser, HttpError } from '../middleware/errors';
import { ITEM_IMAGE_CONTENT_TYPES, type ItemImageContentType } from '../models/Item';
import {
  createItem,
  checkoutItems,
  getActiveItemsForBuyer,
  getItemsForSeller,
  getItemById,
  getItemImage,
  getSellerDashboardStats,
  MAX_ITEM_IMAGE_BYTES,
  MAX_ITEM_IMAGES,
  MAX_ITEM_IMAGES_TOTAL_BYTES,
  updateSellerItem,
} from '../services/items';

const router = Router();

function isItemImageContentType(contentType: string): contentType is ItemImageContentType {
  return ITEM_IMAGE_CONTENT_TYPES.some((supportedType) => supportedType === contentType);
}

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ITEM_IMAGE_BYTES, files: MAX_ITEM_IMAGES },
  fileFilter: (_req, file, callback) => {
    if (!isItemImageContentType(file.mimetype)) {
      callback(new HttpError(400, 'UNSUPPORTED_IMAGE_TYPE', 'Choose a JPEG, PNG, or WebP image.'));
      return;
    }
    callback(null, true);
  },
});

function hasValidImageSignature(contentType: string, data: Buffer) {
  if (contentType === 'image/jpeg') {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return (
    contentType === 'image/webp' &&
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  );
}

function parseUploadedImages(files: Express.Multer.File[]) {
  return files.map((file) => {
    const contentType = file.mimetype;
    if (!isItemImageContentType(contentType) || !hasValidImageSignature(contentType, file.buffer)) {
      throw new HttpError(400, 'INVALID_IMAGE', 'One of the selected files is not a valid image.');
    }
    return { data: file.buffer, contentType };
  });
}

const buyerItemFiltersSchema = z
  .object({
    q: z.string().trim().max(120).optional().default(''),
    minPrice: z.coerce.number().finite().nonnegative().optional(),
    maxPrice: z.coerce.number().finite().nonnegative().optional(),
    condition: z.nativeEnum(ConditionType).optional(),
    newOnly: z
      .enum(['true', 'false'])
      .optional()
      .default('false')
      .transform((value) => value === 'true'),
    maxDistanceKm: z.coerce.number().finite().min(0.1).max(100).optional(),
    latitude: z.coerce.number().finite().min(-90).max(90).optional(),
    longitude: z.coerce.number().finite().min(-180).max(180).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'nearest']).optional().default('newest'),
  })
  .superRefine((filters, context) => {
    if (
      filters.minPrice !== undefined &&
      filters.maxPrice !== undefined &&
      filters.minPrice > filters.maxPrice
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum price cannot exceed maximum price.',
        path: ['minPrice'],
      });
    }
    if ((filters.latitude === undefined) !== (filters.longitude === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude and longitude must be provided together.',
        path: ['latitude'],
      });
    }
    if (
      (filters.maxDistanceKm !== undefined || filters.sort === 'nearest') &&
      filters.latitude === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A buyer location is required for distance filtering.',
        path: ['latitude'],
      });
    }
  });

router.get(
  '/me/seller-stats',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const stats = await getSellerDashboardStats(user._id.toString());
    res.status(200).json(stats);
  }),
);

router.post(
  '/items',
  requireAuth,
  uploadImage.array('images', MAX_ITEM_IMAGES),
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user.sellerOnboardedAt) {
      throw new HttpError(
        403,
        'SELLER_ONBOARDING_REQUIRED',
        'Complete seller setup before listing items.',
      );
    }

    const files = req.files;
    if (!Array.isArray(files) || files.length === 0) {
      throw new HttpError(
        400,
        'IMAGES_REQUIRED',
        'Choose at least one JPEG, PNG, or WebP image before publishing.',
      );
    }
    if (files.reduce((total, file) => total + file.size, 0) > MAX_ITEM_IMAGES_TOTAL_BYTES) {
      throw new HttpError(
        413,
        'TOTAL_IMAGE_SIZE_EXCEEDED',
        'The total size of all listing photos must be 15 MB or less.',
      );
    }

    const body = z
      .object({
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().min(1).max(2000),
        price: z.coerce.number().finite().positive().max(10_000_000),
        condition: z.nativeEnum(ConditionType),
      })
      .parse(req.body);

    const images = parseUploadedImages(files);

    const item = await createItem({
      sellerId: user._id.toString(),
      title: body.title,
      description: body.description,
      price: body.price,
      condition: body.condition,
      location:
        user.campusLocation?.coordinates?.length === 2
          ? {
              type: 'Point',
              coordinates: [user.campusLocation.coordinates[0], user.campusLocation.coordinates[1]],
            }
          : null,
      images,
    });
    res.status(201).json({ item });
  }),
);

router.get(
  '/items/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const items = await getItemsForSeller(user._id.toString());
    res.status(200).json({ items });
  }),
);

router.get(
  '/items',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const filters = buyerItemFiltersSchema.parse(req.query);
    const items = await getActiveItemsForBuyer(user._id.toString(), {
      search: filters.q,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      condition: filters.condition,
      newOnly: filters.newOnly,
      maxDistanceKm: filters.maxDistanceKm,
      latitude: filters.latitude,
      longitude: filters.longitude,
      sort: filters.sort,
    });
    res.status(200).json({ items });
  }),
);

router.get(
  '/items/:itemId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const itemId = req.params.itemId;
    if (typeof itemId !== 'string') {
      throw new HttpError(400, 'INVALID_ITEM_ID', 'The item ID is invalid.');
    }
    const item = await getItemById(itemId);
    if (!item || item.status === 'REMOVED') {
      throw new HttpError(404, 'ITEM_NOT_FOUND', 'This item is no longer available.');
    }
    res.status(200).json({ item });
  }),
);

router.patch(
  '/items/:itemId',
  requireAuth,
  uploadImage.array('images', MAX_ITEM_IMAGES),
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user.sellerOnboardedAt) {
      throw new HttpError(
        403,
        'SELLER_ONBOARDING_REQUIRED',
        'Complete seller setup before editing listings.',
      );
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.reduce((total, file) => total + file.size, 0) > MAX_ITEM_IMAGES_TOTAL_BYTES) {
      throw new HttpError(
        413,
        'TOTAL_IMAGE_SIZE_EXCEEDED',
        'The total size of all listing photos must be 15 MB or less.',
      );
    }

    const body = z
      .object({
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().min(1).max(2000),
        price: z.coerce.number().finite().positive().max(10_000_000),
        condition: z.nativeEnum(ConditionType),
      })
      .parse(req.body);
    const itemId = req.params.itemId;
    if (typeof itemId !== 'string') {
      throw new HttpError(400, 'INVALID_ITEM_ID', 'The item ID is invalid.');
    }

    const item = await updateSellerItem(user._id.toString(), itemId, {
      ...body,
      images: parseUploadedImages(files),
    });
    res.status(200).json({ item });
  }),
);

router.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        itemIds: z.array(z.string().min(1)).min(1).max(25),
        paymentMethod: z.literal('COD'),
        deliveryNotes: z.string().trim().max(500).optional().default(''),
      })
      .parse(req.body);
    if (new Set(body.itemIds).size !== body.itemIds.length) {
      throw new HttpError(400, 'DUPLICATE_ITEMS', 'An item can only be checked out once.');
    }

    const user = getAuthenticatedUser(req);
    const orders = await checkoutItems(user._id.toString(), body.itemIds, body.deliveryNotes);
    res.status(201).json({ orders });
  }),
);

router.get(
  '/items/:itemId/image',
  asyncHandler(async (req, res) => {
    const itemId = req.params.itemId;
    if (typeof itemId !== 'string') {
      throw new HttpError(400, 'INVALID_ITEM_ID', 'The item ID is invalid.');
    }
    const image = await getItemImage(itemId);
    if (!image) throw new HttpError(404, 'IMAGE_NOT_FOUND', 'This item image is unavailable.');

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type(image.contentType).send(image.data);
  }),
);

router.get(
  '/items/:itemId/images/:imageIndex',
  asyncHandler(async (req, res) => {
    const { itemId, imageIndex: imageIndexParam } = req.params;
    if (typeof itemId !== 'string' || typeof imageIndexParam !== 'string') {
      throw new HttpError(400, 'INVALID_ITEM_IMAGE', 'The item image URL is invalid.');
    }
    const imageIndex = Number(imageIndexParam);
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= MAX_ITEM_IMAGES) {
      throw new HttpError(404, 'IMAGE_NOT_FOUND', 'This item image is unavailable.');
    }
    const image = await getItemImage(itemId, imageIndex);
    if (!image) throw new HttpError(404, 'IMAGE_NOT_FOUND', 'This item image is unavailable.');

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type(image.contentType).send(image.data);
  }),
);

export { router as itemsRouter };
