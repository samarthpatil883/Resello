import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ConditionType } from '@resello/shared';

export interface Item {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  condition?: ConditionType;
  distance_km?: number;
  image_url: string;
  image_urls?: string[];
  status: 'ACTIVE' | 'PENDING' | 'SOLD' | 'REMOVED';
  created_at: string;
}

export const EMPTY_MARKETPLACE_ITEMS: Item[] = [];

interface MarketplaceState {
  cartByUser: Record<string, Item[]>;
  wishlistByUser: Record<string, Item[]>;
  addToCart: (userId: string, item: Item) => void;
  removeFromCart: (userId: string, itemId: string) => void;
  toggleWishlist: (userId: string, item: Item) => void;
  removeFromWishlist: (userId: string, itemId: string) => void;
  clearCart: (userId: string, itemIds: string[]) => void;
}

export const useMarketplaceStore = create<MarketplaceState>()(
  persist(
    (set) => ({
      cartByUser: {},
      wishlistByUser: {},
      addToCart: (userId, item) =>
        set((state) => {
          const items = state.cartByUser[userId] ?? [];
          if (items.some((cartItem) => cartItem.id === item.id)) return state;
          return { cartByUser: { ...state.cartByUser, [userId]: [...items, item] } };
        }),
      removeFromCart: (userId, itemId) =>
        set((state) => ({
          cartByUser: {
            ...state.cartByUser,
            [userId]: (state.cartByUser[userId] ?? []).filter((item) => item.id !== itemId),
          },
        })),
      toggleWishlist: (userId, item) =>
        set((state) => {
          const items = state.wishlistByUser[userId] ?? [];
          const exists = items.some((savedItem) => savedItem.id === item.id);
          return {
            wishlistByUser: {
              ...state.wishlistByUser,
              [userId]: exists
                ? items.filter((savedItem) => savedItem.id !== item.id)
                : [...items, item],
            },
          };
        }),
      removeFromWishlist: (userId, itemId) =>
        set((state) => ({
          wishlistByUser: {
            ...state.wishlistByUser,
            [userId]: (state.wishlistByUser[userId] ?? []).filter((item) => item.id !== itemId),
          },
        })),
      clearCart: (userId, itemIds) =>
        set((state) => ({
          cartByUser: {
            ...state.cartByUser,
            [userId]: (state.cartByUser[userId] ?? []).filter((item) => !itemIds.includes(item.id)),
          },
        })),
    }),
    {
      name: 'resello:marketplace:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cartByUser: state.cartByUser,
        wishlistByUser: state.wishlistByUser,
      }),
    },
  ),
);
