import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/admin';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, getAuthenticatedUser } from '../middleware/errors';
import {
  dismissAdminListing,
  getAdminActivity,
  getAdminListings,
  getAdminReviews,
  getAdminStats,
  getAdminTransactions,
  getAdminUsers,
  removeAdminListing,
  setAdminUserSuspension,
} from '../services/admin';

const router = Router();
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
const adminQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).default(''),
  status: z.enum(['ACTIVE', 'PENDING', 'SOLD', 'REMOVED']).optional(),
});

router.use('/admin', requireAuth, requireAdmin);

router.get(
  '/admin/stats',
  asyncHandler(async (_req, res) => {
    res.status(200).json(await getAdminStats());
  }),
);

router.get(
  '/admin/users',
  asyncHandler(async (req, res) => {
    const query = adminQuerySchema
      .extend({ status: z.enum(['ACTIVE', 'SUSPENDED']).optional() })
      .parse(req.query);
    const result = await getAdminUsers(query, query.search, query.status);
    res.status(200).json({
      users: result.records,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  }),
);

router.get(
  ['/admin/listings', '/admin/moderation'],
  asyncHandler(async (req, res) => {
    const query = adminQuerySchema.parse(req.query);
    const result = await getAdminListings(query, query.search, query.status);
    res.status(200).json({
      listings: result.records,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  }),
);

router.get(
  '/admin/reviews',
  asyncHandler(async (req, res) => {
    const query = paginationSchema
      .extend({ search: z.string().trim().max(120).default('') })
      .parse(req.query);
    const result = await getAdminReviews(query, query.search);
    res.status(200).json({
      reviews: result.records,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  }),
);

router.get(
  '/admin/transactions',
  asyncHandler(async (req, res) => {
    const query = paginationSchema.parse(req.query);
    const result = await getAdminTransactions(query);
    res.status(200).json({
      transactions: result.records,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  }),
);

router.get(
  '/admin/activity',
  asyncHandler(async (req, res) => {
    const query = paginationSchema.parse(req.query);
    const result = await getAdminActivity(query);
    res.status(200).json({
      activity: result.records,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  }),
);

router.post(
  '/admin/actions/remove-listing',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        listingId: z.string().min(1),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(req.body);
    const admin = getAuthenticatedUser(req);
    res
      .status(200)
      .json(await removeAdminListing(admin._id.toString(), body.listingId, body.reason));
  }),
);

router.post(
  '/admin/actions/dismiss',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        listingId: z.string().min(1),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(req.body);
    const admin = getAuthenticatedUser(req);
    res
      .status(200)
      .json(await dismissAdminListing(admin._id.toString(), body.listingId, body.reason));
  }),
);

router.post(
  '/admin/actions/suspend-user',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        userId: z.string().min(1),
        suspended: z.boolean().default(true),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(req.body);
    const admin = getAuthenticatedUser(req);
    res
      .status(200)
      .json(
        await setAdminUserSuspension(
          admin._id.toString(),
          body.userId,
          body.suspended,
          body.reason,
        ),
      );
  }),
);

export { router as adminRouter };
