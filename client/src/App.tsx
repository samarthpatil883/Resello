import { Routes, Route, Navigate } from 'react-router-dom';

function WelcomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand-slate">Resello</h1>
        <p className="mt-2 text-text-muted">Campus Marketplace for PCCOE</p>
        <p className="mt-4 text-sm text-text-muted">Join with your college email</p>
      </div>
    </div>
  );
}

function BuyHome() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--buy-primary)' }}>Buy</h1>
      <p className="mt-2 text-text-muted">Buy storefront placeholder — coming in G1</p>
    </div>
  );
}

function SellHome() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--sell-primary)' }}>Sell</h1>
      <p className="mt-2 text-text-muted">Sell storefront placeholder — coming in G1</p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/buy" element={<BuyHome />} />
      <Route path="/buy/*" element={<BuyHome />} />
      <Route path="/sell" element={<SellHome />} />
      <Route path="/sell/*" element={<SellHome />} />
      <Route path="/" element={<Navigate to="/welcome" replace />} />
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}
