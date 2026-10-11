import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ConditionType } from '@resello/shared';
import { api, getApiErrorMessage } from '../../lib/api';
import type { Item } from './marketplaceStore';

interface BuyerLocation {
  latitude: number;
  longitude: number;
}

interface ItemGridProps {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ConditionType;
  newOnly?: boolean;
  maxDistanceKm?: number;
  buyerLocation?: BuyerLocation | null;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'nearest';
}

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const conditionLabels: Record<ConditionType, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

export function ItemGrid({
  query = '',
  category = '',
  minPrice,
  maxPrice,
  condition,
  newOnly = false,
  maxDistanceKm,
  buyerLocation = null,
  sort = 'newest',
}: ItemGridProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const locationRequired = (maxDistanceKm !== undefined || sort === 'nearest') && !buyerLocation;
  const invalidPriceRange =
    minPrice !== undefined &&
    maxPrice !== undefined &&
    (minPrice < 0 || maxPrice < 0 || minPrice > maxPrice);

  useEffect(() => {
    let active = true;
    if (invalidPriceRange) {
      setLoading(false);
      setItems([]);
      return () => {
        active = false;
      };
    }
    if (locationRequired) {
      setLoading(false);
      setItems([]);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    api
      .get<{ items: Item[] }>('/items', {
        params: {
          q: query.trim() || undefined,
          minPrice,
          maxPrice,
          condition,
          newOnly,
          maxDistanceKm,
          sort,
          ...(buyerLocation
            ? {
                latitude: buyerLocation.latitude,
                longitude: buyerLocation.longitude,
              }
            : {}),
        },
      })
      .then(({ data }) => {
        if (active) setItems(data.items);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    buyerLocation?.latitude,
    buyerLocation?.longitude,
    buyerLocation,
    condition,
    maxDistanceKm,
    maxPrice,
    minPrice,
    newOnly,
    query,
    reloadKey,
    sort,
    invalidPriceRange,
    locationRequired,
  ]);

  if (invalidPriceRange) {
    return (
      <p
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        role="alert"
      >
        Enter a valid price range to see matching items.
      </p>
    );
  }

  if (locationRequired) {
    return (
      <p
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        role="status"
      >
        Use the Distance filter to share your location before applying distance-based results.
      </p>
    );
  }

  if (loading) {
    return (
      <div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        aria-label="Loading items"
        aria-busy="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="aspect-square bg-slate-200" />
            <div className="grid gap-3 p-4">
              <div className="h-4 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-3 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100"
          onClick={() => setReloadKey((key) => key + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  const visibleItems = items.filter((item) => {
    const matchesCategory =
      !category ||
      `${item.title} ${item.description}`.toLowerCase().includes(category.toLowerCase());
    return matchesCategory;
  });

  if (visibleItems.length === 0) {
    const hasActiveFilters = Boolean(
      query.trim() ||
      category ||
      minPrice !== undefined ||
      maxPrice !== undefined ||
      condition ||
      newOnly ||
      maxDistanceKm !== undefined ||
      sort !== 'newest',
    );
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-800">
          {hasActiveFilters ? 'No items match these filters' : 'No items listed yet'}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {hasActiveFilters
            ? 'Try widening the price or distance range, changing the condition, or turning off New listings.'
            : 'When campus sellers publish an item, it will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-slate-500" aria-live="polite">
        {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'} found
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            to={`/buy/listing/${item.id}`}
            aria-label={`View ${item.title}`}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none"
          >
            <div className="aspect-square bg-slate-100 p-2">
              <img
                className="h-full w-full object-contain"
                src={api.getUri({ url: item.image_url })}
                alt={item.title}
                loading="lazy"
              />
            </div>
            <div className="grid gap-2 p-3 sm:p-4">
              <h2 className="line-clamp-2 min-h-10 font-semibold text-slate-900">{item.title}</h2>
              <p className="font-bold text-teal-800">{priceFormatter.format(item.price)}</p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {item.condition && (
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    {conditionLabels[item.condition]}
                  </span>
                )}
                {item.distance_km !== undefined && (
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-800">
                    {item.distance_km < 1
                      ? `${Math.round(item.distance_km * 1000)} m away`
                      : `${item.distance_km.toFixed(1)} km away`}
                  </span>
                )}
              </div>
              <p className="line-clamp-3 text-sm text-slate-600">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
