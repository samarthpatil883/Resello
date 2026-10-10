import { Schema, model, type HydratedDocument } from 'mongoose';
import { Mode, PickupPreference, UserRole } from '@resello/shared';

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
    isSuspended: { type: Boolean, default: false, required: true },
    authVersion: { type: Number, default: 0, required: true, select: false },
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

export const User = model<UserFields>('User', userSchema);
