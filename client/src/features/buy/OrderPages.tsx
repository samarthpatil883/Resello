import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiErrorMessage } from '../../lib/api';

type OrderSide = 'buyer' | 'seller';
type OrderStatus = 'PLACED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

interface MarketplaceOrder {
  id: string;
  itemId: string;
  title: string;
  price: number;
  status: OrderStatus;
  createdAt: string;
  completionApprovals: { buyer: boolean; seller: boolean };
  rating: number | null;
}

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const statusLabels: Record<OrderStatus, string> = {
  PLACED: 'Handover in progress',
  CONFIRMED: 'Handover in progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function RatingForm({ orderId, onRated }: { orderId: string; onRated: (rating: number) => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/orders/${orderId}/rating`, { rating, comment: comment.trim() });
      onRated(rating);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
      onSubmit={(event) => void submit(event)}
    >
      <h3 className="font-semibold text-slate-900">Rate your seller</h3>
      <label
        className="grid gap-1 text-sm font-medium text-slate-700"
        htmlFor={`rating-${orderId}`}
      >
        Your rating
        <select
          id={`rating-${orderId}`}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
        >
          <option value={5}>5 — Excellent</option>
          <option value={4}>4 — Good</option>
          <option value={3}>3 — Okay</option>
          <option value={2}>2 — Could be better</option>
          <option value={1}>1 — Poor</option>
        </select>
      </label>
      <label
        className="grid gap-1 text-sm font-medium text-slate-700"
        htmlFor={`comment-${orderId}`}
      >
        Comment (optional)
        <textarea
          id={`comment-${orderId}`}
          className="min-h-20 rounded-lg border border-slate-300 bg-white p-3"
          maxLength={1000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <button type="submit" className="button button-primary w-fit" disabled={busy}>
        {busy ? 'Submitting rating…' : 'Submit rating'}
      </button>
    </form>
  );
}

export function OrderPage({ side }: { side: OrderSide }) {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>('ALL');

  const reloadOrders = useCallback(async () => {
    const response = await api.get<{ orders: MarketplaceOrder[] }>(`/orders?side=${side}`);
    setOrders(response.data.orders);
  }, [side]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<{ orders: MarketplaceOrder[] }>(`/orders?side=${side}`)
      .then(({ data }) => {
        if (active) setOrders(data.orders);
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
  }, [reloadKey, side]);

  async function approveCompletion(orderId: string) {
    setBusyOrderId(orderId);
    setActionError(null);
    try {
      await api.post(`/orders/${orderId}/completion-approval`);
      await reloadOrders();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    } finally {
      setBusyOrderId(null);
    }
  }

  function updateRating(orderId: string, rating: number) {
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, rating } : order)),
    );
  }

  const visibleOrders = orders.filter((order) => {
    if (filter === 'IN_PROGRESS') return order.status === 'PLACED' || order.status === 'CONFIRMED';
    if (filter === 'COMPLETED') return order.status === 'COMPLETED';
    if (filter === 'CANCELLED') return order.status === 'CANCELLED';
    return true;
  });

  const title = side === 'buyer' ? 'Your purchases' : 'Orders for your listings';
  const kicker = side === 'buyer' ? 'BUY ORDERS' : 'SELL ORDERS';

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-5 p-4 sm:p-6">
      <header>
        <p className="text-sm font-bold uppercase tracking-wider text-indigo-800">{kicker}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          An order completes after both the buyer and seller confirm the campus handover.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" aria-label="Filter orders">
        {(
          [
            ['ALL', 'All orders'],
            ['IN_PROGRESS', 'In progress'],
            ['COMPLETED', 'Completed'],
            ['CANCELLED', 'Cancelled'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
              filter === value
                ? 'border-indigo-700 bg-indigo-700 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
          <button
            type="button"
            className="button button-secondary mt-4"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </section>
      ) : loading ? (
        <section className="grid gap-3" aria-label="Loading orders" aria-busy="true">
          {[0, 1].map((key) => (
            <div key={key} className="h-36 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </section>
      ) : visibleOrders.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            {orders.length === 0 ? 'No orders yet' : 'No orders in this section'}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {orders.length === 0
              ? side === 'buyer'
                ? 'When you buy a campus listing, order updates will appear here.'
                : 'Orders for your listings will appear here after a buyer checks out.'
              : 'Choose another filter to see your orders.'}
          </p>
          {side === 'buyer' && orders.length === 0 && (
            <Link to="/buy/search" className="button button-primary mt-5">
              Find something to buy
            </Link>
          )}
          {side === 'seller' && orders.length === 0 && (
            <Link to="/sell/listings" className="button button-secondary mt-5">
              View my listings
            </Link>
          )}
        </section>
      ) : (
        <section className="grid gap-4">
          {visibleOrders.map((order) => {
            const myApproval = order.completionApprovals[side];
            const otherSide: OrderSide = side === 'buyer' ? 'seller' : 'buyer';
            const otherApproval = order.completionApprovals[otherSide];
            const completable = order.status === 'PLACED' || order.status === 'CONFIRMED';
            return (
              <article
                key={order.id}
                className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/buy/listing/${order.itemId}`}
                      className="font-bold text-slate-950 hover:text-indigo-800"
                    >
                      {order.title}
                    </Link>
                    <p className="mt-1 font-bold text-indigo-800">
                      {priceFormatter.format(order.price)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Order {order.id} · {new Date(order.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                    {statusLabels[order.status]}
                  </span>
                </div>

                {order.status !== 'CANCELLED' && (
                  <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
                    <p
                      className={
                        order.completionApprovals.buyer ? 'text-green-800' : 'text-slate-600'
                      }
                    >
                      Buyer:{' '}
                      {order.completionApprovals.buyer ? 'approved completion' : 'approval pending'}
                    </p>
                    <p
                      className={
                        order.completionApprovals.seller ? 'text-green-800' : 'text-slate-600'
                      }
                    >
                      Seller:{' '}
                      {order.completionApprovals.seller
                        ? 'approved completion'
                        : 'approval pending'}
                    </p>
                  </div>
                )}

                {actionError && busyOrderId === null && (
                  <p role="alert" className="text-sm text-red-800">
                    {actionError}
                  </p>
                )}

                {completable && !myApproval && (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <p className="text-sm text-slate-600">
                      Confirm the item handover is complete. The order completes after both parties
                      approve.
                    </p>
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={busyOrderId !== null}
                      onClick={() => void approveCompletion(order.id)}
                    >
                      {busyOrderId === order.id ? 'Saving approval…' : 'Approve completion'}
                    </button>
                  </div>
                )}
                {completable && myApproval && !otherApproval && (
                  <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    Your approval is saved. The order will complete when the {otherSide} approves
                    too.
                  </p>
                )}

                {order.status === 'COMPLETED' && side === 'buyer' && order.rating === null && (
                  <RatingForm
                    orderId={order.id}
                    onRated={(rating) => updateRating(order.id, rating)}
                  />
                )}
                {order.status === 'COMPLETED' && order.rating !== null && (
                  <p
                    role="status"
                    className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900"
                  >
                    {side === 'buyer'
                      ? `You rated the seller ${order.rating}/5.`
                      : `Buyer rating: ${order.rating}/5.`}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export function BuyOrdersPage() {
  return <OrderPage side="buyer" />;
}

export function SellOrdersPage() {
  return <OrderPage side="seller" />;
}
