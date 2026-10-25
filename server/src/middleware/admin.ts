import { UserRole } from '@resello/shared';
import type { RequestHandler } from 'express';

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    res.status(403).json({
      error: { code: 'ADMIN_ACCESS_REQUIRED', message: 'Administrator access is required.' },
    });
    return;
  }
  next();
};
