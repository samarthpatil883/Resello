import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken as string | undefined;
    if (!token) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Please log in to continue.' } });
      return;
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') {
      res.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Please log in again.' } });
      return;
    }

    const user = await User.findById(payload.sub).select('+authVersion');
    if (!user || user.authVersion !== payload.ver || user.isSuspended || !user.emailVerifiedAt) {
      res.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Please log in again.' } });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Please log in again.' } });
      return;
    }
    next(error);
  }
};
