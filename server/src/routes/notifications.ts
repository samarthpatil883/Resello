import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, getAuthenticatedUser, HttpError } from '../middleware/errors';
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications';

const router = Router();
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

router.get(
  '/notifications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const pagination = paginationSchema.parse(req.query);
    const user = getAuthenticatedUser(req);
    res.status(200).json(await getNotificationsForUser(user._id.toString(), pagination));
  }),
);

router.patch(
  '/notifications/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    res.status(200).json(await markAllNotificationsRead(user._id.toString()));
  }),
);

router.patch(
  '/notifications/:notificationId/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notificationId = req.params.notificationId;
    if (typeof notificationId !== 'string') {
      throw new HttpError(400, 'INVALID_NOTIFICATION_ID', 'The notification ID is invalid.');
    }
    const user = getAuthenticatedUser(req);
    const notification = await markNotificationRead(user._id.toString(), notificationId);
    res.status(200).json({ notification });
  }),
);

export { router as notificationsRouter };
