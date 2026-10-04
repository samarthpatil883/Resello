import type {
  User,
  Listing,
  Order,
  Payment,
  Message,
  Review,
  WishlistItem,
  Notification,
  Category,
} from './models';
import type { Mode, PaymentMethod, ConditionType, PickupPreference, OtpPurpose } from './enums';

// ─── Error ───────────────────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  status: 'VERIFICATION_REQUIRED';
  resendAvailableInSec: number;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendOtpRequest {
  email: string;
  purpose: OtpPurpose;
}

export interface ResendOtpResponse {
  resendAvailableInSec: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface MeResponse {
  user: User;
  badgeCounts: {
    buy: number;
    sell: number;
  };
}

// ─── Account ─────────────────────────────────────────────────────────────────

export interface UpdateModeRequest {
  mode: Mode;
}

export interface SellerOnboardingRequest {
  campusLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  pickupPreference: PickupPreference;
  phone?: string;
}

export interface BadgesResponse {
  buy: number;
  sell: number;
}

// ─── Listings ────────────────────────────────────────────────────────────────

export interface ListingsQuery {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ConditionType;
  maxDistance?: number;
  minRating?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'nearest' | 'top_rated';
  page?: number;
  limit?: number;
  excludeMine?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export type ListingsResponse = PaginatedResponse<Listing>;

// ─── Cart ────────────────────────────────────────────────────────────────────

export interface AddToCartRequest {
  listingId: string;
}

export interface CartResponse {
  items: Array<{
    listing: Listing;
    addedAt: string;
  }>;
  total: number;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export interface CheckoutRequest {
  paymentMethod: PaymentMethod;
  deliveryNotes?: string;
}

export interface CheckoutResponse {
  orders: Order[];
  razorpayOrderId?: string;
  razorpayAmount?: number;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface VerifyPaymentRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface CancelOrderRequest {
  reason?: string;
}

// ─── Seller ──────────────────────────────────────────────────────────────────

export interface CreateListingRequest {
  title: string;
  category: string;
  condition: ConditionType;
  price: number;
  description: string;
  images: Array<{ url: string; publicId: string; width: number; height: number }>;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface DashboardResponse {
  activeListings: number;
  ordersToConfirm: number;
  completedSales: number;
  averageRating: number;
  salesTotal: number;
  salesOnline: number;
  salesCod: number;
  needsAction: Order[];
}

export interface SellerCancelOrderRequest {
  reason: string;
}

export interface SignUploadResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export interface SellerReviewsResponse {
  reviews: Review[];
  averageRating: number;
  ratingDistribution: Record<number, number>;
}

// ─── Wishlist ────────────────────────────────────────────────────────────────

export interface AddToWishlistRequest {
  listingId: string;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface CreateReviewRequest {
  orderId: string;
  rating: number;
  comment?: string;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface SendMessageRequest {
  recipientId: string;
  listingId: string;
  content: string;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminStatsResponse {
  users: number;
  activeListings: number;
  orders: number;
  revenue: number;
}

export interface RemoveListingRequest {
  listingId: string;
  reason: string;
}

export interface SuspendUserRequest {
  userId: string;
  reason: string;
}
