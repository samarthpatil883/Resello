import { Schema, model, type HydratedDocument } from 'mongoose';
import { Mode, PickupPreference, UserRole, type NotificationPreferences } from '@resello/shared';

export interface UserFields {
  createdAt: Date;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
  lastActiveMode: Mode;
  sellerOnboardedAt: Date | null;
  campusLocation: { type: 'Point'; coordinates: [number, number] } | null;
  pickupPreference: PickupPreference | null;
  phone: string | null;
  department: string | null;
  graduationYear: number | null;
  bio: string | null;
  avatarData: Buffer | null;
  avatarContentType: string | null;
  avatarUpdatedAt: Date | null;
  notificationPreferences: NotificationPreferences;
  isSuspended: boolean;
  authVersion: number;
  refreshTokenHash: string | null;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserFields>;

const userSchema = new Schema<UserFields>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.STUDENT,
      required: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    lastActiveMode: { type: String, enum: Object.values(Mode), default: Mode.BUY, required: true },
    sellerOnboardedAt: { type: Date, default: null },
    campusLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: false,
      },
      coordinates: { type: [Number], required: false },
    },
    pickupPreference: { type: String, enum: Object.values(PickupPreference), default: null },
    phone: { type: String, default: null },
    department: { type: String, default: null, trim: true, maxlength: 100 },
    graduationYear: { type: Number, default: null, min: 2000, max: 2100 },
    bio: { type: String, default: null, trim: true, maxlength: 180 },
    avatarData: { type: Buffer, default: null, select: false },
    avatarContentType: { type: String, default: null, select: false },
    avatarUpdatedAt: { type: Date, default: null },
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      marketplaceUpdates: { type: Boolean, default: true },
      reviewUpdates: { type: Boolean, default: true },
      accountUpdates: { type: Boolean, default: true },
    },
    isSuspended: { type: Boolean, default: false, required: true },
    authVersion: { type: Number, default: 0, required: true, select: false },
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

export const User = model<UserFields>('User', userSchema);
