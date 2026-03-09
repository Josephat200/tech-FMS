import { LineFlowChart } from '../../components/charts/FlowCharts';
import { PrintButton } from '../../components/common/PrintButton';

export function LedgerPage() {
  return (
    <section className="page">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>General Ledger</h1>
        <PrintButton label="Print Ledger" />
      </div>

      <LineFlowChart
        title="Net Posting Flow"
        points={[
          { label: 'Week 1', value: 22000 },
          { label: 'Week 2', value: 34000 },
          { label: 'Week 3', value: 28500 },
          { label: 'Week 4', value: 41000 },
        ]}
        color="#2563eb"
      />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent Journal Entries</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>Description</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>JE-2026-104</td>
              <td>2026-03-01</td>
              <td>Vendor settlement</td>
              <td>$ 21,500</td>
              <td>$ 21,500</td>
              <td><span className="badge success">Posted</span></td>
            </tr>
            <tr>
              <td>JE-2026-105</td>
              <td>2026-03-02</td>
              <td>Client invoice posting</td>
              <td>$ 42,300</td>
              <td>$ 42,300</td>
              <td><span className="badge success">Posted</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
