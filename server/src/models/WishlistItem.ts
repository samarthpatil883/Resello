import { Schema, Types, model, type HydratedDocument } from 'mongoose';

export interface WishlistItemFields {
  userId: Types.ObjectId;
  itemId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type WishlistItemDocument = HydratedDocument<WishlistItemFields>;

const wishlistItemSchema = new Schema<WishlistItemFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  },
  { timestamps: true },
);

wishlistItemSchema.index({ userId: 1, itemId: 1 }, { unique: true });
wishlistItemSchema.index({ itemId: 1 });

export const WishlistItem = model<WishlistItemFields>('WishlistItem', wishlistItemSchema);
