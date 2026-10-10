import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
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
app.use((_req, _res, next) =>
  next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.')),
);
app.use(errorHandler);

export { app };
