import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { CollegeEmailError } from '../validators/collegeEmail';
import { OtpRequestError } from '../services/otp';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof CollegeEmailError) {
    res.status(400).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof OtpRequestError) {
    res.setHeader('Retry-After', error.retryAfterSec);
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: { code: 'IMAGE_TOO_LARGE', message: 'Each image must be 5 MB or smaller.' },
      });
      return;
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: { code: 'TOO_MANY_IMAGES', message: 'Upload no more than five images per listing.' },
      });
      return;
    }
    res.status(400).json({
      error: {
        code: 'INVALID_IMAGE_UPLOAD',
        message: 'Upload up to five images using the images field.',
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request.' },
    });
    return;
  }

  if (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON.' } });
    return;
  }

  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'REQUEST_TOO_LARGE', message: 'Request body is too large.' } });
    return;
  }

  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    res.status(409).json({
      error: {
        code: 'EMAIL_TAKEN',
        message: 'This email is already registered. Log in instead.',
      },
    });
    return;
  }

  console.error('Unhandled request error:', error);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong.' } });
};

export function getAuthenticatedUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
  return req.user;
}
