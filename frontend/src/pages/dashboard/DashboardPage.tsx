import { useEffect, useState } from 'react';
import { alertApi, FinancialAlert } from '../../api/alertApi';
import { useAuth } from '../../hooks/useAuth';
import { RoleGate } from '../../components/rbac/RoleGate';

export function DashboardPage() {
  const { hasRole } = useAuth();
  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);
  const [error, setError] = useState('');

  const canRunScan = hasRole(['ADMIN', 'FINANCE_MANAGER']);

  const loadAlerts = async () => {
    try {
      const response = await alertApi.listOpen();
      setAlerts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, []);

  const runAlertScan = async () => {
    setError('');
    try {
      await alertApi.runScan();
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run alert scan');
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    setError('');
    try {
      await alertApi.acknowledge(alertId);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  };

  return (
    <section className="page">
      <h1 style={{ margin: 0 }}>Financial Dashboard</h1>
      <div className="grid cols-3">
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Net Position</small>
          <h2 style={{ margin: '0.5rem 0 0' }}>$ 2,489,320</h2>
          <span className="badge success" style={{ marginTop: '0.5rem' }}>+8.2% this month</span>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Outstanding Invoices</small>
          <h2 style={{ margin: '0.5rem 0 0' }}>$ 742,910</h2>
          <span className="badge warn" style={{ marginTop: '0.5rem' }}>18 require follow-up</span>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Payroll Burn Rate</small>
          <h2 style={{ margin: '0.5rem 0 0' }}>$ 184,000 / month</h2>
          <span className="badge info" style={{ marginTop: '0.5rem' }}>Within target</span>
        </article>
      </div>

      <div className="card">
        <div className="page-header">
          <h3 style={{ margin: 0 }}>Financial Alerts</h3>
          {canRunScan ? (
            <button className="btn ghost no-print" onClick={() => void runAlertScan()}>
              Run Alert Scan
            </button>
          ) : null}
        </div>
        {error ? <div className="error-text" style={{ marginBottom: '0.8rem' }}>{error}</div> : null}
        <table className="table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Title</th>
              <th>Message</th>
              <th>Created</th>
              <th className="no-print">Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={5}>No open alerts.</td>
              </tr>
            ) : null}
            {alerts.map((alert) => (
              <tr key={alert.alertId}>
                <td>
                  <span className={`badge ${alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'warn' : 'info'}`}>
                    {alert.severity}
                  </span>
                </td>
                <td>{alert.title}</td>
                <td>{alert.message}</td>
                <td>{new Date(alert.createdAt).toLocaleString()}</td>
                <td className="no-print">
                  <button className="btn ghost" onClick={() => void acknowledgeAlert(alert.alertId)}>
                    Acknowledge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cashflow Highlights</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Inflows</th>
              <th>Outflows</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Jan 2026</td>
              <td>$ 413,000</td>
              <td>$ 382,000</td>
              <td>$ 31,000</td>
            </tr>
            <tr>
              <td>Feb 2026</td>
              <td>$ 462,000</td>
              <td>$ 401,000</td>
              <td>$ 61,000</td>
            </tr>
          </tbody>
        </table>
      </div>

      <RoleGate allowedRoles={['ADMIN', 'FINANCE_MANAGER']}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Executive Controls</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            This section is rendered only for privileged finance roles.
          </p>
        </div>
      </RoleGate>
    </section>
  );
}
