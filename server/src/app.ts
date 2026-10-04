import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { healthRouter } from './routes/health';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_ORIGIN,
  credentials: true,
}));

// Parsing
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api', healthRouter);

export { app };
