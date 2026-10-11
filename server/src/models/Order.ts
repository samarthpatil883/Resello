import { Schema, Types, model, type HydratedDocument } from 'mongoose';

export interface OrderFields {
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  itemId: Types.ObjectId;
  price: number;
  status: 'PLACED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  buyerCompletedAt: Date | null;
  sellerCompletedAt: Date | null;
  paymentMethod: 'COD';
  paymentStatus: 'PENDING_COLLECTION';
  deliveryNotes: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<OrderFields>;

const orderSchema = new Schema<OrderFields>(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    price: { type: Number, min: 0.01, required: true },
    status: {
      type: String,
      enum: ['PLACED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      default: 'PLACED',
      required: true,
    },
    buyerCompletedAt: { type: Date, default: null },
    sellerCompletedAt: { type: Date, default: null },
    paymentMethod: { type: String, enum: ['COD'], required: true },
    paymentStatus: { type: String, enum: ['PENDING_COLLECTION'], required: true },
    deliveryNotes: { type: String, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

orderSchema.index({ sellerId: 1, status: 1 });

export const Order = model<OrderFields>('Order', orderSchema);
