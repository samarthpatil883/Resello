import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { itemsRouter } from './routes/items';
import { ordersRouter } from './routes/orders';
import { adminRouter } from './routes/admin';
import { wishlistRouter } from './routes/wishlist';
import { notificationsRouter } from './routes/notifications';
import { errorHandler, HttpError } from './middleware/errors';

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);

// Parsing
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

// Routes
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', itemsRouter);
app.use('/api', ordersRouter);
app.use('/api', adminRouter);
app.use('/api', wishlistRouter);
app.use('/api', notificationsRouter);
app.use((_req, _res, next) =>
  next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.')),
);
app.use(errorHandler);

export { app };
