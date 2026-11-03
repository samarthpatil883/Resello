import {
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  BookOpen,
  ClipboardCheck,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  Compass,
  LocateFixed,
  Laptop,
  MapPin,
  PackageOpen,
  Plus,
  Sparkles,
  Star,
  Tag,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ConditionType,
  LISTING_CATEGORIES,
  ListingCategory,
  Mode,
  NotificationType,
  type Notification,
} from '@resello/shared';
import { api, getApiErrorMessage } from '../../lib/api';
import { CreateListingForm } from '../sell/CreateListingForm';
import { EditListingForm } from '../sell/EditListingForm';
import { SellerListingsPage } from '../sell/SellerListingsPage';
import { ItemGrid } from './ItemGrid';

export { BuyCartPage } from './MarketplacePages';
export { BuyOrdersPage, SellOrdersPage } from './OrderPages';
export { SharedProfilePage } from '../shared/ProfilePage';

const categoryIcons: Partial<Record<ListingCategory, typeof BookOpen>> = {
  [ListingCategory.BOOKS]: BookOpen,
  [ListingCategory.ELECTRONICS]: Laptop,
  [ListingCategory.LAB_DRAFTING]: Compass,
};
const featuredCategories = LISTING_CATEGORIES.slice(0, 4);

function CategoryCards({
  categories,
}: {
  categories: readonly (typeof LISTING_CATEGORIES)[number][];
}) {
  return (
    <div className="category-grid">
      {categories.map(({ value, label }) => {
        const Icon = categoryIcons[value] ?? Sparkles;
        return (
          <Link key={value} className="category-card" to={`/buy/search?category=${value}`}>
            <span className="category-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <span>{label}</span>
            <ArrowRight size={15} className="category-arrow" aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}

function PageHeading({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      {kicker && <p className="eyebrow">{kicker}</p>}
      <h1 tabIndex={-1}>{title}</h1>
      {children}
    </div>
  );
}

export function BuyHomePage() {
  const navigate = useNavigate();
  return (
    <div className="storefront-page">
      <section className="campus-banner">
        <div className="campus-banner-copy">
          <span className="banner-eyebrow">
            <MapPin size={14} /> PCCOE community
          </span>
          <h1 tabIndex={-1}>
            Your next favourite
            <br />
            <span>is already nearby.</span>
          </h1>
          <p>Student-to-student finds, shared right here on campus.</p>
          <button className="button button-light" onClick={() => navigate('/buy/search')}>
            Explore the marketplace <ArrowRight size={17} />
          </button>
        </div>
        <div className="campus-banner-art" aria-hidden="true">
          <span className="banner-doodle banner-doodle-one">✳</span>
          <span className="banner-doodle banner-doodle-two">✦</span>
          <span className="banner-pin banner-pin-one">
            <MapPin size={22} />
          </span>
          <span className="banner-pin banner-pin-two">
            <MapPin size={18} />
          </span>
          <div className="banner-snapshot banner-snapshot-study">
            <img src="/images/buy-hero-lab.png" alt="" />
          </div>
          <div className="banner-phone">
            <img src="/images/buy-hero-marketplace.png" alt="" />
          </div>
          <div className="banner-snapshot banner-snapshot-campus">
            <img src="/images/buy-hero-campus.png" alt="" />
          </div>
          <div className="banner-float banner-float-nearby">
            <span>Nearby</span>
            <b>
              <MapPin size={13} /> PCCOE campus
            </b>
          </div>
          <div className="banner-float banner-float-books">
            <BookOpen size={15} />
            <span>
              Books
              <br />
              <b>Free!</b>
            </span>
          </div>
          <div className="banner-float banner-float-distance">
            <MapPin size={15} />
            <span>
              Distance
              <br />
              <b>2 mins away</b>
            </span>
          </div>
        </div>
      </section>

      <section className="category-section" aria-labelledby="category-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BROWSE BY CATEGORY</p>
            <h2 id="category-title">What are you looking for?</h2>
          </div>
          <Link to="/buy/categories" className="subtle-link">
            See all <ArrowRight size={15} />
          </Link>
        </div>
        <CategoryCards categories={featuredCategories} />
      </section>

      <section className="category-section" aria-labelledby="just-listed-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FRESH FINDS, FROM YOUR PEERS</p>
            <h2 id="just-listed-title">Just listed</h2>
          </div>
          <Link to="/buy/search" className="subtle-link">
            See all <ArrowRight size={15} />
          </Link>
        </div>
        <ItemGrid />
      </section>

      <Link to="/sell" className="sell-nudge">
        <span className="nudge-icon">
          <Tag size={20} />
        </span>
        <span>
          <b>Done with last semester’s books?</b>
          <small>Give them a new home on campus.</small>
        </span>
        <span className="nudge-action">
          Start selling <ArrowRight size={16} />
        </span>
      </Link>
    </div>
  );
}

export function BuyCategoriesPage() {
  return (
    <div className="storefront-page">
      <PageHeading kicker="BROWSE THE MARKETPLACE" title="All categories" />
      <p className="mb-5 text-sm text-slate-600">
        Explore every category of items listed by students on campus.
      </p>
      <CategoryCards categories={LISTING_CATEGORIES} />
    </div>
  );
}

export function BuySearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const categoryValue = searchParams.get('category');
  const category = Object.values(ListingCategory).find((value) => value === categoryValue);
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const conditionValue = searchParams.get('condition');
  const condition = Object.values(ConditionType).find((value) => value === conditionValue);
  const distanceValue = Number(searchParams.get('maxDistanceKm'));
  const maxDistanceKm = [1, 5, 10, 25].includes(distanceValue) ? distanceValue : undefined;
  const sortValue = searchParams.get('sort');
  const sort = ['newest', 'price_asc', 'price_desc', 'nearest'].includes(sortValue ?? '')
    ? (sortValue as 'newest' | 'price_asc' | 'price_desc' | 'nearest')
    : 'newest';
  const newOnly = searchParams.get('newOnly') !== 'false';
  const [openFilter, setOpenFilter] = useState<'price' | 'condition' | 'distance' | 'sort' | null>(
    null,
  );
  const [buyerLocation, setBuyerLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [priceMinimum, setPriceMinimum] = useState(minPrice);
  const [priceMaximum, setPriceMaximum] = useState(maxPrice);
  const conditionLabels: Record<ConditionType, string> = {
    [ConditionType.NEW]: 'New',
    [ConditionType.LIKE_NEW]: 'Like new',
    [ConditionType.GOOD]: 'Good',
    [ConditionType.FAIR]: 'Fair',
    [ConditionType.POOR]: 'Poor',
  };

  useEffect(() => {
    setPriceMinimum(minPrice);
    setPriceMaximum(maxPrice);
  }, [minPrice, maxPrice]);

  function updateFilter(name: string, value: string | null) {
    updateFilters({ [name]: value });
  }

  function updateFilters(values: Record<string, string | null>) {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(values).forEach(([name, value]) => {
      if (value === null || value === '') nextParams.delete(name);
      else nextParams.set(name, value);
    });
    setSearchParams(nextParams);
  }

  function requestBuyerLocation(
    onSuccess: (point: { latitude: number; longitude: number }) => void,
    onDenied: () => void,
  ) {
    setLocationError(null);
    if (!navigator.geolocation) {
      setBuyerLocation(null);
      setLocationError(
        'Location is not supported by this browser. Showing results without distance filtering.',
      );
      onDenied();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { latitude: coords.latitude, longitude: coords.longitude };
        setBuyerLocation(point);
        onSuccess(point);
      },
      () => {
        setBuyerLocation(null);
        setLocationError(
          'Location access was unavailable. Showing results without distance filtering.',
        );
        onDenied();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function applyPriceRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minimum = priceMinimum.trim() ? Number(priceMinimum) : undefined;
    const maximum = priceMaximum.trim() ? Number(priceMaximum) : undefined;
    if (
      (minimum !== undefined && (!Number.isFinite(minimum) || minimum < 0)) ||
      (maximum !== undefined && (!Number.isFinite(maximum) || maximum < 0))
    ) {
      return;
    }
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    if (minimum === undefined) nextParams.delete('minPrice');
    else nextParams.set('minPrice', String(minimum));
    if (maximum === undefined) nextParams.delete('maxPrice');
    else nextParams.set('maxPrice', String(maximum));
    setSearchParams(nextParams);
    setOpenFilter(null);
  }

  function changeDistance(value: string) {
    if (!value) {
      updateFilter('maxDistanceKm', null);
      setOpenFilter(null);
      return;
    }
    updateFilter('maxDistanceKm', value);
    setOpenFilter(null);
    if (!buyerLocation) {
      requestBuyerLocation(
        () => undefined,
        () =>
          updateFilters({
            maxDistanceKm: null,
            ...(sort === 'nearest' ? { sort: null } : {}),
          }),
      );
    }
  }

  function changeSort(value: 'newest' | 'price_asc' | 'price_desc' | 'nearest') {
    updateFilter('sort', value === 'newest' ? null : value);
    setOpenFilter(null);
    if (value === 'nearest' && !buyerLocation) {
      requestBuyerLocation(
        () => undefined,
        () => updateFilters({ maxDistanceKm: null, sort: null }),
      );
    }
  }

  const priceLabel = minPrice || maxPrice ? `₹${minPrice || '0'}–${maxPrice || '∞'}` : 'Price';
  const distanceLabel = maxDistanceKm ? `Within ${maxDistanceKm} km` : 'Distance';
  const hasInvalidPriceRange =
    priceMinimum !== '' && priceMaximum !== '' && Number(priceMinimum) > Number(priceMaximum);
  const hasInvalidUrlPriceRange =
    (minPrice !== '' && (!Number.isFinite(Number(minPrice)) || Number(minPrice) < 0)) ||
    (maxPrice !== '' && (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) < 0)) ||
    (minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice));

  return (
    <div className="storefront-page">
      <PageHeading
        kicker="DISCOVER ON CAMPUS"
        title={
          query
            ? `Results for “${query}”`
            : category
              ? (LISTING_CATEGORIES.find((item) => item.value === category)?.label ??
                'Find your next good find')
              : 'Find your next good find'
        }
      />
      <div className="filter-chips" aria-label="Search filters">
        <button
          type="button"
          className={`filter-chip${newOnly ? ' filter-chip-active' : ''}`}
          aria-pressed={newOnly}
          title="Show items listed in the past seven days"
          onClick={() => {
            setOpenFilter(null);
            updateFilter('newOnly', newOnly ? 'false' : 'true');
          }}
        >
          <CheckCircle2 size={16} /> New listings
        </button>
        <details className="filter-dropdown" open={openFilter === 'price'}>
          <summary
            className={`filter-chip${minPrice || maxPrice ? ' filter-chip-active' : ''}`}
            aria-expanded={openFilter === 'price'}
            onClick={(event) => {
              event.preventDefault();
              setOpenFilter((current) => (current === 'price' ? null : 'price'));
            }}
          >
            {priceLabel} <ChevronDown size={15} />
          </summary>
          <form className="filter-panel price-filter-panel" onSubmit={applyPriceRange}>
            <strong>Price range</strong>
            <label>
              Minimum (₹)
              <input
                type="number"
                min="0"
                step="1"
                value={priceMinimum}
                onChange={(event) => setPriceMinimum(event.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              Maximum (₹)
              <input
                type="number"
                min="0"
                step="1"
                value={priceMaximum}
                onChange={(event) => setPriceMaximum(event.target.value)}
                placeholder="Any"
              />
            </label>
            {hasInvalidPriceRange && (
              <p className="filter-error" role="alert">
                Minimum price must not exceed maximum price.
              </p>
            )}
            <button type="submit" className="button button-primary" disabled={hasInvalidPriceRange}>
              Apply price
            </button>
            {(minPrice || maxPrice) && (
              <button
                type="button"
                className="filter-clear-button"
                onClick={() => {
                  setPriceMinimum('');
                  setPriceMaximum('');
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete('minPrice');
                  nextParams.delete('maxPrice');
                  setSearchParams(nextParams);
                  setOpenFilter(null);
                }}
              >
                Clear price
              </button>
            )}
          </form>
        </details>
        <details className="filter-dropdown" open={openFilter === 'condition'}>
          <summary
            className={`filter-chip${condition ? ' filter-chip-active' : ''}`}
            aria-expanded={openFilter === 'condition'}
            onClick={(event) => {
              event.preventDefault();
              setOpenFilter((current) => (current === 'condition' ? null : 'condition'));
            }}
          >
            {condition ? conditionLabels[condition] : 'Condition'} <ChevronDown size={15} />
          </summary>
          <div className="filter-panel">
            <label>
              Item condition
              <select
                value={condition ?? ''}
                onChange={(event) => {
                  updateFilter('condition', event.target.value || null);
                  setOpenFilter(null);
                }}
              >
                <option value="">Any condition</option>
                {Object.values(ConditionType).map((value) => (
                  <option key={value} value={value}>
                    {conditionLabels[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <details className="filter-dropdown" open={openFilter === 'distance'}>
          <summary
            className={`filter-chip${maxDistanceKm ? ' filter-chip-active' : ''}`}
            aria-expanded={openFilter === 'distance'}
            onClick={(event) => {
              event.preventDefault();
              setOpenFilter((current) => (current === 'distance' ? null : 'distance'));
            }}
          >
            <MapPin size={15} /> {distanceLabel} <ChevronDown size={15} />
          </summary>
          <div className="filter-panel">
            <label>
              Maximum distance
              <select
                value={maxDistanceKm ?? ''}
                onChange={(event) => changeDistance(event.target.value)}
              >
                <option value="">Any distance</option>
                {[1, 5, 10, 25].map((distance) => (
                  <option key={distance} value={distance}>
                    Within {distance} km
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="filter-location-button"
              onClick={() =>
                requestBuyerLocation(
                  () => setLocationError(null),
                  () => {
                    updateFilters({
                      maxDistanceKm: null,
                      ...(sort === 'nearest' ? { sort: null } : {}),
                    });
                  },
                )
              }
            >
              <LocateFixed size={16} />
              {buyerLocation ? 'Refresh my location' : 'Use my location'}
            </button>
            <p className="filter-help">
              Your location is used only to calculate nearby results and is not saved to your
              profile.
            </p>
            {locationError && (
              <p className="filter-error" role="alert">
                {locationError}
              </p>
            )}
          </div>
        </details>
        <details className="filter-dropdown" open={openFilter === 'sort'}>
          <summary
            className="filter-chip"
            aria-expanded={openFilter === 'sort'}
            onClick={(event) => {
              event.preventDefault();
              setOpenFilter((current) => (current === 'sort' ? null : 'sort'));
            }}
          >
            Sort:{' '}
            {sort === 'newest'
              ? 'newest'
              : sort === 'price_asc'
                ? 'price low to high'
                : sort === 'price_desc'
                  ? 'price high to low'
                  : 'nearest'}
            <ChevronDown size={15} />
          </summary>
          <div className="filter-panel">
            <label>
              Sort items
              <select
                value={sort}
                onChange={(event) =>
                  changeSort(
                    event.target.value as 'newest' | 'price_asc' | 'price_desc' | 'nearest',
                  )
                }
              >
                <option value="newest">Newest first</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="nearest">Nearest first</option>
              </select>
            </label>
          </div>
        </details>
      </div>
      {locationError && (
        <p className="location-filter-notice" role="status">
          {locationError}
        </p>
      )}
      {hasInvalidUrlPriceRange && (
        <p className="filter-error" role="alert">
          This link contains an invalid price filter. Update the range to continue.
        </p>
      )}
      {((searchParams.has('maxDistanceKm') && maxDistanceKm === undefined) ||
        (searchParams.has('sort') && sortValue !== sort)) && (
        <p className="filter-error" role="alert">
          An unsupported filter in this link was ignored.
        </p>
      )}
      {conditionValue && !condition && (
        <p className="filter-error" role="alert">
          An unsupported condition filter in this link was ignored.
        </p>
      )}
      {categoryValue && !category && (
        <p className="filter-error" role="alert">
          An unsupported category filter in this link was ignored.
        </p>
      )}
      <ItemGrid
        query={query}
        category={category}
        minPrice={
          minPrice && Number.isFinite(Number(minPrice)) && Number(minPrice) >= 0
            ? Number(minPrice)
            : undefined
        }
        maxPrice={
          maxPrice && Number.isFinite(Number(maxPrice)) && Number(maxPrice) >= 0
            ? Number(maxPrice)
            : undefined
        }
        condition={condition}
        newOnly={newOnly}
        maxDistanceKm={maxDistanceKm}
        buyerLocation={maxDistanceKm !== undefined || sort === 'nearest' ? buyerLocation : null}
        sort={sort}
      />
    </div>
  );
}

export function SellHomePage() {
  const [stats, setStats] = useState<{
    activeListings: number;
    needsYourAction: number;
    completedSales: number;
    averageRating: number | null;
    ratingCount: number;
  } | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsReloadKey, setStatsReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setStatsError(null);
    api
      .get<{
        activeListings: number;
        needsYourAction: number;
        completedSales: number;
        averageRating: number | null;
        ratingCount: number;
      }>('/me/seller-stats')
      .then(({ data }) => {
        if (active) setStats(data);
      })
      .catch((requestError: unknown) => {
        if (active) setStatsError(getApiErrorMessage(requestError));
      });
    return () => {
      active = false;
    };
  }, [statsReloadKey]);

  return (
    <div className="storefront-page seller-dashboard-page">
      <div className="dashboard-welcome">
        <div>
          <p className="eyebrow">YOUR SELLER SPACE</p>
          <h1 tabIndex={-1}>Good things deserve another life.</h1>
          <p>Your listings, orders and campus community — all in one place.</p>
        </div>
        <Link to="/sell/listings/new" className="button button-sell dashboard-list-button">
          <Plus size={18} /> List an item
        </Link>
      </div>
      <section className="seller-performance" aria-labelledby="seller-performance-title">
        <div className="seller-performance-heading">
          <h2 id="seller-performance-title">Your space at a glance</h2>
          <p>Track your seller performance</p>
        </div>
        <div className="seller-stats" aria-label="Seller summary">
          <article className="stat-card">
            <div className="stat-card-heading">
              <span>Active listings</span>
              <ClipboardCheck aria-hidden="true" />
            </div>
            <strong aria-live="polite">
              {stats ? stats.activeListings : statsError ? '—' : '…'}
            </strong>
          </article>
          <article className="stat-card">
            <div className="stat-card-heading">
              <span>Needs your action</span>
              <CircleCheck aria-hidden="true" />
            </div>
            <div className="stat-card-value">
              <strong aria-live="polite">
                {stats ? stats.needsYourAction : statsError ? '—' : '…'}
              </strong>
              {stats?.needsYourAction === 0 && <span className="all-caught-up">All caught up</span>}
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-card-heading">
              <span>Completed sales</span>
              <BadgePercent aria-hidden="true" />
            </div>
            <strong aria-live="polite">
              {stats ? stats.completedSales : statsError ? '—' : '…'}
            </strong>
          </article>
          <article className="stat-card stat-card-rating">
            <div className="stat-card-heading">
              <span>Your rating</span>
              <span className="rating-stars" aria-label="Five stars">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} aria-hidden="true" />
                ))}
              </span>
            </div>
            <strong aria-live="polite">
              {stats
                ? stats.averageRating === null
                  ? 'No ratings yet'
                  : stats.averageRating.toFixed(1)
                : statsError
                  ? '—'
                  : '…'}
            </strong>
            {stats?.averageRating !== null && stats && (
              <small>
                {stats.ratingCount} review{stats.ratingCount === 1 ? '' : 's'}
              </small>
            )}
          </article>
        </div>
      </section>
      {statsError ? (
        <section className="seller-empty" aria-label="Seller statistics error">
          <p role="alert" className="text-sm text-red-800">
            {statsError}
          </p>
          <button
            type="button"
            className="button button-sell"
            onClick={() => setStatsReloadKey((key) => key + 1)}
          >
            Retry loading dashboard
          </button>
        </section>
      ) : stats?.activeListings ? (
        <section className="seller-empty seller-listings-summary">
          <span className="empty-icon empty-icon-sell">
            <Tag size={28} />
          </span>
          <div>
            <p className="eyebrow">YOUR ITEMS ARE LIVE</p>
            <h2>
              {stats.activeListings} active listing{stats.activeListings === 1 ? '' : 's'}
            </h2>
            <p>Manage your listings or publish another unique item for campus buyers.</p>
          </div>
          <Link className="button button-secondary seller-listings-action" to="/sell/listings">
            View my listings <ArrowUpRight size={16} />
          </Link>
        </section>
      ) : stats ? (
        <section className="seller-empty">
          <span className="empty-icon empty-icon-sell">
            <PackageOpen size={28} />
          </span>
          <div>
            <p className="eyebrow">A FRESH START</p>
            <h2>Your seller space is ready.</h2>
            <p>
              List one unique item at a time. Your first listing will be visible to other verified
              PCCOE students.
            </p>
          </div>
          <Link className="button button-sell" to="/sell/listings/new">
            <Plus size={18} /> Sell your first item
          </Link>
        </section>
      ) : null}
      <Link to="/buy" className="mode-crosslink">
        <BookOpen size={19} />
        <span>
          <b>Looking for a campus find?</b>
          <small>Explore what other students are sharing.</small>
        </span>
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}

export function SellListingsPage() {
  return <SellerListingsPage />;
}

export function QuickListPage() {
  const { id } = useParams();
  return (
    <div className="storefront-page storefront-page-sell">
      <PageHeading
        kicker={id ? 'MANAGE LISTING' : 'QUICK LIST'}
        title={id ? 'Edit listing' : 'List an item'}
      >
        <p className="auth-description">
          {id
            ? 'Update the details and photos for your active listing.'
            : 'Add one unique item for other verified PCCOE students to discover.'}
        </p>
      </PageHeading>
      {id ? <EditListingForm itemId={id} /> : <CreateListingForm />}
    </div>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<{
        notifications: Notification[];
        unreadCount: number;
        totalPages: number;
      }>('/notifications', { params: { page: 1, limit: 30 } })
      .then(({ data }) => {
        if (!active) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setPage(1);
        setTotalPages(data.totalPages);
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

  async function openNotification(notification: Notification) {
    setBusy(true);
    setError(null);
    try {
      if (!notification.readAt) {
        await api.patch(`/notifications/${notification.id}/read`);
        const readAt = new Date().toISOString();
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, readAt } : item)),
        );
        setUnreadCount((count) => Math.max(count - 1, 0));
        window.dispatchEvent(new Event('resello:notifications-changed'));
      }
      if (notification.type === NotificationType.NEW_LISTING && notification.relatedId) {
        navigate(`/buy/listing/${notification.relatedId}`);
      } else if (notification.type === NotificationType.LISTING_REMOVED && notification.relatedId) {
        navigate('/sell/listings');
      } else if (notification.type === NotificationType.NEW_REVIEW) {
        navigate('/sell/reviews');
      } else {
        navigate(notification.mode === Mode.BUY ? '/buy/orders' : '/sell/orders');
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function markAllAsRead() {
    setBusy(true);
    setError(null);
    try {
      await api.patch('/notifications/read-all');
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      setUnreadCount(0);
      window.dispatchEvent(new Event('resello:notifications-changed'));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    const nextPage = page + 1;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.get<{
        notifications: Notification[];
        unreadCount: number;
        totalPages: number;
      }>('/notifications', { params: { page: nextPage, limit: 30 } });
      setNotifications((current) => [...current, ...data.notifications]);
      setUnreadCount(data.unreadCount);
      setPage(nextPage);
      setTotalPages(data.totalPages);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="storefront-page">
      <PageHeading kicker="UPDATES" title="Notifications">
        <p className="text-sm text-slate-600">
          Purchase, sale, listing, review, and marketplace updates for your account.
        </p>
      </PageHeading>
      {unreadCount > 0 && (
        <button
          type="button"
          className="button button-secondary mb-4"
          onClick={() => void markAllAsRead()}
          disabled={busy}
        >
          Mark all as read ({unreadCount})
        </button>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p role="alert">{error}</p>
          <button
            type="button"
            className="mt-2 font-semibold underline"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p className="rounded-xl bg-white p-5 text-sm text-slate-600" role="status">
          Loading notifications…
        </p>
      ) : notifications.length === 0 ? (
        <div className="search-empty">
          <PackageOpen size={25} />
          <h2>You’re all caught up.</h2>
          <p>Order and marketplace updates will appear here.</p>
          <Link className="button button-secondary" to="/buy">
            Back to home
          </Link>
        </div>
      ) : (
        <div className="grid gap-3" aria-label="Your notifications">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={`w-full rounded-2xl border p-4 text-left transition hover:border-teal-300 hover:shadow-sm ${
                notification.readAt ? 'border-slate-200 bg-white' : 'border-teal-200 bg-teal-50/70'
              }`}
              onClick={() => void openNotification(notification)}
              disabled={busy}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block font-semibold text-slate-900">{notification.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{notification.body}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        notification.mode === Mode.BUY
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {notification.mode === Mode.BUY ? 'Buy' : 'Sell'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(notification.createdAt))}
                    </span>
                  </span>
                </span>
                {!notification.readAt && (
                  <span className="shrink-0 rounded-full bg-teal-700 px-2 py-1 text-xs font-semibold text-white">
                    New
                  </span>
                )}
              </span>
            </button>
          ))}
          {page < totalPages && (
            <button
              type="button"
              className="button button-secondary justify-self-center"
              onClick={() => void loadMore()}
              disabled={busy}
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
