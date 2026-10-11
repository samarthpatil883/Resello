import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, getApiErrorMessage } from '../../lib/api';
import { EMPTY_MARKETPLACE_ITEMS, useMarketplaceStore, type Item } from './marketplaceStore';

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function ItemImage({ item, className = '' }: { item: Item; className?: string }) {
  return (
    <img
      className={`h-full w-full object-contain ${className}`}
      src={api.getUri({ url: item.image_url })}
      alt={item.title}
    />
  );
}

function ItemGallery({ item }: { item: Item }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageUrls = item.image_urls?.length ? item.image_urls : [item.image_url];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    viewportRef.current?.scrollTo({ left: 0 });
  }, [item.id]);

  function goToImage(index: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ left: index * viewport.clientWidth, behavior: 'smooth' });
    setActiveIndex(index);
  }

  return (
    <div className="relative w-full" aria-label="Item photo gallery">
      <div
        ref={viewportRef}
        className="flex aspect-square max-h-[72vh] w-full snap-x snap-mandatory overflow-x-auto scroll-smooth bg-white"
        onScroll={(event) => {
          const viewport = event.currentTarget;
          if (viewport.clientWidth > 0) {
            setActiveIndex(
              Math.min(
                imageUrls.length - 1,
                Math.round(viewport.scrollLeft / viewport.clientWidth),
              ),
            );
          }
        }}
      >
        {imageUrls.map((imageUrl, index) => (
          <div
            key={imageUrl}
            className="grid h-full w-full shrink-0 snap-center place-items-center p-6"
            aria-label={`Photo ${index + 1} of ${imageUrls.length}`}
          >
            <img
              className="h-full w-full object-contain"
              src={api.getUri({ url: imageUrl })}
              alt={`${item.title}, photo ${index + 1}`}
            />
          </div>
        ))}
      </div>

      {imageUrls.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            disabled={activeIndex === 0}
            onClick={() => goToImage(activeIndex - 1)}
            className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-slate-800 shadow-md disabled:opacity-40"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            disabled={activeIndex === imageUrls.length - 1}
            onClick={() => goToImage(activeIndex + 1)}
            className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-slate-800 shadow-md disabled:opacity-40"
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/70 px-3 py-2">
            {imageUrls.map((imageUrl, index) => (
              <button
                key={imageUrl}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={activeIndex === index}
                onClick={() => goToImage(index)}
                className={`h-2.5 w-2.5 rounded-full ${
                  activeIndex === index ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
          <span className="absolute right-4 top-4 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold text-white">
            {activeIndex + 1} / {imageUrls.length}
          </span>
        </>
      )}
    </div>
  );
}

export function BuyListingPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const cart = useMarketplaceStore(
    (state) => state.cartByUser[user?._id ?? ''] ?? EMPTY_MARKETPLACE_ITEMS,
  );
  const wishlist = useMarketplaceStore(
    (state) => state.wishlistByUser[user?._id ?? ''] ?? EMPTY_MARKETPLACE_ITEMS,
  );
  const addToCart = useMarketplaceStore((state) => state.addToCart);
  const toggleWishlist = useMarketplaceStore((state) => state.toggleWishlist);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<{ item: Item }>(`/items/${id}`)
      .then(({ data }) => {
        if (active) setItem(data.item);
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
  }, [id]);

  const isOwner = Boolean(user && item?.seller_id === user._id);
  const isSaved = wishlist.some((savedItem) => savedItem.id === id);
  const isInCart = cart.some((cartItem) => cartItem.id === id);
  const available = item?.status === 'ACTIVE' && !isOwner;

  if (loading) {
    return (
      <main className="mx-auto grid w-full max-w-5xl gap-5 p-5 md:grid-cols-2" aria-busy="true">
        <div className="aspect-square animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid content-start gap-4">
          <div className="h-8 animate-pulse rounded bg-slate-200" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
        </div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 p-6">
        <p className="rounded-xl bg-red-50 p-4 text-red-800" role="alert">
          {error ?? 'This item could not be found.'}
        </p>
        <Link className="button button-secondary w-fit" to="/buy">
          <ArrowLeft size={17} /> Back to Buy
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 p-4 pb-28 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start lg:pb-8">
      <section className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-3xl bg-white shadow-sm sm:min-h-[480px]">
        <ItemGallery item={item} />
        <button
          type="button"
          aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={isSaved}
          onClick={() => {
            if (!user) return;
            toggleWishlist(user._id, item);
            setNotice(isSaved ? 'Removed from your wishlist.' : 'Saved to your wishlist.');
          }}
          className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-white text-rose-600 shadow-md transition hover:scale-105"
        >
          <Heart size={22} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </section>

      <section className="grid content-start gap-5 rounded-3xl bg-white p-5 shadow-sm sm:p-7">
        <Link
          to="/buy"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-800"
        >
          <ArrowLeft size={17} /> Back to marketplace
        </Link>
        {item.status !== 'ACTIVE' && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            {item.status === 'PENDING'
              ? 'Reserved — another student is checking out.'
              : 'This item is no longer available.'}
          </p>
        )}
        {isOwner && (
          <p className="rounded-xl bg-indigo-50 p-3 text-sm font-semibold text-indigo-900">
            This is your listing.
          </p>
        )}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-800">
            PCCOE student listing
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {item.title}
          </h1>
          <p className="mt-3 text-3xl font-extrabold text-teal-800">
            {priceFormatter.format(item.price)}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          <MapPin size={17} className="text-teal-800" />
          Campus handover arranged with the seller after confirmation.
        </div>
        <div className="border-t border-slate-100 pt-4">
          <h2 className="mb-2 font-bold text-slate-900">Item description</h2>
          <p className="whitespace-pre-wrap leading-7 text-slate-600">{item.description}</p>
        </div>
        {notice && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-teal-50 p-3 text-sm font-semibold text-teal-900">
            <p role="status">{notice}</p>
            {isSaved && (
              <Link className="shrink-0 underline" to="/buy/wishlist">
                View wishlist
              </Link>
            )}
          </div>
        )}
        {isOwner ? (
          <Link
            to={`/sell/listings/${item.id}/edit`}
            className="button button-secondary button-wide"
          >
            Manage listing
          </Link>
        ) : (
          <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <button
              type="button"
              disabled={!available}
              className="button button-secondary button-wide"
              onClick={() => {
                addToCart(user!._id, item);
                setNotice(isInCart ? 'This item is already in your cart.' : 'Added to your cart.');
              }}
            >
              <ShoppingBag size={18} /> {isInCart ? 'In your cart' : 'Add to cart'}
            </button>
            <button
              type="button"
              disabled={!available}
              className="button button-primary button-wide"
              onClick={() => navigate(`/buy/checkout?item=${encodeURIComponent(item.id)}`)}
            >
              Buy now
            </button>
            <button
              type="button"
              disabled={!available}
              aria-pressed={isSaved}
              className="button button-secondary button-wide sm:col-span-2"
              onClick={() => {
                toggleWishlist(user!._id, item);
                setNotice(isSaved ? 'Removed from your wishlist.' : 'Saved to your wishlist.');
              }}
            >
              <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
              {isSaved ? 'Saved to wishlist' : 'Add to wishlist'}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export function BuyCartPage() {
  const { user } = useAuth();
  const items = useMarketplaceStore(
    (state) => state.cartByUser[user?._id ?? ''] ?? EMPTY_MARKETPLACE_ITEMS,
  );
  const removeFromCart = useMarketplaceStore((state) => state.removeFromCart);
  const total = items.reduce((sum, item) => sum + item.price, 0);

  if (items.length === 0) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-teal-800">Your cart</p>
        <h1 className="text-3xl font-bold">Your cart is empty.</h1>
        <p className="text-slate-600">
          Add campus finds to your cart, or use Buy now to check out an item directly.
        </p>
        <Link className="button button-primary w-fit" to="/buy/search">
          Explore items
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-teal-800">Your cart</p>
        <h1 className="mt-2 text-3xl font-bold">Ready when you are.</h1>
      </header>
      <section className="grid gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:p-4"
          >
            <Link
              to={`/buy/listing/${item.id}`}
              className="aspect-square overflow-hidden rounded-xl bg-slate-100 p-2"
            >
              <ItemImage item={item} />
            </Link>
            <div className="min-w-0">
              <Link
                to={`/buy/listing/${item.id}`}
                className="line-clamp-2 font-bold text-slate-900 hover:text-teal-800"
              >
                {item.title}
              </Link>
              <p className="mt-2 font-extrabold text-teal-800">
                {priceFormatter.format(item.price)}
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl p-3 text-slate-500 hover:bg-red-50 hover:text-red-700"
              aria-label={`Remove ${item.title} from cart`}
              onClick={() => user && removeFromCart(user._id, item.id)}
            >
              <Trash2 size={19} />
            </button>
          </article>
        ))}
      </section>
      <aside className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm sm:ml-auto sm:w-full sm:max-w-sm">
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{priceFormatter.format(total)}</span>
        </div>
        <Link to="/buy/checkout" className="button button-primary button-wide">
          Proceed to checkout
        </Link>
        <p className="text-xs leading-5 text-slate-500">
          No shipping fees or surprise charges. Arrange a campus handover with the seller.
        </p>
      </aside>
    </main>
  );
}

export function BuyWishlistPage() {
  const { user } = useAuth();
  const items = useMarketplaceStore(
    (state) => state.wishlistByUser[user?._id ?? ''] ?? EMPTY_MARKETPLACE_ITEMS,
  );
  const removeFromWishlist = useMarketplaceStore((state) => state.removeFromWishlist);
  const addToCart = useMarketplaceStore((state) => state.addToCart);

  if (items.length === 0) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-teal-800">Wishlist</p>
        <h1 className="text-3xl font-bold">Save items for later.</h1>
        <p className="text-slate-600">Tap the heart on an item to keep it in your wishlist.</p>
        <Link className="button button-primary w-fit" to="/buy/search">
          Explore items
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-5 p-4 sm:p-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-teal-800">Saved for later</p>
        <h1 className="mt-2 text-3xl font-bold">Your wishlist</h1>
      </header>
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <Link to={`/buy/listing/${item.id}`} className="block aspect-square bg-slate-100 p-2">
              <ItemImage item={item} />
            </Link>
            <div className="grid gap-2 p-3">
              <Link to={`/buy/listing/${item.id}`} className="line-clamp-2 min-h-10 font-semibold">
                {item.title}
              </Link>
              <p className="font-bold text-teal-800">{priceFormatter.format(item.price)}</p>
              <button
                type="button"
                className="button button-primary button-wide"
                onClick={() => user && addToCart(user._id, item)}
              >
                <ShoppingBag size={17} /> Add to cart
              </button>
              <button
                type="button"
                className="button button-secondary button-wide"
                onClick={() => user && removeFromWishlist(user._id, item.id)}
              >
                <Heart size={17} /> Remove
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

interface CheckoutOrder {
  id: string;
  itemId: string;
  title: string;
  price: number;
  status: string;
  paymentMethod: 'COD';
  paymentStatus: 'PENDING_COLLECTION';
}

export function BuyCheckoutPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const directItemId = searchParams.get('item');
  const cartItems = useMarketplaceStore(
    (state) => state.cartByUser[user?._id ?? ''] ?? EMPTY_MARKETPLACE_ITEMS,
  );
  const clearCart = useMarketplaceStore((state) => state.clearCart);
  const itemIds = useMemo(
    () => (directItemId ? [directItemId] : cartItems.map((item) => item.id)),
    [cartItems, directItemId],
  );
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [orders, setOrders] = useState<CheckoutOrder[] | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (itemIds.length === 0) {
      setItems([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    Promise.all(itemIds.map((id) => api.get<{ item: Item }>(`/items/${id}`)))
      .then((responses) => {
        if (active) setItems(responses.map((response) => response.data.item));
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
  }, [itemIds]);

  const total = items.reduce((sum, item) => sum + item.price, 0);
  const unavailable = items.some(
    (item) => item.status !== 'ACTIVE' || item.seller_id === user?._id,
  );

  async function placeOrder() {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ orders: CheckoutOrder[] }>('/checkout', {
        itemIds: items.map((item) => item.id),
        paymentMethod: 'COD',
        deliveryNotes,
      });
      setOrders(response.data.orders);
      if (user)
        clearCart(
          user._id,
          items.map((item) => item.id),
        );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  if (orders) {
    return (
      <main className="mx-auto grid max-w-2xl gap-5 p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-3xl text-green-800">
          ✓
        </div>
        <p className="text-sm font-bold uppercase tracking-wider text-green-800">Order placed</p>
        <h1 className="text-3xl font-bold">Your seller will confirm shortly.</h1>
        <p className="text-slate-600">
          Pay cash when you meet the seller on campus. You can find your order updates in Buy
          orders.
        </p>
        <div className="grid gap-2 rounded-2xl bg-white p-4 text-left shadow-sm">
          {orders.map((order) => (
            <p key={order.id} className="flex justify-between gap-4">
              <span>{order.title}</span>
              <strong>{priceFormatter.format(order.price)}</strong>
            </p>
          ))}
        </div>
        <Link to="/buy" className="button button-primary button-wide">
          Keep browsing
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-teal-800">
          Checkout · review
        </p>
        <h1 className="mt-2 text-3xl font-bold">Confirm your campus order</h1>
      </header>
      {loading ? (
        <p className="animate-pulse rounded-xl bg-white p-6" aria-busy="true">
          Loading your items…
        </p>
      ) : error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-slate-700">
          Your cart is empty. Choose an item before checkout.
        </p>
      ) : (
        <>
          <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            {items.map((item) => (
              <article
                key={item.id}
                className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-slate-100 p-1">
                  <ItemImage item={item} />
                </div>
                <span className="line-clamp-2 font-semibold">{item.title}</span>
                <strong>{priceFormatter.format(item.price)}</strong>
              </article>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-4 text-lg font-bold">
              <span>Total</span>
              <span>{priceFormatter.format(total)}</span>
            </div>
          </section>
          <section className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-bold">Payment and handover</h2>
            <label className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
              <input type="radio" checked readOnly aria-label="Cash on delivery" />
              <span>
                <strong>Cash at campus handover</strong>
                <small className="mt-1 block text-slate-600">
                  Pay the seller in person when you meet. Online payment is not enabled yet.
                </small>
              </span>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Handover note (optional)
              <textarea
                maxLength={500}
                value={deliveryNotes}
                onChange={(event) => setDeliveryNotes(event.target.value)}
                placeholder="Suggest a convenient campus meeting place or time."
                className="min-h-24 rounded-xl border border-slate-300 p-3 font-normal"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy || unavailable || items.length === 0}
              onClick={() => void placeOrder()}
              className="button button-primary button-wide"
            >
              {busy ? 'Placing order…' : `Place COD order · ${priceFormatter.format(total)}`}
            </button>
            {unavailable && (
              <p className="text-sm text-amber-800">
                One or more items are unavailable or belong to your account. Remove them and try
                again.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
