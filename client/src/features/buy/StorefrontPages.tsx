import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Compass,
  LocateFixed,
  Laptop,
  MapPin,
  PackageOpen,
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ConditionType, Mode } from '@resello/shared';
import { api, getApiErrorMessage } from '../../lib/api';
import { CreateListingForm } from '../sell/CreateListingForm';
import { EditListingForm } from '../sell/EditListingForm';
import { SellerListingsPage } from '../sell/SellerListingsPage';
import { ItemGrid } from './ItemGrid';

export { BuyCartPage } from './MarketplacePages';
export { BuyOrdersPage, SellOrdersPage } from './OrderPages';

const categories = [
  { name: 'Books', icon: BookOpen },
  { name: 'Electronics', icon: Laptop },
  { name: 'Lab & drafting', icon: Compass },
  { name: 'Other finds', icon: Sparkles },
];

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
        <div className="campus-banner-orbit" aria-hidden="true">
          <span className="orbit-book">Aa</span>
          <span className="orbit-star">✳</span>
          <span className="orbit-dot" />
        </div>
      </section>

      <section className="category-section" aria-labelledby="category-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BROWSE BY CATEGORY</p>
            <h2 id="category-title">What are you looking for?</h2>
          </div>
          <Link to="/buy/search" className="subtle-link">
            See all <ArrowRight size={15} />
          </Link>
        </div>
        <div className="category-grid">
          {categories.map(({ name, icon: Icon }) => (
            <Link
              key={name}
              className="category-card"
              to={`/buy/search?category=${encodeURIComponent(name)}`}
            >
              <span className="category-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <span>{name}</span>
              <ArrowRight size={15} className="category-arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
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

export function BuySearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
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
        title={query ? `Results for “${query}”` : category || 'Find your next good find'}
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
    <div className="storefront-page">
      <div className="dashboard-welcome">
        <div>
          <p className="eyebrow">YOUR SELLER SPACE</p>
          <h1 tabIndex={-1}>
            Good things deserve
            <br />
            <span>another life.</span>
          </h1>
          <p>Your listings, orders and campus community — all in one place.</p>
        </div>
        <Link to="/sell/listings/new" className="button button-sell">
          <Plus size={18} /> List an item
        </Link>
      </div>
      <section className="seller-stats" aria-label="Seller summary">
        {[
          ['Active listings', stats ? String(stats.activeListings) : statsError ? '—' : '…'],
          ['Needs your action', stats ? String(stats.needsYourAction) : statsError ? '—' : '…'],
          ['Completed sales', stats ? String(stats.completedSales) : statsError ? '—' : '…'],
          [
            'Your rating',
            stats
              ? stats.averageRating === null
                ? 'No ratings yet'
                : `${stats.averageRating.toFixed(1)} (${stats.ratingCount})`
              : statsError
                ? '—'
                : '…',
          ],
        ].map(([label, value]) => (
          <article key={label} className="stat-card">
            <span>{label}</span>
            <strong aria-live="polite">{value}</strong>
          </article>
        ))}
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
        <section className="seller-empty">
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
          <Link className="button button-sell" to="/sell/listings">
            View my listings
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

export function SharedProfilePage({
  onLogout,
  logoutError,
}: {
  onLogout: () => void;
  logoutError: string | null;
}) {
  return (
    <div className="storefront-page">
      <PageHeading kicker="YOUR RESELLO ACCOUNT" title="Your profile" />
      <section className="profile-card">
        <span className="profile-verification">
          <CheckCircle2 size={19} /> Verified PCCOE student
        </span>
        <p>Your college account is verified. Your Buy and Sell spaces share one account.</p>
        <div className="profile-notice">
          Account settings and profile editing are being added with the next marketplace gate.
        </div>
        {logoutError && (
          <p className="form-error" role="alert">
            {logoutError}
          </p>
        )}
        <button className="button button-secondary" type="button" onClick={onLogout}>
          Log out
        </button>
      </section>
    </div>
  );
}

export function NotificationsPage() {
  return (
    <EmptyAccountPage
      kicker="UPDATES"
      title="You’re all caught up."
      message="Order and marketplace updates will appear here."
      action="Back to home"
      to="/buy"
    />
  );
}

function EmptyAccountPage({
  kicker,
  title,
  message,
  action,
  to,
  mode = Mode.BUY,
}: {
  kicker: string;
  title: string;
  message: string;
  action: string;
  to: string;
  mode?: Mode;
}) {
  return (
    <div className={`storefront-page storefront-page-${mode.toLowerCase()}`}>
      <PageHeading kicker={kicker} title={title} />
      <div className="search-empty">
        <PackageOpen size={25} />
        <p>{message}</p>
        <Link
          className={`button ${mode === Mode.SELL ? 'button-sell' : 'button-secondary'}`}
          to={to}
        >
          {action}
        </Link>
      </div>
    </div>
  );
}
