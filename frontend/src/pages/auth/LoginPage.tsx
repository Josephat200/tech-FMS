import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | undefined)?.from ?? '/dashboard';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login({ email, password });

      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={(event) => void onSubmit(event)}>
        <h2 style={{ marginTop: 0 }}>Secure Sign In</h2>
        <p style={{ color: 'var(--text-muted)' }}>Access FLORANTE TECH financial workspace.</p>

        <div className="form-row">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="form-row">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="btn primary" type="submit" disabled={submitting} style={{ width: '100%', marginTop: '0.8rem' }}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>

        <p style={{ marginBottom: 0, marginTop: '0.9rem', color: 'var(--text-muted)' }}>
          Access is provisioned by administrators only.
        </p>
      </form>
    </div>
  );
}
