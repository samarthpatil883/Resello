import { api, getApiErrorCode } from '../../lib/api';
import { useMarketplaceStore, type Item } from './marketplaceStore';

export async function refreshWishlist(userId: string) {
  const migrationKey = `resello:wishlist:migrated:${userId}`;
  if (!localStorage.getItem(migrationKey)) {
    const cachedItems = useMarketplaceStore.getState().wishlistByUser[userId] ?? [];
    for (const item of cachedItems) {
      try {
        await api.post('/wishlist', { listingId: item.id });
      } catch (error) {
        const code = getApiErrorCode(error);
        if (code !== 'ITEM_NOT_FOUND' && code !== 'WISHLIST_ITEM_EXISTS') throw error;
      }
    }
    localStorage.setItem(migrationKey, 'true');
  }

  const { data } = await api.get<{ items: Item[] }>('/wishlist');
  useMarketplaceStore.getState().setWishlist(userId, data.items);
  return data.items;
}

export async function saveWishlistItem(userId: string, item: Item) {
  const { data } = await api.post<{ item: Item }>('/wishlist', { listingId: item.id });
  const currentItems = useMarketplaceStore.getState().wishlistByUser[userId] ?? [];
  useMarketplaceStore
    .getState()
    .setWishlist(userId, [
      ...currentItems.filter((savedItem) => savedItem.id !== item.id),
      data.item,
    ]);
}

export async function deleteWishlistItem(userId: string, itemId: string) {
  await api.delete(`/wishlist/${encodeURIComponent(itemId)}`);
  useMarketplaceStore.getState().removeFromWishlist(userId, itemId);
}
