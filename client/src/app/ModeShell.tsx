import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Bell,
  BookOpen,
  ClipboardList,
  Heart,
  LayoutDashboard,
  List,
  LogOut,
  Plus,
  Search,
  ShoppingBag,
  Store,
  UserRound,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Mode } from '@resello/shared';
import { api } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { useMarketplaceStore } from '../features/buy/marketplaceStore';

const modes = [Mode.BUY, Mode.SELL] as const;

function savedRoute(mode: Mode) {
  return sessionStorage.getItem(`resello:lastRoute:${mode}`) ?? `/${mode.toLowerCase()}`;
}

function ModeSwitcher({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : modes.length - 1)) % modes.length;
    refs.current[nextIndex]?.focus();
  }

  return (
    <div
      className={`mode-switcher mode-switcher-${mode.toLowerCase()}`}
      role="tablist"
      aria-label="Choose storefront"
    >
      {modes.map((item, index) => {
        const active = item === mode;
        const Icon = item === Mode.BUY ? ShoppingBag : Store;
        return (
          <button
            key={item}
            ref={(element) => {
              refs.current[index] = element;
            }}
            className={`mode-tab${active ? ' mode-tab-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onChange(item)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{item === Mode.BUY ? 'Buy' : 'Sell'}</span>
          </button>
        );
      })}
    </div>
  );
}

function SearchBox({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(() => sessionStorage.getItem(`resello:search:${mode}`) ?? '');
  const base = `/${mode.toLowerCase()}`;

  useEffect(() => {
    sessionStorage.setItem(`resello:search:${mode}`, value);
  }, [mode, value]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(`${base}/search${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`);
  }

  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <Search size={18} aria-hidden="true" />
      <input
        aria-label={mode === Mode.BUY ? 'Search items' : 'Search my listings'}
        placeholder={mode === Mode.BUY ? 'Search books, calculators…' : 'Search my listings…'}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={() => setValue('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </form>
  );
}

function PrimaryNavigation({ mode, onSwitch }: { mode: Mode; onSwitch: (mode: Mode) => void }) {
  const items =
    mode === Mode.BUY
      ? [
          { to: '/buy', label: 'Home', icon: BookOpen },
          { to: '/buy/search', label: 'Search', icon: Search },
          { to: '/buy/cart', label: 'Cart', icon: ShoppingBag },
          { to: '/buy/orders', label: 'Orders', icon: ClipboardList },
          { to: '/profile', label: 'Me', icon: UserRound },
        ]
      : [
          { to: '/sell', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/sell/listings', label: 'Listings', icon: List },
          { to: '/sell/listings/new', label: 'Sell item', icon: Plus, raised: true },
          { to: '/sell/orders', label: 'Orders', icon: ClipboardList },
          { to: '/profile', label: 'Me', icon: UserRound },
        ];

  return (
    <nav
      className={`bottom-navigation bottom-navigation-${mode.toLowerCase()}`}
      aria-label={`${mode === Mode.BUY ? 'Buy' : 'Sell'} navigation`}
    >
      {items.map(({ to, label, icon: Icon, raised }) => (
        <NavLink
          key={label}
          className={({ isActive }) =>
            `bottom-nav-link${raised ? ' bottom-nav-raised' : ''}${isActive ? ' bottom-nav-active' : ''}`
          }
          to={to}
          end={to === '/buy' || to === '/sell'}
          aria-label={label}
        >
          <span className="bottom-nav-icon">
            <Icon size={raised ? 22 : 19} aria-hidden="true" />
          </span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
      <button
        className="desktop-mode-shortcut"
        type="button"
        onClick={() => onSwitch(mode === Mode.BUY ? Mode.SELL : Mode.BUY)}
      >
        Switch to {mode === Mode.BUY ? 'Sell' : 'Buy'}
      </button>
    </nav>
  );
}

export function ModeShell({ mode, children }: { mode: Mode; children?: ReactNode }) {
  const { user, logout } = useAuth();
  const wishlistCount = useMarketplaceStore(
    (state) => state.wishlistByUser[user?._id ?? '']?.length ?? 0,
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (location.pathname.startsWith(`/${mode.toLowerCase()}`)) {
      sessionStorage.setItem(`resello:lastRoute:${mode}`, `${location.pathname}${location.search}`);
    }
  }, [location.pathname, location.search, mode]);

  useEffect(() => {
    const key = `resello:scroll:${mode}`;
    const savedPosition = Number(sessionStorage.getItem(key) ?? '0');
    let currentPosition = savedPosition;
    const saveScroll = () => {
      currentPosition = window.scrollY;
      sessionStorage.setItem(key, String(currentPosition));
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, savedPosition));
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', saveScroll);
      sessionStorage.setItem(key, String(currentPosition));
    };
  }, [location.pathname, mode]);

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('main h1');
    if (!heading) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
    const timer = window.setTimeout(() => heading.focus({ preventScroll: true }), delay);
    return () => window.clearTimeout(timer);
  }, [location.pathname, mode]);

  async function switchMode(nextMode: Mode) {
    if (nextMode === mode) return;
    sessionStorage.setItem(`resello:scroll:${mode}`, String(window.scrollY));
    localStorage.setItem('resello:lastMode', nextMode);
    setSearchError(null);
    navigate(savedRoute(nextMode));
    try {
      await api.patch('/me/mode', { mode: nextMode });
    } catch (error) {
      try {
        await api.patch('/me/mode', { mode: nextMode });
      } catch (retryError) {
        console.error('Could not save storefront preference:', retryError);
      }
      console.debug('Storefront preference will use the locally saved choice:', error);
    }
  }

  async function signOut() {
    try {
      await logout();
      navigate('/welcome', { replace: true });
    } catch (error) {
      setSearchError('Could not sign out right now. Check your connection and try again.');
      console.error('Sign out failed:', error);
    }
  }

  return (
    <div className={`app-shell app-shell-${mode.toLowerCase()}`}>
      <header className="app-header">
        <div className="header-main">
          <Link
            className="header-brand"
            to={mode === Mode.BUY ? '/buy' : '/sell'}
            aria-label="Resello home"
          >
            <img className="header-brand-image" src="/resello-logo.png" alt="Resello" />
          </Link>
          <ModeSwitcher mode={mode} onChange={(nextMode) => void switchMode(nextMode)} />
          <SearchBox key={mode} mode={mode} />
          <div className="header-actions">
            <Link to="/notifications" className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </Link>
            <Link
              to="/buy/wishlist"
              className="icon-button wishlist-header-button"
              aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} saved ${wishlistCount === 1 ? 'item' : 'items'}` : ''}`}
              title="Wishlist"
            >
              <Heart size={19} aria-hidden="true" />
              {wishlistCount > 0 && (
                <span className="wishlist-count" aria-hidden="true">
                  {wishlistCount > 99 ? '99+' : wishlistCount}
                </span>
              )}
            </Link>
            <Link to="/profile" className="header-user" aria-label="My profile">
              <span className="avatar">{user?.name.slice(0, 1).toUpperCase() ?? 'U'}</span>
              <span className="header-user-name">{user?.name.split(' ')[0] ?? 'Me'}</span>
            </Link>
            <button
              type="button"
              className="icon-button"
              aria-label="Log out"
              title="Log out"
              onClick={() => void signOut()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div className="mobile-campus-line">
          <span className="campus-dot" /> PCCOE campus{' '}
          <span className="campus-email">{user?.email}</span>
        </div>
      </header>
      <main className="app-content">
        {children ?? <Outlet />}
        {searchError && (
          <p className="inline-notice" role="alert">
            {searchError}
          </p>
        )}
      </main>
      <PrimaryNavigation mode={mode} onSwitch={(nextMode) => void switchMode(nextMode)} />
    </div>
  );
}
