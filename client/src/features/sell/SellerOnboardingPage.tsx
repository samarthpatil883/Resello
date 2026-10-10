import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PickupPreference } from '@resello/shared';
import { api, getApiErrorMessage } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';

export function SellerOnboardingPage() {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [pickupPreference, setPickupPreference] = useState<PickupPreference>(
    PickupPreference.ON_CAMPUS,
  );
  const [phone, setPhone] = useState('');
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  function useCurrentLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError(
        'Your browser does not support location. Enter the campus coordinates below.',
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude.toFixed(6));
        setLongitude(coords.longitude.toFixed(6));
      },
      () =>
        setLocationError(
          'Could not get your location. Check permission or enter the campus coordinates below.',
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      setError('Enter valid latitude and longitude for your campus location.');
      return;
    }
    if (!guidelinesAccepted) {
      setError('Please accept the seller guidelines to continue.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ sellerOnboardedAt: string }>('/me/seller-onboarding', {
        campusLocation: { type: 'Point', coordinates: [lng, lat] },
        pickupPreference,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      updateUser({ sellerOnboardedAt: response.data.sellerOnboardedAt });
      navigate('/sell', { replace: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="storefront-page onboarding-page">
      <div className="page-heading">
        <p className="eyebrow">ONE ACCOUNT, TWO STOREFRONTS</p>
        <h1 tabIndex={-1}>Start selling on Resello</h1>
        <p>Your account stays the same. Tell us how campus handovers should work for you.</p>
      </div>
      <form className="onboarding-card" onSubmit={submit}>
        <div className="onboarding-location-heading">
          <div>
            <h2>Your campus location</h2>
            <p>Used to help nearby students find your listings.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={useCurrentLocation}>
            Use my location
          </button>
        </div>
        <div className="coordinate-fields">
          <label>
            Latitude
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              required
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="e.g. 18.65"
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              required
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="e.g. 73.76"
            />
          </label>
        </div>
        {locationError && (
          <p className="inline-notice" role="status">
            {locationError}
          </p>
        )}
        <label className="onboarding-label">
          Pickup preference
          <select
            value={pickupPreference}
            onChange={(event) => setPickupPreference(event.target.value as PickupPreference)}
          >
            <option value={PickupPreference.ON_CAMPUS}>Meet on campus</option>
            <option value={PickupPreference.HOSTEL_GATE}>Hostel gate</option>
            <option value={PickupPreference.DEPARTMENT}>Department</option>
          </select>
        </label>
        <label className="onboarding-label">
          Phone number <span className="optional-label">Optional</span>
          <input
            type="tel"
            autoComplete="tel"
            maxLength={30}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+91"
          />
        </label>
        <label className="guidelines-check">
          <input
            type="checkbox"
            checked={guidelinesAccepted}
            onChange={(event) => setGuidelinesAccepted(event.target.checked)}
          />
          <span>
            I agree to be honest in my listings, follow campus rules and use cash only for COD
            handovers.
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-sell button-wide" type="submit" disabled={busy}>
          {busy ? 'Saving your seller space…' : 'Start selling'}
        </button>
      </form>
    </div>
  );
}
