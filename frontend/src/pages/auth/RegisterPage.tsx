import { Link } from 'react-router-dom';

export function RegisterPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ marginTop: 0 }}>Account Provisioning</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Self-registration is disabled. Please contact an administrator to create your account.
        </p>

        <p style={{ marginBottom: 0, marginTop: '0.9rem', color: 'var(--text-muted)' }}>
          Already have access? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
