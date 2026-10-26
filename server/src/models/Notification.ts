import { Mode, NotificationType } from '@resello/shared';
import { Schema, Types, model, type HydratedDocument } from 'mongoose';

export interface NotificationFields {
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  mode: Mode;
  relatedId: Types.ObjectId | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<NotificationFields>;

const notificationSchema = new Schema<NotificationFields>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 300 },
    mode: { type: String, enum: Object.values(Mode), required: true },
    relatedId: { type: Schema.Types.ObjectId, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index(
  { recipientId: 1, type: 1, relatedId: 1 },
  { unique: true, partialFilterExpression: { relatedId: { $type: 'objectId' } } },
);

export const Notification = model<NotificationFields>('Notification', notificationSchema);
