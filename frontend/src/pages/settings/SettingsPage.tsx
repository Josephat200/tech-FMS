import { FormEvent, useEffect, useMemo, useState } from 'react';
import { settingsApi, AuditLog, ChangeRequest, SystemUser } from '../../api/settingsApi';
import { useAuth } from '../../hooks/useAuth';
import { assistantApi, AssistantConfig, AssistantHealth, AssistantMetrics } from '../../api/assistantApi';

type CreateUserForm = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'HR' | 'AUDITOR' | 'DEPARTMENT_MANAGER' | 'USER';
};

const emptyCreateUserForm: CreateUserForm = {
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  role: 'ACCOUNTANT',
};

export function SettingsPage() {
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMode, setEditingMode] = useState(false);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>(emptyCreateUserForm);
  const [assistantConfig, setAssistantConfig] = useState<AssistantConfig>({
    systemPrompt: '',
    temperature: 0.2,
    maxTokens: 350,
  });
  const [assistantMetrics, setAssistantMetrics] = useState<AssistantMetrics | null>(null);
  const [assistantHealth, setAssistantHealth] = useState<AssistantHealth | null>(null);
  const [assistantHealthCheckedAt, setAssistantHealthCheckedAt] = useState<string | null>(null);
  const [isTestingAssistant, setIsTestingAssistant] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [error, setError] = useState<string>('');

  const summary = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.isActive).length;
    return {
      total,
      active,
      pending: requests.length,
    };
  }, [requests.length, users]);

  const loadAll = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [editingModeRes, usersRes, requestsRes, auditRes, assistantConfigRes, assistantMetricsRes, assistantHealthRes] = await Promise.all([
        settingsApi.getEditingMode(),
        settingsApi.getUsers(),
        settingsApi.getChangeRequests(),
        settingsApi.getAuditLogs(),
        assistantApi.getConfig(),
        assistantApi.getMetrics(30),
        assistantApi.getHealth(),
      ]);

      setEditingMode(editingModeRes.data.enabled);
      setUsers(usersRes.data);
      setRequests(requestsRes.data);
      setAuditLogs(auditRes.data);
      setAssistantConfig(assistantConfigRes.data);
      setAssistantMetrics(assistantMetricsRes.data);
      setAssistantHealth(assistantHealthRes.data);
      setAssistantHealthCheckedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const onSubmitCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback('');
    setError('');

    try {
      await settingsApi.createUser(createUserForm);
      setFeedback('User created and credentials dispatched to email (if SMTP is configured).');
      setCreateUserForm(emptyCreateUserForm);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSaving(false);
    }
  };

  const onToggleUserStatus = async (user: SystemUser) => {
    setIsSaving(true);
    setFeedback('');
    setError('');

    try {
      await settingsApi.updateUserStatus(user.userId, !user.isActive);
      setFeedback(`User ${user.email} has been ${user.isActive ? 'deactivated' : 'activated'}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    } finally {
      setIsSaving(false);
    }
  };

  const onResetPassword = async (user: SystemUser) => {
    if (user.userId === currentUser?.sub) {
      setError('You cannot reset your own password from admin user management.');
      return;
    }

    const newPassword = window.prompt(`Enter a new password for ${user.email} (minimum 12 characters):`);
    if (!newPassword) {
      return;
    }

    if (newPassword.trim().length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    const confirmation = window.prompt('Re-enter the new password for confirmation:');
    if (!confirmation) {
      return;
    }

    if (newPassword !== confirmation) {
      setError('Password confirmation did not match.');
      return;
    }

    setIsSaving(true);
    setFeedback('');
    setError('');

    try {
      await settingsApi.resetUserPassword(user.userId, newPassword);
      setFeedback(`Password updated for ${user.email}. Existing sessions were revoked.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset user password');
    } finally {
      setIsSaving(false);
    }
  };

  const onApprove = async (changeRequestId: string) => {
    setIsSaving(true);
    setFeedback('');
    setError('');

    try {
      await settingsApi.approveChangeRequest(changeRequestId);
      setFeedback('Change request approved and executed.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setIsSaving(false);
    }
  };

  const onReject = async (changeRequestId: string) => {
    const reason = window.prompt('Reason for rejection (required):', 'Insufficient justification');
    if (!reason) {
      return;
    }

    setIsSaving(true);
    setFeedback('');
    setError('');

    try {
      await settingsApi.rejectChangeRequest(changeRequestId, reason);
      setFeedback('Change request rejected.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setIsSaving(false);
    }
  };

  const onToggleEditingMode = async () => {
    setIsSaving(true);
    setFeedback('');
    setError('');

    try {
      const next = !editingMode;
      await settingsApi.setEditingMode(next);
      setEditingMode(next);
      setFeedback(`Admin editing mode ${next ? 'enabled' : 'disabled'}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update editing mode');
    } finally {
      setIsSaving(false);
    }
  };

  const onSaveAssistantConfig = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback('');
    setError('');

    try {
      await assistantApi.updateConfig({
        systemPrompt: assistantConfig.systemPrompt,
        temperature: Number(assistantConfig.temperature),
        maxTokens: Number(assistantConfig.maxTokens),
      });
      setFeedback('Assistant policy updated successfully.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assistant policy');
    } finally {
      setIsSaving(false);
    }
  };

  const onTestAssistantConnection = async () => {
    setIsTestingAssistant(true);
    setFeedback('');
    setError('');

    try {
      const response = await assistantApi.getHealth();
      setAssistantHealth(response.data);
      setAssistantHealthCheckedAt(new Date().toISOString());

      if (response.data.reachable) {
        setFeedback('Assistant provider connection is healthy.');
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test assistant provider connection');
    } finally {
      setIsTestingAssistant(false);
    }
  };

  if (isLoading) {
    return <section className="page">Loading settings...</section>;
  }

  return (
    <section className="page">
      <h1 style={{ margin: 0 }}>Settings & Control Center</h1>
      <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
        Finance staff operate the platform, IT maintains infrastructure, and management reviews reports.
        Administrative controls below enforce approval workflow and full change visibility.
      </p>

      {(feedback || error) && (
        <div className="card" style={{ boxShadow: 'none' }}>
          {feedback && <div style={{ color: 'var(--success)' }}>{feedback}</div>}
          {error && <div className="error-text">{error}</div>}
        </div>
      )}

      <div className="grid cols-3">
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Total Users</small>
          <h3 style={{ marginBottom: 0 }}>{summary.total}</h3>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Active Users</small>
          <h3 style={{ marginBottom: 0 }}>{summary.active}</h3>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Pending Approvals</small>
          <h3 style={{ marginBottom: 0 }}>{summary.pending}</h3>
        </article>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Admin Editing Mode</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Enables high-impact administrative edits. Keep disabled when not actively administering.
        </p>
        <button className="btn primary" onClick={() => void onToggleEditingMode()} disabled={isSaving}>
          {editingMode ? 'Disable Editing Mode' : 'Enable Editing Mode'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>AI Assistant Policy</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Configure the global assistant system prompt and model behavior for all users.
        </p>
        <form className="grid" onSubmit={(event) => void onSaveAssistantConfig(event)}>
          <label className="form-row">
            <span>System Prompt</span>
            <textarea
              className="input"
              rows={5}
              value={assistantConfig.systemPrompt}
              onChange={(event) =>
                setAssistantConfig((prev) => ({
                  ...prev,
                  systemPrompt: event.target.value,
                }))
              }
              required
            />
          </label>

          <div className="grid cols-3">
            <label className="form-row">
              <span>Temperature (0 - 1)</span>
              <input
                className="input"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={assistantConfig.temperature}
                onChange={(event) =>
                  setAssistantConfig((prev) => ({
                    ...prev,
                    temperature: Number(event.target.value),
                  }))
                }
                required
              />
            </label>

            <label className="form-row">
              <span>Max Tokens</span>
              <input
                className="input"
                type="number"
                min={64}
                max={2000}
                step={1}
                value={assistantConfig.maxTokens}
                onChange={(event) =>
                  setAssistantConfig((prev) => ({
                    ...prev,
                    maxTokens: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
          </div>

          <button className="btn primary" type="submit" disabled={isSaving}>
            Save Assistant Policy
          </button>
        </form>
      </div>

      <div className="grid cols-3">
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Assistant Provider Status</small>
          <h3 style={{ marginBottom: '0.35rem' }}>
            <span className={`badge ${assistantHealth?.reachable ? 'success' : 'warn'}`}>
              {assistantHealth?.reachable ? 'Online' : 'Offline'}
            </span>
          </h3>
          <small style={{ color: 'var(--text-muted)' }}>
            {assistantHealth?.provider ?? 'n/a'}
            {assistantHealth?.model ? ` / ${assistantHealth.model}` : ''}
            {assistantHealth?.latencyMs ? ` / ${assistantHealth.latencyMs} ms` : ''}
          </small>
          <p style={{ marginBottom: 0, marginTop: '0.35rem', color: 'var(--text-muted)' }}>
            Last checked: {assistantHealthCheckedAt ? new Date(assistantHealthCheckedAt).toLocaleString() : 'Not checked yet'}
          </p>
          <p style={{ marginBottom: 0, marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            {assistantHealth?.message ?? 'No health status yet.'}
          </p>
          <button className="btn ghost" onClick={() => void onTestAssistantConnection()} disabled={isTestingAssistant}>
            {isTestingAssistant ? 'Testing...' : 'Test Provider Connection'}
          </button>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>AI Total Interactions (30d)</small>
          <h3 style={{ marginBottom: 0 }}>{assistantMetrics?.totalInteractions ?? 0}</h3>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Provider vs Rules</small>
          <h3 style={{ marginBottom: 0 }}>
            {assistantMetrics?.providerInteractions ?? 0} / {assistantMetrics?.rulesInteractions ?? 0}
          </h3>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Avg Latency (ms) / Last 24h</small>
          <h3 style={{ marginBottom: 0 }}>
            {assistantMetrics?.avgLatencyMs ?? 0} / {assistantMetrics?.last24Hours ?? 0}
          </h3>
        </article>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Provision System Users</h3>
        <p style={{ color: 'var(--text-muted)' }}>
          Self-registration is disabled. Admins create users and role-based credentials are issued by system workflow.
        </p>
        <form className="grid settings-form-grid" onSubmit={(event) => void onSubmitCreateUser(event)}>
          <input
            className="input"
            placeholder="Username"
            value={createUserForm.username}
            onChange={(event) => setCreateUserForm((prev) => ({ ...prev, username: event.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={createUserForm.email}
            onChange={(event) => setCreateUserForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="First name"
            value={createUserForm.firstName}
            onChange={(event) => setCreateUserForm((prev) => ({ ...prev, firstName: event.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Last name"
            value={createUserForm.lastName}
            onChange={(event) => setCreateUserForm((prev) => ({ ...prev, lastName: event.target.value }))}
            required
          />
          <select
            className="input"
            value={createUserForm.role}
            onChange={(event) =>
              setCreateUserForm((prev) => ({
                ...prev,
                role: event.target.value as CreateUserForm['role'],
              }))
            }
          >
            <option value="ACCOUNTANT">ACCOUNTANT</option>
            <option value="FINANCE_MANAGER">FINANCE_MANAGER</option>
            <option value="HR">HR</option>
            <option value="AUDITOR">AUDITOR</option>
            <option value="DEPARTMENT_MANAGER">DEPARTMENT_MANAGER</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button className="btn primary" type="submit" disabled={isSaving}>
            Add User
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>User Access Management</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role(s)</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.userId}>
                <td>{user.email}</td>
                <td>{user.roles.join(', ')}</td>
                <td>
                  <span className={`badge ${user.isActive ? 'success' : 'warn'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn ghost" onClick={() => void onToggleUserStatus(user)} disabled={isSaving}>
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => void onResetPassword(user)}
                      disabled={isSaving || user.userId === currentUser?.sub}
                      title={user.userId === currentUser?.sub ? 'Use your profile flow to change own password' : 'Reset password'}
                    >
                      Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Pending Change Approvals</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Target</th>
              <th>Requested By</th>
              <th>Requested At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={5}>No pending approval requests.</td>
              </tr>
            )}
            {requests.map((request) => (
              <tr key={request.changeRequestId}>
                <td>{request.actionType}</td>
                <td>{request.targetResource}</td>
                <td>{request.requestedBy.email}</td>
                <td>{new Date(request.requestedAt).toLocaleString()}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn primary"
                    onClick={() => void onApprove(request.changeRequestId)}
                    disabled={isSaving || !editingMode}
                  >
                    Approve
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => void onReject(request.changeRequestId)}
                    disabled={isSaving || !editingMode}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Change History (Audit Trail)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>By</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.auditLogId}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.actorEmail ?? 'System'}</td>
                <td>{log.action}</td>
                <td>{log.entityType}{log.entityId ? ` (${log.entityId})` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
