import type { CSSProperties } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  Armchair,
  Backpack,
  BadgeCheck,
  BookOpen,
  Calculator,
  Check,
  Cpu,
  Flag,
  Laptop,
  Lock,
  MailCheck,
  MapPin,
  Package,
  Pencil,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthContext';
import '@/styles/welcome.css';

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

const PERKS = [
  { Icon: MailCheck, text: 'College email only' },
  { Icon: Lock, text: 'Verified with a 6-digit code' },
  { Icon: Wallet, text: 'Pay online or cash on delivery' },
  { Icon: MapPin, text: 'Meet on campus' },
];

const SAMPLES = [
  {
    title: 'Engineering Mathematics III',
    price: '₹250',
    meta: 'Good · 0.4 km',
    Icon: BookOpen,
    bg: 'linear-gradient(135deg,#0F766E,#2DD4BF)',
  },
  {
    title: 'Casio fx-991EX Calculator',
    price: '₹600',
    meta: 'Like new · 1.2 km',
    Icon: Calculator,
    bg: 'linear-gradient(135deg,#4338CA,#818CF8)',
  },
  {
    title: 'Arduino Uno Starter Kit',
    price: '₹700',
    meta: 'Like new · 0.6 km',
    Icon: Cpu,
    bg: 'linear-gradient(135deg,#C2410C,#FB923C)',
  },
];

const CATEGORIES = [
  { name: 'Books', Icon: BookOpen },
  { name: 'Electronics', Icon: Laptop },
  { name: 'Lab & Drafting', Icon: Ruler },
  { name: 'Bags', Icon: Backpack },
  { name: 'Furniture', Icon: Armchair },
  { name: 'Stationery', Icon: Pencil },
  { name: 'Other', Icon: Package },
];

const MODES = [
  {
    key: 'buy',
    name: 'Buy',
    tag: 'Find what you need',
    Icon: ShoppingBag,
    color: 'var(--rs-teal)',
    points: [
      'Search and filter by category, price, condition and distance',
      'Cart and checkout with online payment or cash on delivery',
      'Track orders and rate sellers after you receive the item',
    ],
  },
  {
    key: 'sell',
    name: 'Sell',
    tag: "Clear out what you don't need",
    Icon: Store,
    color: 'var(--rs-indigo)',
    points: [
      'Post a listing in under a minute with photos',
      'Confirm or cancel incoming orders from your dashboard',
      'Edit your listings and watch your ratings and sales',
    ],
  },
];

const STEPS = [
  {
    title: 'Join with your college email',
    text: 'Use your @pccoepune.org address and confirm it with a 6-digit code.',
  },
  {
    title: 'Find it or list it',
    text: 'Search nearby listings, or post your own with photos in under a minute.',
  },
  {
    title: 'Meet and pay',
    text: 'Pay online or in cash on campus, then confirm once you have the item.',
  },
];

const TRUST = [
  {
    Icon: BadgeCheck,
    title: 'Real students only',
    text: 'Accounts need a verified @pccoepune.org email, so you are always dealing with someone on campus.',
  },
  {
    Icon: Star,
    title: 'Ratings that mean something',
    text: 'Only buyers with a completed order can review a seller, once per order.',
  },
  {
    Icon: ShieldCheck,
    title: 'No double-selling',
    text: 'When someone checks out, the item is reserved so nobody else can buy it at the same time.',
  },
  {
    Icon: Flag,
    title: 'Moderated by admins',
    text: 'Report a listing and an admin can remove it or suspend the account.',
  },
];

function destinationForMode(mode: string) {
  if (mode !== 'BUY' && mode !== 'SELL') return '/buy';
  return sessionStorage.getItem(`resello:lastRoute:${mode}`) ?? `/${mode.toLowerCase()}`;
}

export default function Welcome() {
  const { user, loading } = useAuth();
  if (user && !loading) return <Navigate to={destinationForMode(user.lastActiveMode)} replace />;

  return (
    <div className="rs">
      <a className="rs-skip" href="#main">
        Skip to content
      </a>

      <header className="rs-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/welcome" className="flex items-center" aria-label="Resello home">
            <img
              src="/resello-logo.png"
              alt="Resello — Online Resale Marketplace"
              className="h-auto w-28 sm:w-32"
            />
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 text-sm font-medium md:flex"
          >
            <a href="#how">How it works</a>
            <a href="#categories">Categories</a>
            <a href="#trust">Safety</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/join">Join</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="rs-hero" aria-labelledby="hero-title">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="rs-badge rs-in">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" /> Verified PCCOE students only
              </p>
              <h1
                id="hero-title"
                className="rs-in mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
                style={delay(80)}
              >
                Buy and sell college essentials <span className="rs-accent">on campus</span>
              </h1>
              <p className="rs-in rs-muted mt-4 max-w-xl text-lg" style={delay(160)}>
                Books, calculators, lab gear and more from verified PCCOE students. Join with your
                college email, pay online or cash on delivery, and meet on campus.
              </p>
              <div className="rs-in mt-6 flex flex-col gap-3 sm:flex-row" style={delay(240)}>
                <Button asChild size="lg" className="h-auto whitespace-normal py-3 text-base">
                  <Link to="/join">
                    Join with your college email{' '}
                    <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-auto py-3 text-base">
                  <Link to="/login">Log in</Link>
                </Button>
              </div>
              <ul className="rs-in mt-6 grid gap-2 text-sm sm:grid-cols-2" style={delay(320)}>
                {PERKS.map(({ Icon, text }) => (
                  <li key={text} className="flex items-center gap-2">
                    <Icon
                      aria-hidden="true"
                      className="h-4 w-4"
                      style={{ color: 'var(--rs-teal)' }}
                    />{' '}
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rs-card rs-in p-4" aria-hidden="true" style={delay(200)}>
              <div className="rs-muted mb-3 flex items-center justify-between text-xs font-semibold">
                <span>SAMPLE LISTINGS</span>
                <span className="rs-switch">
                  <span className="on">Buy</span>
                  <span>Sell</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {SAMPLES.map(({ title, price, meta, Icon, bg }) => (
                  <div key={title} className="rs-card overflow-hidden">
                    <div className="rs-art" style={{ background: bg }}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <div className="p-2">
                      <div className="rs-clamp text-xs font-semibold sm:text-sm">{title}</div>
                      <div className="font-bold">{price}</div>
                      <div className="rs-muted text-xs">{meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="categories"
          aria-labelledby="cat-title"
          className="mx-auto max-w-6xl px-4 py-12"
        >
          <h2 id="cat-title" className="rs-h2">
            Everything a semester needs
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {CATEGORIES.map(({ name, Icon }) => (
              <li
                key={name}
                className="rs-card flex flex-col items-center gap-2 p-4 text-center text-sm font-semibold"
              >
                <span className="rs-icon">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                {name}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="modes-title" style={{ background: 'var(--rs-bg)' }}>
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 id="modes-title" className="rs-h2">
              One account. Two storefronts.
            </h2>
            <p className="rs-muted mt-2 max-w-2xl">
              After you log in, switch between Buy and Sell from the top of every page. Same
              account, two separate spaces.
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {MODES.map(({ key, name, tag, Icon, color, points }) => (
                <li
                  key={key}
                  className="rs-card p-6"
                  style={{ borderTop: `4px solid ${color}`, '--c': color } as CSSProperties}
                >
                  <div className="flex items-center gap-3">
                    <span className="rs-icon">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-xl font-bold">{name}</h3>
                      <p className="rs-muted text-sm">{tag}</p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <Check
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 flex-none"
                          style={{ color }}
                        />{' '}
                        {point}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="how-title" className="rs-h2">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ title, text }, index) => (
              <li key={title} className="rs-card flex gap-4 p-5">
                <span className="rs-step-num">{index + 1}</span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="rs-muted mt-1 text-sm">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="trust" aria-labelledby="trust-title" style={{ background: 'var(--rs-bg)' }}>
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 id="trust-title" className="rs-h2">
              Built for campus trust
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {TRUST.map(({ Icon, title, text }) => (
                <li key={title} className="rs-card flex gap-4 p-5">
                  <span className="rs-icon">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="rs-muted mt-1 text-sm">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rs-band" aria-labelledby="cta-title">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 md:flex-row md:items-center">
            <div>
              <h2 id="cta-title" className="text-2xl font-bold sm:text-3xl">
                Something to sell, or something to find?
              </h2>
              <p className="mt-1" style={{ color: '#e5e7eb' }}>
                It takes a minute with your college email.
              </p>
            </div>
            <Button asChild size="lg" className="h-auto whitespace-normal py-3 text-base">
              <Link to="/join">
                Join with your college email{' '}
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="rs-foot">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="rs-muted">© 2026 Resello · Pimpri Chinchwad College of Engineering, Pune</p>
          <p className="rs-muted">Built by Atharv S. Deshmukh, Prathmesh Mane and Samarth Patil</p>
        </div>
      </footer>
    </div>
  );
}
