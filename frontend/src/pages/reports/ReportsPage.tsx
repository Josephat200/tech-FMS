import { BarFlowChart, LineFlowChart } from '../../components/charts/FlowCharts';
import { PrintButton } from '../../components/common/PrintButton';

export function ReportsPage() {
  return (
    <section className="page">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>Financial Reports</h1>
        <PrintButton label="Print Reports" />
      </div>

      <div className="grid cols-2">
        <LineFlowChart
          title="Revenue vs Expense Flow"
          points={[
            { label: 'Jan', value: 180000 },
            { label: 'Feb', value: 202000 },
            { label: 'Mar', value: 225000 },
            { label: 'Apr', value: 219000 },
          ]}
        />
        <BarFlowChart
          title="Operating Cashflow"
          points={[
            { label: 'Jan', value: 44000 },
            { label: 'Feb', value: 51200 },
            { label: 'Mar', value: 48100 },
            { label: 'Apr', value: 56300 },
          ]}
          color="#0f766e"
        />
      </div>

      <div className="grid cols-3">
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Profit & Loss</h3>
          <p style={{ color: 'var(--text-muted)' }}>Review operating margin and net income trends.</p>
          <button className="btn ghost">Open Report</button>
        </article>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Balance Sheet</h3>
          <p style={{ color: 'var(--text-muted)' }}>Track asset, liability, and equity movement.</p>
          <button className="btn ghost">Open Report</button>
        </article>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Cashflow Statement</h3>
          <p style={{ color: 'var(--text-muted)' }}>Analyze operating, investing, and financing cashflow.</p>
          <button className="btn ghost">Open Report</button>
        </article>
      </div>
    </section>
  );
}
