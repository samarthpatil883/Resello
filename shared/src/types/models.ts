import {
  ListingStatus,
  ConditionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  Mode,
  PickupPreference,
  OtpPurpose,
  NotificationType,
} from './enums';

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: string | null;
  lastActiveMode: Mode;
  sellerOnboardedAt: string | null;
  campusLocation: GeoJSONPoint | null;
  pickupPreference: PickupPreference | null;
  phone: string | null;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon: string;
}

export interface ProductImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export interface Listing {
  _id: string;
  seller: string | User;
  title: string;
  category: string | Category;
  condition: ConditionType;
  price: number;
  description: string;
  images: ProductImage[];
  location: GeoJSONPoint;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  listing: string | Listing;
  addedAt: string;
}

export interface Cart {
  _id: string;
  user: string;
  items: CartItem[];
}

export interface Payment {
  _id: string;
  order: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  transactionRef: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
}

export interface Order {
  _id: string;
  listing: string | Listing;
  buyer: string | User;
  seller: string | User;
  price: number;
  status: OrderStatus;
  payment: string | Payment;
  deliveryNotes: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  sender: string | User;
  recipient: string | User;
  listing: string | Listing;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface Review {
  _id: string;
  order: string | Order;
  reviewer: string | User;
  seller: string | User;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface WishlistItem {
  _id: string;
  user: string;
  listing: string | Listing;
  addedAt: string;
}

export interface Notification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  body: string;
  mode: Mode;
  relatedId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface OtpToken {
  _id: string;
  emailNormalized: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  consumedAt: string | null;
  createdAt: string;
}
