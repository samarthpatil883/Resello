import mongoose from 'mongoose';
import { env } from '../config/env';
import { UserRole } from '@resello/shared';
import { User } from '../models/User';
import { normalizeCollegeEmail } from '../validators/collegeEmail';

async function seedAdmin() {
  if (env.NODE_ENV === 'production') throw new Error('Admin seeding is disabled in production.');
  if (!env.ADMIN_SEED_EMAIL)
    throw new Error('Set ADMIN_SEED_EMAIL to a verified college account before seeding.');

  const email = normalizeCollegeEmail(env.ADMIN_SEED_EMAIL, env.ALLOWED_EMAIL_DOMAINS);
  await mongoose.connect(env.MONGODB_URI);

  const user = await User.findOneAndUpdate(
    { email, emailVerifiedAt: { $ne: null } },
    { $set: { role: UserRole.ADMIN } },
    { new: true },
  );

  if (!user)
    throw new Error(
      `No verified account exists for ${email}. Register and verify the account first.`,
    );
  console.info(`Granted admin access to ${email}.`);
}

void seedAdmin()
  .catch((error: unknown) => {
    console.error('Failed to seed admin:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
