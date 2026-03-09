import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BarFlowChart } from '../../components/charts/FlowCharts';
import { PrintButton } from '../../components/common/PrintButton';
import { invoiceApi, InvoiceRecord } from '../../api/invoiceApi';
import { useAuth } from '../../hooks/useAuth';

export function InvoicePage() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<InvoiceRecord[]>([]);
  const [aging, setAging] = useState<Array<{ label: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    invoiceNumber: '',
    invoiceType: 'AR' as 'AR' | 'AP',
    counterpartyName: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    lineDescription: '',
    quantity: '1',
    unitPrice: '0',
  });

  const canCreate = hasRole(['ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'DEPARTMENT_MANAGER']);
  const canApprove = hasRole(['ADMIN', 'FINANCE_MANAGER']);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await invoiceApi.list();
      setRows(response.data.invoices);
      setAging(response.data.arAging);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const totals = useMemo(() => {
    const posted = rows.filter((row) => row.status === 'POSTED').reduce((sum, row) => sum + row.totalAmount, 0);
    const open = rows
      .filter((row) => row.status === 'SUBMITTED' || row.status === 'APPROVED')
      .reduce((sum, row) => sum + row.totalAmount, 0);
    return { posted, open };
  }, [rows]);

  const onCreateInvoice = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await invoiceApi.create({
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceType: form.invoiceType,
        counterpartyName: form.counterpartyName.trim(),
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        lines: [
          {
            description: form.lineDescription.trim(),
            quantity: Number(form.quantity),
            unitPrice: Number(form.unitPrice),
          },
        ],
      });

      setForm((current) => ({
        ...current,
        invoiceNumber: '',
        counterpartyName: '',
        lineDescription: '',
        quantity: '1',
        unitPrice: '0',
      }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    }
  };

  const submitInvoice = async (invoiceId: string) => {
    try {
      await invoiceApi.submit(invoiceId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit invoice');
    }
  };

  const approveInvoice = async (invoiceId: string) => {
    try {
      await invoiceApi.approve(invoiceId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve invoice');
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>Invoice Management</h1>
        <PrintButton label="Print Invoices" />
      </div>

      <div className="grid cols-3">
        <div className="card">
          <small style={{ color: 'var(--text-muted)' }}>Open Exposure</small>
          <h3 style={{ marginBottom: 0 }}>${totals.open.toLocaleString()}</h3>
        </div>
        <div className="card">
          <small style={{ color: 'var(--text-muted)' }}>Posted Amount</small>
          <h3 style={{ marginBottom: 0 }}>${totals.posted.toLocaleString()}</h3>
        </div>
        <div className="card">
          <small style={{ color: 'var(--text-muted)' }}>Invoice Count</small>
          <h3 style={{ marginBottom: 0 }}>{rows.length}</h3>
        </div>
      </div>

      <div className="grid cols-2">
        <BarFlowChart
          title="Outstanding AR by Bucket"
          points={aging.length ? aging : [{ label: '0-30d', value: 0 }]}
          color="#b45309"
        />

        {canCreate ? (
          <form className="card" onSubmit={(event) => void onCreateInvoice(event)}>
            <h3 style={{ marginTop: 0 }}>Create Invoice</h3>
            <div className="grid settings-form-grid">
              <div className="form-row">
                <label>Invoice #</label>
                <input className="input" value={form.invoiceNumber} onChange={(e) => setForm((s) => ({ ...s, invoiceNumber: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Type</label>
                <select className="input" value={form.invoiceType} onChange={(e) => setForm((s) => ({ ...s, invoiceType: e.target.value as 'AR' | 'AP' }))}>
                  <option value="AR">AR</option>
                  <option value="AP">AP</option>
                </select>
              </div>
              <div className="form-row">
                <label>Counterparty</label>
                <input className="input" value={form.counterpartyName} onChange={(e) => setForm((s) => ({ ...s, counterpartyName: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Issue Date</label>
                <input className="input" type="date" value={form.issueDate} onChange={(e) => setForm((s) => ({ ...s, issueDate: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Due Date</label>
                <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Line Description</label>
                <input className="input" value={form.lineDescription} onChange={(e) => setForm((s) => ({ ...s, lineDescription: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Qty</label>
                <input className="input" type="number" min="0.0001" step="0.0001" value={form.quantity} onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Unit Price</label>
                <input className="input" type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm((s) => ({ ...s, unitPrice: e.target.value }))} required />
              </div>
            </div>
            <button className="btn primary" type="submit">Create Invoice</button>
          </form>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>AR/AP Overview</h3>
        {error ? <div className="error-text" style={{ marginBottom: '0.8rem' }}>{error}</div> : null}
        <table className="table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Counterparty</th>
              <th>Type</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7}>No invoices found.</td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.invoiceId}>
                <td>{row.invoiceNumber}</td>
                <td>{row.counterpartyName}</td>
                <td>{row.invoiceType}</td>
                <td>{row.dueDate}</td>
                <td>$ {row.totalAmount.toLocaleString()}</td>
                <td>
                  <span className={`badge ${row.status === 'APPROVED' ? 'info' : row.status === 'POSTED' ? 'success' : 'warn'}`}>
                    {row.status}
                  </span>
                </td>
                <td className="no-print">
                  {row.status === 'DRAFT' ? <button className="btn ghost" onClick={() => void submitInvoice(row.invoiceId)}>Submit</button> : null}
                  {row.status === 'SUBMITTED' && canApprove ? (
                    <button className="btn ghost" onClick={() => void approveInvoice(row.invoiceId)}>
                      Approve
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
