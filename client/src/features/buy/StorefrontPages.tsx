import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Laptop,
  MapPin,
  PackageOpen,
  Plus,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mode } from '@resello/shared';

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

      <section className="empty-marketplace">
        <span className="empty-icon">
          <PackageOpen size={28} />
        </span>
        <div>
          <p className="eyebrow">FRESH FINDS, FROM YOUR PEERS</p>
          <h2>The marketplace is just getting started.</h2>
          <p>
            New listings from your campus community will show up here. Have something to pass on? Be
            the first to list it.
          </p>
        </div>
        <Link className="button button-primary" to="/sell/listings/new">
          <Plus size={18} /> Sell an item
        </Link>
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
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const query = params.get('q');
  const category = params.get('category');
  return (
    <div className="storefront-page">
      <PageHeading
        kicker="DISCOVER ON CAMPUS"
        title={query ? `Results for “${query}”` : (category ?? 'Find your next good find')}
      />
      <div className="filter-chips" aria-label="Search filters">
        <span>
          <CheckCircle2 size={15} /> New listings
        </span>
        <span>Price</span>
        <span>Condition</span>
        <span>Distance</span>
        <span>Sort: newest</span>
      </div>
      <div className="search-empty">
        <Search size={25} />
        <h2>No listings yet</h2>
        <p>
          There aren’t any items to show right now. Try a different search, or check back as
          students add listings.
        </p>
        <Link className="button button-secondary" to="/buy">
          Back to Buy home
        </Link>
      </div>
    </div>
  );
}

export function BuyCartPage() {
  return (
    <EmptyAccountPage
      kicker="YOUR CART"
      title="Your cart is taking a breather."
      message="When you find something you like in the Buy marketplace, it’ll be right here."
      action="Explore items"
      to="/buy/search"
    />
  );
}

export function BuyOrdersPage() {
  return (
    <EmptyAccountPage
      kicker="BUY ORDERS"
      title="No purchases yet."
      message="Orders you place with campus sellers will appear here, with every update in one place."
      action="Find something to buy"
      to="/buy/search"
    />
  );
}

export function SellHomePage() {
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
          ['Active listings', '0'],
          ['Needs your action', '0'],
          ['Completed sales', '0'],
          ['Your rating', '—'],
        ].map(([label, value]) => (
          <article key={label} className="stat-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
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
  return (
    <EmptyAccountPage
      kicker="YOUR LISTINGS"
      title="Your items, your space."
      message="Listings you create will be organized here so you can keep track of what’s active, reserved or sold."
      action="Create a listing"
      to="/sell/listings/new"
      mode={Mode.SELL}
    />
  );
}

export function SellOrdersPage() {
  return (
    <EmptyAccountPage
      kicker="INCOMING ORDERS"
      title="All clear for now."
      message="When a student places an order for your listing, you’ll find it here and can confirm the handover."
      action="View your listings"
      to="/sell/listings"
      mode={Mode.SELL}
    />
  );
}

export function QuickListPage() {
  return (
    <EmptyAccountPage
      kicker="QUICK LIST"
      title="Your next listing starts here."
      message="The listing form and secure photo uploads are coming in the next marketplace gate."
      action="Back to seller home"
      to="/sell"
      mode={Mode.SELL}
    />
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
