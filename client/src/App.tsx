import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Mode } from '@resello/shared';
import { ModeShell } from './app/ModeShell';
import { AuthProvider } from './features/auth/AuthProvider';
import { useAuth } from './features/auth/AuthContext';
import { SellerOnboardingPage } from './features/sell/SellerOnboardingPage';
import {
  BuyCartPage,
  BuyCategoriesPage,
  BuyHomePage,
  BuyOrdersPage,
  BuySearchPage,
  NotificationsPage,
  QuickListPage,
  SellHomePage,
  SellListingsPage,
  SellOrdersPage,
  SharedProfilePage,
} from './features/buy/StorefrontPages';
import {
  ConnectionErrorPage,
  ForgotPage,
  JoinPage,
  LoadingPage,
  LoginPage,
  ResetPage,
  VerifyPage,
} from './features/auth/AuthPages';
import Welcome from './features/auth/Welcome';
import { BuyCheckoutPage, BuyListingPage, BuyWishlistPage } from './features/buy/MarketplacePages';
import { AdminDashboardPage, AdminLoginPage } from './features/admin/AdminPages';

function ProtectedRoutes() {
  const { user, loading, error, reload } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingPage />;
  if (error) return <ConnectionErrorPage message={error} retry={() => void reload()} />;
  if (!user)
    return (
      <Navigate
        to={location.pathname.startsWith('/admin') ? '/admin/login' : '/welcome'}
        replace
        state={{ from: location.pathname }}
      />
    );
  if (
    location.pathname.startsWith('/sell') &&
    location.pathname !== '/sell/onboarding' &&
    !user.sellerOnboardedAt
  ) {
    return <Navigate to="/sell/onboarding" replace />;
  }
  if (location.pathname === '/sell/onboarding' && user.sellerOnboardedAt) {
    return <Navigate to="/sell" replace />;
  }
  return <Outlet />;
}

function AdminLoginRoute() {
  const { user, loading, error, reload } = useAuth();
  if (loading) return <LoadingPage />;
  if (error) return <ConnectionErrorPage message={error} retry={() => void reload()} />;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <AdminLoginPage />;
}

function AdminRoute() {
  const { user, loading, error, reload } = useAuth();
  if (loading) return <LoadingPage />;
  if (error) return <ConnectionErrorPage message={error} retry={() => void reload()} />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== 'ADMIN') {
    return (
      <main className="state-page">
        <span className="state-icon" aria-hidden="true">
          !
        </span>
        <h1>Administrator access required.</h1>
        <p>This account does not have the administrator role.</p>
        <Link className="button button-secondary" to="/buy">
          Back to marketplace
        </Link>
      </main>
    );
  }
  return <AdminDashboardPage />;
}

function PublicRoutes() {
  const { user, loading, error, reload } = useAuth();
  if (loading) return <LoadingPage />;
  if (error) return <ConnectionErrorPage message={error} retry={() => void reload()} />;
  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/buy'} replace />;
  }
  return <Outlet />;
}

function SharedProfileRoute() {
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const savedMode = localStorage.getItem('resello:lastMode');
  const mode =
    savedMode === Mode.SELL || savedMode === Mode.BUY
      ? savedMode
      : (user?.lastActiveMode ?? Mode.BUY);

  async function signOut() {
    try {
      setLogoutError(null);
      await logout();
    } catch (error) {
      setLogoutError('Could not sign out right now. Check your connection and try again.');
      console.error('Sign out failed:', error);
    }
  }

  return (
    <ModeShell mode={mode}>
      <SharedProfilePage onLogout={() => void signOut()} logoutError={logoutError} />
    </ModeShell>
  );
}

function SharedNotificationsRoute() {
  const { user } = useAuth();
  return (
    <ModeShell mode={user?.lastActiveMode ?? Mode.BUY}>
      <NotificationsPage />
    </ModeShell>
  );
}

function SellReviewsPlaceholder() {
  return (
    <div className="storefront-page">
      <div className="search-empty">
        <h1 tabIndex={-1}>Seller reviews</h1>
        <p>Reviews will appear here after completed campus orders.</p>
      </div>
    </div>
  );
}

function RouteTable() {
  return (
    <>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginRoute />} />
        <Route element={<PublicRoutes />}>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot" element={<ForgotPage />} />
          <Route path="/reset" element={<ResetPage />} />
        </Route>
        <Route element={<ProtectedRoutes />}>
          <Route path="/buy" element={<ModeShell mode={Mode.BUY} />}>
            <Route index element={<BuyHomePage />} />
            <Route path="categories" element={<BuyCategoriesPage />} />
            <Route path="search" element={<BuySearchPage />} />
            <Route path="cart" element={<BuyCartPage />} />
            <Route path="wishlist" element={<BuyWishlistPage />} />
            <Route path="checkout" element={<BuyCheckoutPage />} />
            <Route path="orders" element={<BuyOrdersPage />} />
            <Route path="listing/:id" element={<BuyListingPage />} />
            <Route path="*" element={<BuyHomePage />} />
          </Route>
          <Route path="/sell" element={<ModeShell mode={Mode.SELL} />}>
            <Route index element={<SellHomePage />} />
            <Route path="onboarding" element={<SellerOnboardingPage />} />
            <Route path="listings" element={<SellListingsPage />} />
            <Route path="listings/new" element={<QuickListPage />} />
            <Route path="listings/:id/edit" element={<QuickListPage />} />
            <Route path="orders" element={<SellOrdersPage />} />
            <Route path="reviews" element={<SellReviewsPlaceholder />} />
            <Route path="*" element={<SellHomePage />} />
          </Route>
          <Route path="/profile" element={<SharedProfileRoute />} />
          <Route path="/notifications" element={<SharedNotificationsRoute />} />
          <Route path="/admin/*" element={<AdminRoute />} />
        </Route>
        <Route path="/" element={<Navigate to="/welcome" replace />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <RouteTable />
    </AuthProvider>
  );
}
