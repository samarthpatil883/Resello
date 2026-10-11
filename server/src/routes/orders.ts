import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, getAuthenticatedUser, HttpError } from '../middleware/errors';
import { approveOrderCompletion, createSellerRating, getOrdersForUser } from '../services/orders';

const router = Router();

router.get(
  '/orders',
  requireAuth,
  asyncHandler(async (req, res) => {
    const side = z.enum(['buyer', 'seller']).safeParse(req.query.side);
    if (!side.success) {
      throw new HttpError(400, 'INVALID_ORDER_SIDE', 'Choose buyer or seller orders.');
    }
    const user = getAuthenticatedUser(req);
    const orders = await getOrdersForUser(user._id.toString(), side.data);
    res.status(200).json({ orders });
  }),
);

router.post(
  '/orders/:orderId/completion-approval',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orderId = req.params.orderId;
    if (typeof orderId !== 'string') {
      throw new HttpError(400, 'INVALID_ORDER_ID', 'The order ID is invalid.');
    }
    const user = getAuthenticatedUser(req);
    const result = await approveOrderCompletion(user._id.toString(), orderId);
    res.status(200).json(result);
  }),
);

router.post(
  '/orders/:orderId/rating',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(1000).optional().default(''),
      })
      .parse(req.body);
    const orderId = req.params.orderId;
    if (typeof orderId !== 'string') {
      throw new HttpError(400, 'INVALID_ORDER_ID', 'The order ID is invalid.');
    }
    const user = getAuthenticatedUser(req);
    const review = await createSellerRating(
      user._id.toString(),
      orderId,
      body.rating,
      body.comment,
    );
    res.status(201).json({ review });
  }),
);

export { router as ordersRouter };
