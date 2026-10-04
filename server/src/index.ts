import { env } from './config/env';
import { app } from './app';
import mongoose from 'mongoose';

const start = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.info(`✅ Connected to MongoDB`);

    app.listen(env.PORT, () => {
      console.info(`🚀 Server running on http://localhost:${env.PORT}`);
      console.info(`📧 Mailpit UI: http://localhost:8025`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();
