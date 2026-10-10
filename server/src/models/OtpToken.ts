import { Schema, model } from 'mongoose';
import { OtpPurpose } from '@resello/shared';

const otpTokenSchema = new Schema(
  {
    emailNormalized: { type: String, required: true, lowercase: true, index: true },
    purpose: { type: String, enum: Object.values(OtpPurpose), required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpTokenSchema.index({ emailNormalized: 1, purpose: 1, createdAt: -1 });

export const OtpToken = model('OtpToken', otpTokenSchema);
