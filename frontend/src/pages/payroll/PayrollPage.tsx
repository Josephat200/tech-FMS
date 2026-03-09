import { LineFlowChart } from '../../components/charts/FlowCharts';
import { PrintButton } from '../../components/common/PrintButton';

export function PayrollPage() {
  return (
    <section className="page">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>Payroll Module</h1>
        <PrintButton label="Print Payroll" />
      </div>

      <LineFlowChart
        title="Payroll Cost Trend"
        points={[
          { label: 'Jan', value: 145000 },
          { label: 'Feb', value: 150800 },
          { label: 'Mar', value: 149900 },
          { label: 'Apr', value: 153200 },
        ]}
        color="#9333ea"
      />

      <div className="grid cols-3">
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Current Payroll Run</small>
          <h3 style={{ marginBottom: 0 }}>PR-2026-03</h3>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Gross Total</small>
          <h3 style={{ marginBottom: 0 }}>$ 186,420</h3>
        </article>
        <article className="card">
          <small style={{ color: 'var(--text-muted)' }}>Net Total</small>
          <h3 style={{ marginBottom: 0 }}>$ 149,900</h3>
        </article>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Employee Payroll Status</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mary Wanjiku</td>
              <td>Finance</td>
              <td>$ 4,700</td>
              <td>$ 3,900</td>
              <td><span className="badge success">Processed</span></td>
            </tr>
            <tr>
              <td>Joseph Kimani</td>
              <td>Engineering</td>
              <td>$ 5,200</td>
              <td>$ 4,230</td>
              <td><span className="badge warn">Awaiting approval</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
