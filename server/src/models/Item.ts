import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { ConditionType } from '@resello/shared';

export const ITEM_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ItemImageContentType = (typeof ITEM_IMAGE_CONTENT_TYPES)[number];

export interface ItemFields {
  sellerId: Types.ObjectId;
  title: string;
  description: string;
  price: number;
  condition?: ConditionType;
  location?: { type: 'Point'; coordinates: [number, number] } | null;
  imageData?: Buffer;
  imageContentType?: ItemImageContentType;
  images: Array<{ data: Buffer; contentType: ItemImageContentType }>;
  imageCount: number;
  status: 'ACTIVE' | 'PENDING' | 'SOLD' | 'REMOVED';
  reservedFor: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ItemDocument = HydratedDocument<ItemFields>;

const itemSchema = new Schema<ItemFields>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, minlength: 2, maxlength: 120, required: true },
    description: { type: String, trim: true, maxlength: 2000, required: true },
    price: { type: Number, min: 0.01, max: 10_000_000, required: true },
    condition: { type: String, enum: Object.values(ConditionType) },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: false,
      },
      coordinates: { type: [Number], required: false },
    },
    imageData: { type: Buffer, select: false },
    imageContentType: { type: String, enum: ITEM_IMAGE_CONTENT_TYPES },
    images: {
      type: [
        new Schema(
          {
            data: { type: Buffer, required: true, select: false },
            contentType: { type: String, enum: ITEM_IMAGE_CONTENT_TYPES, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    imageCount: { type: Number, min: 0, max: 5, default: 0, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'PENDING', 'SOLD', 'REMOVED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    reservedFor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

itemSchema.index({ status: 1, createdAt: -1 });
itemSchema.index({ location: '2dsphere' });

export const Item = model<ItemFields>('Item', itemSchema);
