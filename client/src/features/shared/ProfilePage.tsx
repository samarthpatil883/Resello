import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  LogOut,
  PackageCheck,
  Pencil,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { NotificationPreferences, User } from '@resello/shared';
import { api, getApiErrorMessage } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';

type ProfileSection = 'personal' | 'notifications' | 'transactions';
type ProfileTab = 'details' | 'security';

interface ProfileOrder {
  id: string;
  title: string;
  price: number;
  status: 'PLACED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

interface SellerStats {
  activeListings: number;
  completedSales: number;
  averageRating: number | null;
  ratingCount: number;
}

interface ProfileDraft {
  name: string;
  department: string;
  graduationYear: string;
  bio: string;
  phone: string;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const notificationOptions: Array<{
  key: keyof NotificationPreferences;
  title: string;
  description: string;
}> = [
  {
    key: 'orderUpdates',
    title: 'Orders and transactions',
    description: 'Purchase, sale, handover, payment, and message updates.',
  },
  {
    key: 'marketplaceUpdates',
    title: 'New marketplace listings',
    description: 'Get notified when a new item is listed by another student.',
  },
  {
    key: 'reviewUpdates',
    title: 'Ratings and reviews',
    description: 'Know when a buyer leaves a review for your completed sale.',
  },
  {
    key: 'accountUpdates',
    title: 'Account and trust updates',
    description: 'Important account and listing moderation notices.',
  },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getAvatarSource(user: User) {
  if (!user.avatarUrl) return null;
  const apiOrigin = new URL(api.defaults.baseURL ?? window.location.origin, window.location.origin)
    .origin;
  return new URL(user.avatarUrl, apiOrigin).toString();
}

async function prepareAvatar(file: File): Promise<File> {
  const image = await createImageBitmap(file);
  try {
    const cropSize = Math.min(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');

    context.fillStyle = '#e7f4f1';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      (image.width - cropSize) / 2,
      (image.height - cropSize) / 2,
      cropSize,
      cropSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const webpBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.88),
    );
    const blob =
      webpBlob?.type === 'image/webp'
        ? webpBlob
        : await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.88),
          );
    if (!blob || (blob.type !== 'image/webp' && blob.type !== 'image/jpeg')) {
      throw new Error('Avatar image could not be encoded');
    }

    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `profile-photo.${extension}`, { type: blob.type });
  } finally {
    image.close();
  }
}

function orderStatusLabel(status: ProfileOrder['status']) {
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'In progress';
}

export function SharedProfilePage({
  onLogout,
  logoutError,
}: {
  onLogout: () => void;
  logoutError: string | null;
}) {
  const { user, updateUser } = useAuth();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<ProfileSection>('personal');
  const [tab, setTab] = useState<ProfileTab>('details');
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(
    user?.notificationPreferences ?? null,
  );
  const [buyerOrders, setBuyerOrders] = useState<ProfileOrder[]>([]);
  const [sellerOrders, setSellerOrders] = useState<ProfileOrder[]>([]);
  const [sellerStats, setSellerStats] = useState<SellerStats | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(() => ({
    name: user?.name ?? '',
    department: user?.department ?? '',
    graduationYear: user?.graduationYear?.toString() ?? '',
    bio: user?.bio ?? '',
    phone: user?.phone ?? '',
  }));
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!user) return;
    setDraft({
      name: user.name,
      department: user.department ?? '',
      graduationYear: user.graduationYear?.toString() ?? '',
      bio: user.bio ?? '',
      phone: user.phone ?? '',
    });
    setPreferences(user.notificationPreferences);
  }, [user]);

  useEffect(() => {
    let active = true;
    setOrdersLoading(true);
    setOrdersError(null);
    Promise.all([
      api.get<{ orders: ProfileOrder[] }>('/orders?side=buyer'),
      api.get<{ orders: ProfileOrder[] }>('/orders?side=seller'),
      api.get<SellerStats>('/me/seller-stats'),
    ])
      .then(([buyer, seller, stats]) => {
        if (!active) return;
        setBuyerOrders(buyer.data.orders);
        setSellerOrders(seller.data.orders);
        setSellerStats(stats.data);
      })
      .catch((requestError: unknown) => {
        if (active) setOrdersError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!user) return null;

  const completedPurchases = buyerOrders.filter((order) => order.status === 'COMPLETED');
  const completedSales = sellerOrders.filter((order) => order.status === 'COMPLETED');
  const avatarSource = getAvatarSource(user);
  const recentOrders = [
    ...buyerOrders.map((order) => ({ ...order, side: 'Purchased' })),
    ...sellerOrders.map((order) => ({ ...order, side: 'Sold' })),
  ]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 6);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    try {
      const response = await api.patch<{ user: User }>('/me/profile', {
        name: draft.name,
        department: draft.department.trim() || null,
        graduationYear: draft.graduationYear ? Number(draft.graduationYear) : null,
        bio: draft.bio.trim() || null,
        phone: draft.phone.trim() || null,
      });
      updateUser(response.data.user);
      setEditing(false);
    } catch (requestError) {
      setProfileError(getApiErrorMessage(requestError));
    } finally {
      setSavingProfile(false);
    }
  }

  async function updatePreference(key: keyof NotificationPreferences, enabled: boolean) {
    if (!preferences) return;
    const updated = { ...preferences, [key]: enabled };
    setPreferences(updated);
    setSavingPreferences(true);
    setPreferencesError(null);
    try {
      const response = await api.put<{ preferences: NotificationPreferences }>(
        '/me/notification-preferences',
        updated,
      );
      setPreferences(response.data.preferences);
      updateUser({ notificationPreferences: response.data.preferences });
    } catch (requestError) {
      setPreferences(preferences);
      setPreferencesError(getApiErrorMessage(requestError));
    } finally {
      setSavingPreferences(false);
    }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarBusy(true);
    setProfileError(null);
    try {
      let adjustedFile: File;
      try {
        adjustedFile = await prepareAvatar(file);
      } catch {
        setProfileError('This photo could not be adjusted. Choose a valid JPEG, PNG, or WebP image.');
        return;
      }

      const formData = new FormData();
      formData.append('avatar', adjustedFile);
      const response = await api.post<{ user: User }>('/me/avatar', formData);
      updateUser(response.data.user);
    } catch (requestError) {
      setProfileError(getApiErrorMessage(requestError));
    } finally {
      setAvatarBusy(false);
      if (avatarInput.current) avatarInput.current.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setProfileError(null);
    try {
      const response = await api.delete<{ user: User }>('/me/avatar');
      updateUser(response.data.user);
    } catch (requestError) {
      setProfileError(getApiErrorMessage(requestError));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordError('Your new password and confirmation do not match.');
      return;
    }
    if (passwordDraft.newPassword.length < 10) {
      setPasswordError('Use at least 10 characters for your new password.');
      return;
    }
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordDraft.currentPassword,
        newPassword: passwordDraft.newPassword,
      });
      setPasswordDraft({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage('Password updated. Other active sessions have been signed out.');
    } catch (requestError) {
      setPasswordError(getApiErrorMessage(requestError));
    }
  }

  function updateDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="storefront-page profile-page">
      <header className="page-heading">
        <p className="page-kicker">YOUR RESELLO ACCOUNT</p>
        <h1>Your profile</h1>
      </header>

      <section className="profile-hero" aria-label="Profile overview">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar" aria-label={`${user.name}'s profile photo`}>
            {avatarSource ? <img src={avatarSource} alt="" /> : <span>{initials(user.name)}</span>}
          </div>
          <button
            type="button"
            className="profile-avatar-edit"
            aria-label="Upload profile photo; it will be centered and resized automatically"
            title="Profile photos are centered and resized automatically"
            onClick={() => avatarInput.current?.click()}
            disabled={avatarBusy}
          >
            <Camera size={16} aria-hidden="true" />
          </button>
          <span className="profile-avatar-hint">Auto-fit on upload</span>
          <input
            ref={avatarInput}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void uploadAvatar(event.currentTarget.files?.[0])}
          />
        </div>
        <div className="profile-hero-copy">
          <span className="profile-verification">
            <CheckCircle2 size={17} /> Verified PCCOE student
          </span>
          <h2>{user.name}</h2>
          <p>
            {user.department || 'PCCOE student'}
            {user.graduationYear ? ` · Class of ${user.graduationYear}` : ''}
          </p>
          <p className="profile-email">{user.email}</p>
        </div>
        <div className="profile-hero-actions">
          {user.avatarUrl && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void removeAvatar()}
              disabled={avatarBusy}
            >
              <Trash2 size={16} /> Remove photo
            </button>
          )}
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setSection('personal');
              setTab('details');
              setEditing(true);
            }}
          >
            <Pencil size={16} /> Edit profile
          </button>
        </div>
      </section>

      {profileError && (
        <p className="profile-alert" role="alert">
          {profileError}
        </p>
      )}
      {logoutError && (
        <p className="profile-alert" role="alert">
          {logoutError}
        </p>
      )}
      {ordersError && (
        <p className="profile-alert" role="alert">
          Marketplace activity could not be loaded: {ordersError}
        </p>
      )}

      <section className="profile-metrics" aria-label="Marketplace activity summary">
        <article className="profile-metric">
          <span>
            <PackageCheck size={18} /> Items sold
          </span>
          <strong>{ordersLoading || ordersError ? '—' : completedSales.length}</strong>
          <small>{ordersError ? 'Unavailable' : 'Completed handovers'}</small>
        </article>
        <article className="profile-metric">
          <span>
            <BookOpen size={18} /> Items bought
          </span>
          <strong>{ordersLoading || ordersError ? '—' : completedPurchases.length}</strong>
          <small>{ordersError ? 'Unavailable' : 'Completed purchases'}</small>
        </article>
        <article className="profile-metric">
          <span>
            <Star size={18} /> Seller rating
          </span>
          <strong>
            {ordersLoading || ordersError || sellerStats?.averageRating == null
              ? ordersLoading
                ? '—'
                : ordersError
                  ? '—'
                  : 'New'
              : sellerStats.averageRating.toFixed(1)}
          </strong>
          <small>
            {ordersError ? 'Unavailable' : `${sellerStats?.ratingCount ?? 0} buyer reviews`}
          </small>
        </article>
        <article className="profile-metric">
          <span>
            <UserRound size={18} /> Active listings
          </span>
          <strong>{ordersLoading || ordersError ? '—' : (sellerStats?.activeListings ?? 0)}</strong>
          <small>{ordersError ? 'Unavailable' : 'Currently in the marketplace'}</small>
        </article>
      </section>

      <div className="profile-layout">
        <nav className="profile-sidebar" aria-label="Profile sections">
          <button
            type="button"
            className={section === 'personal' ? 'is-active' : ''}
            aria-current={section === 'personal' ? 'page' : undefined}
            onClick={() => setSection('personal')}
          >
            <UserRound size={18} /> Personal information
          </button>
          <button
            type="button"
            className={section === 'notifications' ? 'is-active' : ''}
            aria-current={section === 'notifications' ? 'page' : undefined}
            onClick={() => setSection('notifications')}
          >
            <Bell size={18} /> Notification preferences
          </button>
          <button
            type="button"
            className={section === 'transactions' ? 'is-active' : ''}
            aria-current={section === 'transactions' ? 'page' : undefined}
            onClick={() => setSection('transactions')}
          >
            <Clock3 size={18} /> Transactions
          </button>
          <button type="button" className="profile-logout" onClick={onLogout}>
            <LogOut size={18} /> Log out
          </button>
        </nav>

        <section className="profile-panel">
          {section === 'personal' && (
            <>
              <div className="profile-panel-heading">
                <div>
                  <h2>Personal information</h2>
                  <p>Your profile is shared across your Buy and Sell storefronts.</p>
                </div>
                <div className="profile-tabs" role="tablist" aria-label="Profile information">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'details'}
                    onClick={() => setTab('details')}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'security'}
                    onClick={() => setTab('security')}
                  >
                    Trust &amp; security
                  </button>
                </div>
              </div>

              {tab === 'details' ? (
                <form className="profile-details" onSubmit={(event) => void saveProfile(event)}>
                  <label>
                    Full name
                    <input
                      value={draft.name}
                      disabled={!editing || savingProfile}
                      maxLength={80}
                      minLength={2}
                      required
                      onChange={(event) => updateDraft('name', event.target.value)}
                    />
                  </label>
                  <label>
                    Verified college email
                    <input value={user.email} readOnly aria-describedby="verified-email-note" />
                    <small id="verified-email-note">
                      College email is verified and cannot be changed.
                    </small>
                  </label>
                  <label>
                    Department
                    <input
                      value={draft.department}
                      disabled={!editing || savingProfile}
                      maxLength={100}
                      placeholder="e.g. Computer Engineering"
                      onChange={(event) => updateDraft('department', event.target.value)}
                    />
                  </label>
                  <label>
                    Graduation year
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={draft.graduationYear}
                      disabled={!editing || savingProfile}
                      placeholder="e.g. 2027"
                      onChange={(event) => updateDraft('graduationYear', event.target.value)}
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      type="tel"
                      maxLength={25}
                      value={draft.phone}
                      disabled={!editing || savingProfile}
                      placeholder="Add a contact number"
                      onChange={(event) => updateDraft('phone', event.target.value)}
                    />
                  </label>
                  <label className="profile-wide-field">
                    About me
                    <textarea
                      value={draft.bio}
                      disabled={!editing || savingProfile}
                      maxLength={180}
                      placeholder="A short introduction for the campus community"
                      onChange={(event) => updateDraft('bio', event.target.value)}
                    />
                    <small>{draft.bio.length}/180 characters</small>
                  </label>
                  {editing && (
                    <div className="profile-form-actions profile-wide-field">
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={savingProfile}
                        onClick={() => {
                          setDraft({
                            name: user.name,
                            department: user.department ?? '',
                            graduationYear: user.graduationYear?.toString() ?? '',
                            bio: user.bio ?? '',
                            phone: user.phone ?? '',
                          });
                          setEditing(false);
                          setProfileError(null);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="button button-primary"
                        type="submit"
                        disabled={savingProfile}
                      >
                        {savingProfile ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <div className="profile-trust-list">
                  <article>
                    <span className="profile-trust-icon">
                      <BadgeCheck size={20} />
                    </span>
                    <div>
                      <strong>College email verified</strong>
                      <p>{user.email}</p>
                    </div>
                    <CheckCircle2 className="profile-trust-check" size={19} />
                  </article>
                  <article>
                    <span className="profile-trust-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <strong>One verified account</strong>
                      <p>Your Buy and Sell spaces use this account.</p>
                    </div>
                    <CheckCircle2 className="profile-trust-check" size={19} />
                  </article>
                  <form
                    className="profile-password-form"
                    onSubmit={(event) => void changePassword(event)}
                  >
                    <h3>
                      <LockKeyhole size={18} /> Change password
                    </h3>
                    <label>
                      Current password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={passwordDraft.currentPassword}
                        required
                        onChange={(event) =>
                          setPasswordDraft((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      New password
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={128}
                        value={passwordDraft.newPassword}
                        required
                        onChange={(event) =>
                          setPasswordDraft((current) => ({
                            ...current,
                            newPassword: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Confirm new password
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={128}
                        value={passwordDraft.confirmPassword}
                        required
                        onChange={(event) =>
                          setPasswordDraft((current) => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }))
                        }
                      />
                    </label>
                    {passwordError && (
                      <p className="profile-alert" role="alert">
                        {passwordError}
                      </p>
                    )}
                    {passwordMessage && (
                      <p className="profile-success" role="status">
                        {passwordMessage}
                      </p>
                    )}
                    <button className="button button-primary" type="submit">
                      Update password
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {section === 'notifications' && (
            <div className="profile-preferences">
              <div className="profile-panel-heading">
                <div>
                  <h2>Notification preferences</h2>
                  <p>Choose which Resello updates appear in your notification centre.</p>
                </div>
              </div>
              {preferencesError && (
                <p className="profile-alert" role="alert">
                  {preferencesError}
                </p>
              )}
              {preferences ? (
                notificationOptions.map((option) => (
                  <label key={option.key} className="profile-preference-row">
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.description}</small>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={preferences[option.key]}
                      disabled={savingPreferences}
                      onChange={(event) => void updatePreference(option.key, event.target.checked)}
                    />
                  </label>
                ))
              ) : (
                <p className="profile-muted">Notification preferences are unavailable.</p>
              )}
              {savingPreferences && <small className="profile-muted">Saving preferences…</small>}
            </div>
          )}

          {section === 'transactions' && (
            <div className="profile-transactions">
              <div className="profile-panel-heading">
                <div>
                  <h2>Transaction history &amp; statistics</h2>
                  <p>Your purchases and sales across both storefronts.</p>
                </div>
              </div>
              {ordersError && (
                <p className="profile-alert" role="alert">
                  {ordersError}
                </p>
              )}
              <div className="profile-transaction-totals">
                <article>
                  <span>Completed purchases</span>
                  <strong>{ordersError ? '—' : completedPurchases.length}</strong>
                  <small>
                    {ordersError
                      ? 'Unavailable'
                      : `${currency.format(completedPurchases.reduce((sum, order) => sum + order.price, 0))} spent`}
                  </small>
                </article>
                <article>
                  <span>Completed sales</span>
                  <strong>{ordersError ? '—' : completedSales.length}</strong>
                  <small>
                    {ordersError
                      ? 'Unavailable'
                      : `${currency.format(completedSales.reduce((sum, order) => sum + order.price, 0))} sold`}
                  </small>
                </article>
              </div>
              <h3 className="profile-history-title">Recent activity</h3>
              {ordersLoading ? (
                <p className="profile-muted">Loading your transactions…</p>
              ) : ordersError ? (
                <p className="profile-muted">Transaction history is unavailable right now.</p>
              ) : recentOrders.length === 0 ? (
                <div className="profile-empty">
                  <Clock3 size={24} />
                  <strong>No transactions yet</strong>
                  <p>Your purchases and sales will appear here.</p>
                </div>
              ) : (
                <ul className="profile-order-list">
                  {recentOrders.map((order) => (
                    <li key={`${order.side}-${order.id}`}>
                      <span className="profile-order-icon">
                        <PackageCheck size={19} />
                      </span>
                      <span className="profile-order-description">
                        <strong>{order.title}</strong>
                        <small>
                          {order.side} · {new Date(order.createdAt).toLocaleDateString()}
                        </small>
                      </span>
                      <span className="profile-order-value">
                        <strong>{currency.format(order.price)}</strong>
                        <small>{orderStatusLabel(order.status)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
