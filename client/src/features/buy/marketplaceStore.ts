import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ConditionType, ListingCategory } from '@resello/shared';

export interface Item {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  condition?: ConditionType;
  category?: ListingCategory;
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
  setWishlist: (userId: string, items: Item[]) => void;
  removeFromWishlist: (userId: string, itemId: string) => void;
  removeItemsFromAllWishlists: (itemIds: string[]) => void;
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
      setWishlist: (userId, items) =>
        set((state) => ({
          wishlistByUser: { ...state.wishlistByUser, [userId]: items },
        })),
      removeFromWishlist: (userId, itemId) =>
        set((state) => ({
          wishlistByUser: {
            ...state.wishlistByUser,
            [userId]: (state.wishlistByUser[userId] ?? []).filter((item) => item.id !== itemId),
          },
        })),
      removeItemsFromAllWishlists: (itemIds) =>
        set((state) => {
          const purchasedIds = new Set(itemIds);
          return {
            wishlistByUser: Object.fromEntries(
              Object.entries(state.wishlistByUser).map(([userId, items]) => [
                userId,
                items.filter((item) => !purchasedIds.has(item.id)),
              ]),
            ),
          };
        }),
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
