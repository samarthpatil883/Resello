import { Schema, Types, model, type HydratedDocument } from 'mongoose';

export type AdminAuditAction = 'LISTING_REMOVED' | 'USER_SUSPENDED' | 'USER_RESTORED' | 'DISMISSED';

export interface AdminAuditLogFields {
  adminId: Types.ObjectId;
  action: AdminAuditAction;
  targetType: 'USER' | 'LISTING';
  targetId: Types.ObjectId;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AdminAuditLogDocument = HydratedDocument<AdminAuditLogFields>;

const adminAuditLogSchema = new Schema<AdminAuditLogFields>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['LISTING_REMOVED', 'USER_SUSPENDED', 'USER_RESTORED', 'DISMISSED'],
      required: true,
    },
    targetType: { type: String, enum: ['USER', 'LISTING'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, trim: true, minlength: 3, maxlength: 500, required: true },
  },
  { timestamps: true },
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const AdminAuditLog = model<AdminAuditLogFields>('AdminAuditLog', adminAuditLogSchema);
