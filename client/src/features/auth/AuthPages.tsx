import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ClipboardEvent,
  type ReactNode,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import type { User } from '@resello/shared';
import { api, getApiErrorCode, getApiErrorMessage } from '../../lib/api';
import { useAuth } from './AuthContext';

function destinationFor(user: User) {
  const savedMode = localStorage.getItem('resello:lastMode');
  const mode = savedMode === 'SELL' || savedMode === 'BUY' ? savedMode : user.lastActiveMode;
  return sessionStorage.getItem(`resello:lastRoute:${mode}`) ?? `/${mode.toLowerCase()}`;
}

function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/welcome" className="auth-back">
          <span aria-hidden="true">←</span>
          <img
            className="auth-brand-image"
            src="/resello-logo.png"
            alt="Resello — Online Resale Marketplace"
          />
        </Link>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
    </main>
  );
}

function AuthError({ message }: { message: string | null }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}

function getCollegeEmailError(email: string) {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf('@');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return 'Enter a valid email address.';
  if (normalized.slice(0, separator).includes('+'))
    return 'Please use your plain college address without a + tag.';
  const domain = normalized.slice(separator + 1);
  const allowed = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || 'pccoepune.org')
    .split(',')
    .map((entry) => entry.trim().toLowerCase());
  if (!allowed.includes(domain))
    return 'Only college emails work here. Use yourname@pccoepune.org.';
  return null;
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local.slice(0, 1)}${'*'.repeat(Math.min(Math.max(local.length - 1, 1), 5))}@${domain}`;
}

export function JoinPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = getCollegeEmailError(email);
    if (emailError) return setError(emailError);
    if (password.length < 10) return setError('Use at least 10 characters for your password.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setBusy(true);
    setError(null);
    try {
      await register({ name, email: email.trim().toLowerCase(), password, confirmPassword });
      sessionStorage.setItem('resello:verifyEmail', email.trim().toLowerCase());
      navigate('/verify', { state: { email: email.trim().toLowerCase() } });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  function updateEmail(value: string) {
    setEmail(value);
    const match = value.trim().match(/^([a-z]+)\.([a-z]+)\d{2}@/i);
    if (match && !name)
      setName(
        `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2][0].toUpperCase()}${match[2].slice(1)}`,
      );
  }

  const passwordStrength =
    password.length >= 12
      ? 'Strong'
      : password.length >= 10
        ? 'Good'
        : password.length
          ? 'Too short'
          : '';

  return (
    <AuthFrame
      eyebrow="A BETTER WAY TO PASS IT ON"
      title="Join Resello"
      description="One account for both sides of campus life."
    >
      <form className="auth-form join-form" onSubmit={submit}>
        <label>
          Full name
          <input
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Samarth Patil"
          />
        </label>
        <label>
          College email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => updateEmail(event.target.value)}
            placeholder="you@pccoepune.org"
          />
          <small>Use your college email, e.g. name.surname24@pccoepune.org</small>
        </label>
        <div className="auth-password-field">
          <label htmlFor="join-password">Password</label>
          <span className="auth-password-control">
            <input
              id="join-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 10 characters"
            />
            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </span>
          {passwordStrength && <small>Password strength: {passwordStrength}</small>}
        </div>
        <div className="auth-password-field">
          <label htmlFor="join-confirm-password">Confirm password</label>
          <span className="auth-password-control">
            <input
              id="join-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter your password again"
            />
            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              aria-pressed={showConfirmPassword}
              onClick={() => setShowConfirmPassword((visible) => !visible)}
            >
              {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </span>
        </div>
        <AuthError message={error} />
        <button className="button button-primary button-wide" type="submit" disabled={busy}>
          {busy ? 'Sending code…' : 'Send verification code'}
        </button>
      </form>
      <p className="auth-switch">
        Already a member? <Link to="/login">Log in</Link>
      </p>
    </AuthFrame>
  );
}

export function VerifyPage() {
  const { verify } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const routeEmail = (location.state as { email?: string } | null)?.email;
  const initialEmail = routeEmail ?? sessionStorage.getItem('resello:verifyEmail') ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(initialEmail ? 30 : 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  function updateCode(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = code.padEnd(6, ' ').split('');
    next[index] = digit;
    const updated = next.join('').replace(/\s/g, '');
    setCode(updated);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (updated.length === 6) void submitCode(updated);
  }

  function pasteCode(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      event.preventDefault();
      setCode(pasted);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
      if (pasted.length === 6) void submitCode(pasted);
    }
  }

  async function submitCode(value = code) {
    if (!email || value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await verify({ email, code: value });
      sessionStorage.removeItem('resello:verifyEmail');
      navigate(destinationFor(user), { replace: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
      setCode('');
      inputRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ resendAvailableInSec: number }>('/auth/resend-otp', {
        email,
        purpose: 'VERIFY_EMAIL',
      });
      setRemaining(response.data.resendAvailableInSec);
    } catch (resendError) {
      setError(getApiErrorMessage(resendError));
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(index: number, key: string) {
    if (key === 'Backspace' && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  }

  return (
    <AuthFrame
      eyebrow="ONE LAST STEP"
      title="Verify your college email"
      description={`We sent a 6-digit code to ${email ? maskEmail(email) : 'your college inbox'}.`}
    >
      {!email && (
        <label className="verify-email-field">
          College email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@pccoepune.org"
          />
        </label>
      )}
      <div className="otp-inputs" role="group" aria-label="6-digit verification code">
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            aria-label={`Digit ${index + 1} of 6`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            inputMode="numeric"
            maxLength={1}
            value={code[index] ?? ''}
            onChange={(event) => updateCode(index, event.target.value)}
            onPaste={pasteCode}
            onKeyDown={(event) => handleKeyDown(index, event.key)}
          />
        ))}
      </div>
      <p className="resend-copy">
        {remaining > 0
          ? `Resend code in 0:${String(remaining).padStart(2, '0')}`
          : 'Didn’t receive a code?'}
      </p>
      <AuthError message={error} />
      <button
        className="button button-primary button-wide"
        type="button"
        disabled={busy || code.length !== 6}
        onClick={() => void submitCode()}
      >
        {busy ? 'Verifying…' : 'Verify email'}
      </button>
      <button
        className="text-button"
        type="button"
        disabled={busy || remaining > 0 || !email}
        onClick={() => void resend()}
      >
        Resend code
      </button>
      <Link className="auth-switch" to="/join">
        Wrong email? Change it
      </Link>
    </AuthFrame>
  );
}

function useAuthDestination() {
  const navigate = useNavigate();
  return (user: User) => navigate(destinationFor(user), { replace: true });
}

export function LoginPage() {
  const { login } = useAuth();
  const goToDestination = useAuthDestination();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = getCollegeEmailError(email);
    if (emailError) return setError(emailError);
    setBusy(true);
    setError(null);
    try {
      goToDestination(await login({ email: email.trim().toLowerCase(), password }));
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
      if (getApiErrorCode(submitError) === 'EMAIL_NOT_VERIFIED') {
        const normalizedEmail = email.trim().toLowerCase();
        sessionStorage.setItem('resello:verifyEmail', normalizedEmail);
        navigate('/verify', { state: { email: normalizedEmail } });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="WELCOME BACK"
      title="Log in to Resello"
      description="Your campus finds and listings are waiting."
    >
      <form className="auth-form" onSubmit={submit}>
        <label>
          College email
          <input
            type="email"
            autoComplete="email"
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
            placeholder="Your password"
          />
        </label>
        <div className="form-row">
          <span />
          <Link to="/forgot">Forgot password?</Link>
        </div>
        <AuthError message={error} />
        <button className="button button-primary button-wide" type="submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="auth-switch">
        New to Resello? <Link to="/join">Create an account</Link>
      </p>
    </AuthFrame>
  );
}

export function ForgotPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = getCollegeEmailError(email);
    if (emailError) return setError(emailError);
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
      sessionStorage.setItem('resello:resetEmail', email.trim().toLowerCase());
      navigate('/reset', { state: { email: email.trim().toLowerCase() } });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="ACCOUNT RECOVERY"
      title={sent ? 'Check your college inbox' : 'Reset your password'}
      description="We’ll send a one-time code to your verified college email."
    >
      <form className="auth-form" onSubmit={submit}>
        <label>
          College email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@pccoepune.org"
          />
        </label>
        <AuthError message={error} />
        <button className="button button-primary button-wide" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset code'}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthFrame>
  );
}

export function ResetPage() {
  const location = useLocation();
  const routeEmail = (location.state as { email?: string } | null)?.email;
  const [email, setEmail] = useState(
    routeEmail ?? sessionStorage.getItem('resello:resetEmail') ?? '',
  );
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = getCollegeEmailError(email);
    if (emailError) return setError(emailError);
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        code,
        newPassword: password,
      });
      sessionStorage.removeItem('resello:resetEmail');
      navigate('/login', { replace: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="SECURE YOUR ACCOUNT"
      title="Choose a new password"
      description="Enter the code from your college inbox and choose a new password."
    >
      <form className="auth-form" onSubmit={submit}>
        {!routeEmail && (
          <label>
            College email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        )}
        <label>
          6-digit reset code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <AuthError message={error} />
        <button className="button button-primary button-wide" type="submit" disabled={busy}>
          {busy ? 'Updating…' : 'Reset password'}
        </button>
      </form>
    </AuthFrame>
  );
}

export function LoadingPage() {
  return (
    <main className="state-page" role="status">
      <span className="loading-spinner" />
      Checking your Resello session…
    </main>
  );
}

export function ConnectionErrorPage({ message, retry }: { message: string; retry: () => void }) {
  return (
    <main className="state-page">
      <span className="state-icon" aria-hidden="true">
        !
      </span>
      <h1>We can’t reach Resello</h1>
      <p>{message}</p>
      <button className="button button-primary" onClick={retry}>
        Try again
      </button>
    </main>
  );
}
