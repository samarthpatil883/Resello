import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiErrorMessage } from '../../lib/api';
import type { Item } from '../buy/marketplaceStore';

const statuses = ['ACTIVE', 'PENDING', 'SOLD', 'REMOVED'] as const;
type ListingStatus = (typeof statuses)[number];

const statusLabels: Record<ListingStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Reserved',
  SOLD: 'Sold',
  REMOVED: 'Removed',
};

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function SellerListingsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeStatus, setActiveStatus] = useState<ListingStatus>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api
      .get<{ items: Item[] }>('/items/mine')
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
  }, [reloadKey]);

  const visibleItems = items.filter((item) => item.status === activeStatus);

  return (
    <div className="storefront-page storefront-page-sell">
      <div className="dashboard-welcome">
        <div>
          <p className="eyebrow">YOUR SELLER SPACE</p>
          <h1 tabIndex={-1}>Your listings</h1>
          <p>See and manage the items listed from your account.</p>
        </div>
        <Link to="/sell/listings/new" className="button button-sell">
          + List an item
        </Link>
      </div>

      <div
        className="flex gap-2 overflow-x-auto border-b border-slate-200"
        role="tablist"
        aria-label="Filter listings by status"
      >
        {statuses.map((status) => {
          const count = items.filter((item) => item.status === status).length;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={activeStatus === status}
              className={`min-h-12 whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition ${
                activeStatus === status
                  ? 'border-indigo-700 text-indigo-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setActiveStatus(status)}
            >
              {statusLabels[status]} <span className="ml-1 text-xs">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div
          className="grid gap-4 sm:grid-cols-2"
          aria-label="Loading your listings"
          aria-busy="true"
        >
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : error ? (
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
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-800">
            {items.length === 0
              ? 'You have not listed an item yet'
              : `No ${statusLabels[activeStatus].toLowerCase()} listings`}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {items.length === 0
              ? 'Items you publish from this account will appear here.'
              : 'Listings with this status will appear here.'}
          </p>
          {items.length === 0 && (
            <Link to="/sell/listings/new" className="button button-sell mt-5">
              + List your first item
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visibleItems.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <img
                className="aspect-square w-28 rounded-xl bg-slate-50 object-contain p-2"
                src={api.getUri({ url: item.image_url })}
                alt={item.title}
                loading="lazy"
              />
              <div className="grid content-start gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="line-clamp-2 font-semibold text-slate-900">{item.title}</h2>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                    {statusLabels[item.status]}
                  </span>
                </div>
                <p className="font-bold text-indigo-800">{priceFormatter.format(item.price)}</p>
                <p className="line-clamp-2 text-sm text-slate-600">{item.description}</p>
                <div className="flex flex-wrap gap-3 text-sm font-semibold">
                  <Link className="text-indigo-800 underline" to={`/buy/listing/${item.id}`}>
                    View listing
                  </Link>
                  {item.status === 'ACTIVE' ? (
                    <Link
                      className="text-indigo-800 underline"
                      to={`/sell/listings/${item.id}/edit`}
                    >
                      Edit listing
                    </Link>
                  ) : (
                    <span className="text-slate-500">
                      {item.status === 'PENDING'
                        ? 'Editing unavailable while reserved'
                        : 'Not editable'}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
