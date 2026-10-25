import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Activity,
  Ban,
  Check,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Search,
  Shield,
  Star,
  Users,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';

type AdminTab = 'overview' | 'users' | 'listings' | 'reviews' | 'transactions' | 'activity';
type PageResult = { total: number; page: number; totalPages: number };
type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT';
  joinedAt: string;
  emailVerified: boolean;
  sellerOnboarded: boolean;
  suspended: boolean;
  listingCount: number;
  purchaseCount: number;
  saleCount: number;
};
type AdminListing = {
  id: string;
  title: string;
  description: string;
  price: number;
  status: 'ACTIVE' | 'PENDING' | 'SOLD' | 'REMOVED';
  createdAt: string;
  seller: { id: string; name: string; email: string } | null;
};
type AdminTransaction = {
  id: string;
  item: string;
  buyer: { name: string; email: string } | null;
  seller: { name: string; email: string } | null;
  amount: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
};
type AdminReview = {
  id: string;
  orderId: string;
  rating: number;
  comment: string;
  createdAt: string;
  seller: { name: string; email: string } | null;
  reviewer: { name: string; email: string } | null;
  item: string;
};
type AdminActivity = {
  id: string;
  type: string;
  targetType: 'USER' | 'LISTING';
  targetId: string;
  reason: string;
  admin: { name: string; email: string } | null;
  createdAt: string;
};
type AdminStats = {
  users: number;
  suspendedUsers: number;
  activeListings: number;
  pendingListings: number;
  orders: number;
  completedOrders: number;
  revenue: number;
};

const tabs: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'listings', label: 'Listings', icon: Package },
  { id: 'reviews', label: 'Seller reviews', icon: Star },
  { id: 'transactions', label: 'Transactions', icon: CircleDollarSign },
  { id: 'activity', label: 'Admin activity', icon: Activity },
];

function collegeEmailError(email: string) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  const allowedDomains = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || 'pccoepune.org')
    .split(',')
    .map((domain) => domain.trim().toLowerCase());
  if (at < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    return 'Enter a valid college email address.';
  if (normalized.slice(0, at).includes('+')) return 'Use your college email without a + alias.';
  if (!allowedDomains.includes(normalized.slice(at + 1)))
    return 'Administrator access uses a verified PCCOE college email.';
  return null;
}

export function AdminLoginPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = collegeEmailError(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const authenticatedUser = await login({ email: email.trim().toLowerCase(), password });
      if (authenticatedUser.role !== 'ADMIN') {
        await logout();
        setError('This verified college account is not an administrator account.');
        return;
      }
      navigate('/admin', { replace: true });
    } catch (loginError) {
      setError(getApiErrorMessage(loginError));
    } finally {
      setBusy(false);
    }
  }

  async function signOutStudent() {
    try {
      await logout();
      setError(null);
    } catch (logoutError) {
      setError(getApiErrorMessage(logoutError));
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <Link className="admin-brand" to="/welcome">
          <img src="/resello-logo.png" alt="Resello" />
        </Link>
        <span className="admin-eyebrow">
          <Shield size={16} /> Secure administrator access
        </span>
        <h1>Admin sign in</h1>
        <p>Use the verified PCCOE account granted administrator access by the seed process.</p>
        {user && (
          <div className="admin-message" role="status">
            <p>
              You are signed in as a student. Log out before using a seeded administrator account.
            </p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void signOutStudent()}
            >
              Log out of this account
            </button>
          </div>
        )}
        <form className="admin-login-form" onSubmit={submit}>
          <label>
            Verified college email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@pccoepune.org"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your account password"
            />
          </label>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-primary button-wide"
            type="submit"
            disabled={busy || Boolean(user)}
          >
            {busy ? 'Checking access…' : 'Sign in securely'}
          </button>
        </form>
        <Link className="admin-login-back" to="/login">
          Regular Resello sign in
        </Link>
      </section>
    </main>
  );
}

function DataState({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="admin-loading" role="status">
        Loading administrator data…
      </div>
    );
  if (error)
    return (
      <div className="admin-empty" role="alert">
        <p>{getApiErrorMessage(error)}</p>
        <button type="button" className="button button-secondary" onClick={retry}>
          Try again
        </button>
      </div>
    );
  return <>{children}</>;
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button
        type="button"
        className="button button-secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="button button-secondary"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

export function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [userStatus, setUserStatus] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [listingStatus, setListingStatus] = useState<'ALL' | AdminListing['status']>('ALL');
  const [action, setAction] = useState<
    | { kind: 'remove' | 'dismiss'; targetId: string; label: string }
    | { kind: 'suspend' | 'restore'; targetId: string; label: string }
    | null
  >(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get<AdminStats>('/admin/stats')).data,
    enabled: tab === 'overview',
  });
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page, search, userStatus],
    queryFn: async () =>
      (
        await api.get<{ users: AdminUser[] } & PageResult>('/admin/users', {
          params: {
            page,
            limit: 20,
            search,
            ...(userStatus !== 'ALL' ? { status: userStatus } : {}),
          },
        })
      ).data,
    enabled: tab === 'users',
  });
  const listingsQuery = useQuery({
    queryKey: ['admin', 'listings', page, search, listingStatus],
    queryFn: async () =>
      (
        await api.get<{ listings: AdminListing[] } & PageResult>('/admin/listings', {
          params: {
            page,
            limit: 20,
            search,
            ...(listingStatus !== 'ALL' ? { status: listingStatus } : {}),
          },
        })
      ).data,
    enabled: tab === 'listings',
  });
  const transactionsQuery = useQuery({
    queryKey: ['admin', 'transactions', page],
    queryFn: async () =>
      (
        await api.get<{ transactions: AdminTransaction[] } & PageResult>('/admin/transactions', {
          params: { page, limit: 20 },
        })
      ).data,
    enabled: tab === 'transactions',
  });
  const reviewsQuery = useQuery({
    queryKey: ['admin', 'reviews', page, search],
    queryFn: async () =>
      (
        await api.get<{ reviews: AdminReview[] } & PageResult>('/admin/reviews', {
          params: { page, limit: 20, search },
        })
      ).data,
    enabled: tab === 'reviews',
  });
  const activityQuery = useQuery({
    queryKey: ['admin', 'activity', page],
    queryFn: async () =>
      (
        await api.get<{ activity: AdminActivity[] } & PageResult>('/admin/activity', {
          params: { page, limit: 20 },
        })
      ).data,
    enabled: tab === 'activity',
  });

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error('Choose an administrator action first.');
      if (action.kind === 'remove')
        return api.post('/admin/actions/remove-listing', {
          listingId: action.targetId,
          reason,
        });
      if (action.kind === 'dismiss')
        return api.post('/admin/actions/dismiss', {
          listingId: action.targetId,
          reason,
        });
      return api.post('/admin/actions/suspend-user', {
        userId: action.targetId,
        suspended: action.kind === 'suspend',
        reason,
      });
    },
    onSuccess: async () => {
      setAction(null);
      setReason('');
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error) => {
      setActionError(getApiErrorMessage(error));
    },
  });

  async function signOut() {
    try {
      await logout();
      navigate('/admin/login', { replace: true });
    } catch (error) {
      setActionError(getApiErrorMessage(error));
      console.error('Administrator sign out failed:', error);
    }
  }

  function chooseTab(next: AdminTab) {
    setTab(next);
    setPage(1);
    setSearch('');
  }

  const stats = statsQuery.data;

  return (
    <main className="admin-app">
      <header className="admin-header">
        <Link to="/admin" className="admin-brand">
          <img src="/resello-logo.png" alt="Resello" />
        </Link>
        <div className="admin-header-title">
          <span>ADMIN CONSOLE</span>
          <strong>{user?.name}</strong>
        </div>
        <button type="button" className="admin-logout" onClick={() => void signOut()}>
          <LogOut size={17} /> Sign out
        </button>
      </header>
      <div className="admin-layout">
        <nav className="admin-nav" aria-label="Administrator sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'admin-nav-active' : ''}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => chooseTab(id)}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <section className="admin-content">
          <div className="admin-page-heading">
            <div>
              <span className="admin-eyebrow">Resello operations</span>
              <h1>{tabs.find((item) => item.id === tab)?.label}</h1>
            </div>
            <span className="admin-role-badge">
              <Shield size={15} /> Administrator
            </span>
          </div>

          {actionError && (
            <p className="admin-error" role="alert">
              {actionError}
            </p>
          )}
          {tab === 'overview' && (
            <DataState
              loading={statsQuery.isLoading}
              error={statsQuery.error}
              retry={() => void statsQuery.refetch()}
            >
              {stats && (
                <>
                  <div className="admin-stat-grid">
                    <Stat
                      icon={<Users />}
                      label="Student accounts"
                      value={stats.users}
                      detail={`${stats.suspendedUsers} suspended`}
                    />
                    <Stat
                      icon={<Package />}
                      label="Active listings"
                      value={stats.activeListings}
                      detail={`${stats.pendingListings} reserved`}
                    />
                    <Stat
                      icon={<ClipboardList />}
                      label="Orders"
                      value={stats.orders}
                      detail={`${stats.completedOrders} completed`}
                    />
                    <Stat
                      icon={<CircleDollarSign />}
                      label="Completed sale value"
                      value={`₹${stats.revenue.toLocaleString('en-IN')}`}
                      detail="Gross completed COD orders"
                    />
                  </div>
                  <p className="admin-note">
                    Review users, listings, transactions, and recorded moderation actions from the
                    sections at left.
                  </p>
                </>
              )}
            </DataState>
          )}

          {tab === 'users' && (
            <>
              <div className="admin-toolbar">
                <label className="admin-search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search name or college email"
                  />
                </label>
                <select
                  aria-label="Filter users by status"
                  value={userStatus}
                  onChange={(event) => {
                    setUserStatus(event.target.value as typeof userStatus);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All students</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <DataState
                loading={usersQuery.isLoading}
                error={usersQuery.error}
                retry={() => void usersQuery.refetch()}
              >
                {usersQuery.data?.users.length ? (
                  <div className="admin-record-list">
                    {usersQuery.data.users.map((student) => (
                      <article className="admin-record" key={student.id}>
                        <div className="admin-record-main">
                          <strong>{student.name}</strong>
                          <span>{student.email}</span>
                          <small>
                            Joined {new Date(student.joinedAt).toLocaleDateString()} ·{' '}
                            {student.emailVerified ? 'Verified' : 'Unverified'} ·{' '}
                            {student.listingCount} listings · {student.purchaseCount} purchases ·{' '}
                            {student.saleCount} sales
                          </small>
                        </div>
                        <div className="admin-record-side">
                          <span
                            className={`admin-status admin-status-${student.suspended ? 'suspended' : 'active'}`}
                          >
                            {student.suspended ? 'Suspended' : 'Active'}
                          </span>
                          <button
                            type="button"
                            className="admin-action-button"
                            onClick={() => {
                              setAction({
                                kind: student.suspended ? 'restore' : 'suspend',
                                targetId: student.id,
                                label: student.name,
                              });
                              setActionError(null);
                            }}
                          >
                            {student.suspended ? (
                              <>
                                <Check size={15} /> Restore
                              </>
                            ) : (
                              <>
                                <Ban size={15} /> Suspend
                              </>
                            )}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="admin-empty">No student accounts match this search.</div>
                )}
                {usersQuery.data && (
                  <Pagination
                    page={usersQuery.data.page}
                    totalPages={usersQuery.data.totalPages}
                    onPage={setPage}
                  />
                )}
              </DataState>
            </>
          )}

          {tab === 'listings' && (
            <>
              <div className="admin-toolbar">
                <label className="admin-search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search listings"
                  />
                </label>
                <select
                  aria-label="Filter listings by status"
                  value={listingStatus}
                  onChange={(event) => {
                    setListingStatus(event.target.value as typeof listingStatus);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All listings</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Reserved</option>
                  <option value="SOLD">Sold</option>
                  <option value="REMOVED">Removed</option>
                </select>
              </div>
              <DataState
                loading={listingsQuery.isLoading}
                error={listingsQuery.error}
                retry={() => void listingsQuery.refetch()}
              >
                {listingsQuery.data?.listings.length ? (
                  <div className="admin-record-list">
                    {listingsQuery.data.listings.map((listing) => (
                      <article className="admin-record" key={listing.id}>
                        <div className="admin-record-main">
                          <strong>
                            {listing.title} · ₹{listing.price.toLocaleString('en-IN')}
                          </strong>
                          <span>
                            {listing.seller?.name ?? 'Unknown seller'} ·{' '}
                            {listing.seller?.email ?? 'No account'} ·{' '}
                            {new Date(listing.createdAt).toLocaleDateString()}
                          </span>
                          <small>{listing.description}</small>
                        </div>
                        <div className="admin-record-side">
                          <span
                            className={`admin-status admin-status-${listing.status.toLowerCase()}`}
                          >
                            {listing.status}
                          </span>
                          {listing.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="admin-action-button"
                              onClick={() => {
                                setAction({
                                  kind: 'remove',
                                  targetId: listing.id,
                                  label: listing.title,
                                });
                                setActionError(null);
                              }}
                            >
                              Remove listing
                            </button>
                          )}
                          {listing.status !== 'REMOVED' && (
                            <button
                              type="button"
                              className="admin-action-button"
                              onClick={() => {
                                setAction({
                                  kind: 'dismiss',
                                  targetId: listing.id,
                                  label: listing.title,
                                });
                                setActionError(null);
                              }}
                            >
                              Dismiss review
                            </button>
                          )}
                          <Link to={`/buy/listing/${listing.id}`} target="_blank" rel="noreferrer">
                            View
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="admin-empty">No listings match this filter.</div>
                )}
                {listingsQuery.data && (
                  <Pagination
                    page={listingsQuery.data.page}
                    totalPages={listingsQuery.data.totalPages}
                    onPage={setPage}
                  />
                )}
              </DataState>
            </>
          )}

          {tab === 'transactions' && (
            <DataState
              loading={transactionsQuery.isLoading}
              error={transactionsQuery.error}
              retry={() => void transactionsQuery.refetch()}
            >
              {transactionsQuery.data?.transactions.length ? (
                <div className="admin-record-list">
                  {transactionsQuery.data.transactions.map((transaction) => (
                    <article className="admin-record" key={transaction.id}>
                      <div className="admin-record-main">
                        <strong>
                          {transaction.item} · ₹{transaction.amount.toLocaleString('en-IN')}
                        </strong>
                        <span>
                          Buyer: {transaction.buyer?.name ?? 'Unknown'} (
                          {transaction.buyer?.email ?? '—'})
                        </span>
                        <span>
                          Seller: {transaction.seller?.name ?? 'Unknown'} (
                          {transaction.seller?.email ?? '—'})
                        </span>
                        <small>
                          {new Date(transaction.createdAt).toLocaleString()} ·{' '}
                          {transaction.paymentMethod} · {transaction.paymentStatus}
                        </small>
                      </div>
                      <span
                        className={`admin-status admin-status-${transaction.status.toLowerCase()}`}
                      >
                        {transaction.status}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">No transactions have been recorded.</div>
              )}
              {transactionsQuery.data && (
                <Pagination
                  page={transactionsQuery.data.page}
                  totalPages={transactionsQuery.data.totalPages}
                  onPage={setPage}
                />
              )}
            </DataState>
          )}

          {tab === 'reviews' && (
            <>
              <div className="admin-toolbar">
                <label className="admin-search">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search seller name or college email"
                  />
                </label>
              </div>
              <DataState
                loading={reviewsQuery.isLoading}
                error={reviewsQuery.error}
                retry={() => void reviewsQuery.refetch()}
              >
                {reviewsQuery.data?.reviews.length ? (
                  <div className="admin-record-list">
                    {reviewsQuery.data.reviews.map((review) => (
                      <article className="admin-record" key={review.id}>
                        <div className="admin-record-main">
                          <strong>{review.item}</strong>
                          <span>
                            Seller: {review.seller?.name ?? 'Unknown seller'} (
                            {review.seller?.email ?? 'No account'})
                          </span>
                          <span>
                            Reviewed by: {review.reviewer?.name ?? 'Unknown buyer'} (
                            {review.reviewer?.email ?? 'No account'})
                          </span>
                          <small>
                            {review.comment || 'No written review.'} ·{' '}
                            {new Date(review.createdAt).toLocaleString()}
                          </small>
                        </div>
                        <span
                          className="admin-status admin-status-active"
                          aria-label={`${review.rating} out of 5 stars`}
                        >
                          <Star size={14} fill="currentColor" /> {review.rating} / 5
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="admin-empty">No seller reviews match this search.</div>
                )}
                {reviewsQuery.data && (
                  <Pagination
                    page={reviewsQuery.data.page}
                    totalPages={reviewsQuery.data.totalPages}
                    onPage={setPage}
                  />
                )}
              </DataState>
            </>
          )}

          {tab === 'activity' && (
            <DataState
              loading={activityQuery.isLoading}
              error={activityQuery.error}
              retry={() => void activityQuery.refetch()}
            >
              {activityQuery.data?.activity.length ? (
                <div className="admin-record-list">
                  {activityQuery.data.activity.map((entry) => (
                    <article className="admin-record" key={entry.id}>
                      <div className="admin-record-main">
                        <strong>{entry.type.replace(/_/g, ' ')}</strong>
                        <span>
                          {entry.targetType} · {entry.targetId}
                        </span>
                        <small>
                          {entry.reason} · by {entry.admin?.name ?? 'Administrator'} (
                          {entry.admin?.email ?? 'unknown'}) ·{' '}
                          {new Date(entry.createdAt).toLocaleString()}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">Administrator actions will be recorded here.</div>
              )}
              {activityQuery.data && (
                <Pagination
                  page={activityQuery.data.page}
                  totalPages={activityQuery.data.totalPages}
                  onPage={setPage}
                />
              )}
            </DataState>
          )}
        </section>
      </div>
      {action && (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-action-title"
          >
            <h2 id="admin-action-title">
              {action.kind === 'remove'
                ? 'Remove listing'
                : action.kind === 'dismiss'
                  ? 'Dismiss moderation review'
                  : action.kind === 'suspend'
                    ? 'Suspend student'
                    : 'Restore student'}
            </h2>
            <p>{action.label}</p>
            <label>
              Reason (recorded in the audit log)
              <textarea
                value={reason}
                maxLength={500}
                minLength={3}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {actionError && (
              <p className="admin-error" role="alert">
                {actionError}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setAction(null);
                  setActionError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={reason.trim().length < 3 || actionMutation.isPending}
                onClick={() => actionMutation.mutate()}
              >
                {actionMutation.isPending ? 'Saving…' : 'Confirm action'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="admin-stat">
      <span className="admin-stat-icon">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
