import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BarFlowChart } from '../../components/charts/FlowCharts';
import { PrintButton } from '../../components/common/PrintButton';
import { budgetApi, BudgetCycle, DepartmentBudget } from '../../api/budgetApi';
import { useAuth } from '../../hooks/useAuth';

export function BudgetPage() {
  const { hasRole } = useAuth();
  const [cycles, setCycles] = useState<BudgetCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [rows, setRows] = useState<DepartmentBudget[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [newCycle, setNewCycle] = useState({
    cycleName: 'FY Plan',
    fiscalYear: new Date().getFullYear(),
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: `${new Date().getFullYear()}-12-31`,
  });
  const [allocationForm, setAllocationForm] = useState({
    departmentName: '',
    plannedAmount: '0',
    notes: '',
  });

  const canManageCycle = hasRole(['ADMIN', 'FINANCE_MANAGER']);
  const canManageAllocation = hasRole(['ADMIN', 'FINANCE_MANAGER', 'DEPARTMENT_MANAGER']);

  const loadPageData = async (cycleId?: string) => {
    setLoading(true);
    setError('');
    try {
      const [cycleResponse, allocationResponse] = await Promise.all([
        budgetApi.listCycles(),
        budgetApi.listAllocations(cycleId),
      ]);

      setCycles(cycleResponse.data);
      setRows(allocationResponse.data);

      if (!selectedCycleId && cycleResponse.data.length > 0) {
        setSelectedCycleId(cycleResponse.data[0].budgetCycleId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, []);

  const chartPoints = useMemo(
    () =>
      rows.map((row) => ({
        label: row.departmentName,
        value: row.actualAmount,
      })),
    [rows],
  );

  const onCreateCycle = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await budgetApi.createCycle(newCycle);
      await loadPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget cycle');
    }
  };

  const onCreateAllocation = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCycleId) {
      setError('Select a budget cycle first');
      return;
    }

    setError('');
    try {
      await budgetApi.createAllocation({
        budgetCycleId: selectedCycleId,
        departmentName: allocationForm.departmentName,
        plannedAmount: Number(allocationForm.plannedAmount),
        notes: allocationForm.notes,
      });

      setAllocationForm({ departmentName: '', plannedAmount: '0', notes: '' });
      await loadPageData(selectedCycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create allocation');
    }
  };

  const submitAllocation = async (departmentBudgetId: string) => {
    try {
      await budgetApi.submitAllocation(departmentBudgetId);
      await loadPageData(selectedCycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit allocation');
    }
  };

  const approveAllocation = async (departmentBudgetId: string, plannedAmount: number) => {
    try {
      await budgetApi.approveAllocation(departmentBudgetId, plannedAmount);
      await loadPageData(selectedCycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve allocation');
    }
  };

  const updateActual = async (departmentBudgetId: string, currentActualAmount: number) => {
    const nextValue = window.prompt('Set latest actual amount', currentActualAmount.toString());
    if (nextValue === null) {
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError('Actual amount must be a non-negative number');
      return;
    }

    try {
      await budgetApi.updateActual(departmentBudgetId, parsed);
      await loadPageData(selectedCycleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update actual amount');
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>Budget Tracking</h1>
        <PrintButton label="Print Budget" />
      </div>

      {error ? <div className="error-text">{error}</div> : null}

      <div className="grid cols-2">
        {canManageCycle ? (
          <form className="card" onSubmit={(event) => void onCreateCycle(event)}>
            <h3 style={{ marginTop: 0 }}>Create Budget Cycle</h3>
            <div className="grid settings-form-grid">
              <div className="form-row">
                <label>Cycle Name</label>
                <input className="input" value={newCycle.cycleName} onChange={(e) => setNewCycle((c) => ({ ...c, cycleName: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Fiscal Year</label>
                <input className="input" type="number" value={newCycle.fiscalYear} onChange={(e) => setNewCycle((c) => ({ ...c, fiscalYear: Number(e.target.value) }))} required />
              </div>
              <div className="form-row">
                <label>Start Date</label>
                <input className="input" type="date" value={newCycle.startDate} onChange={(e) => setNewCycle((c) => ({ ...c, startDate: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>End Date</label>
                <input className="input" type="date" value={newCycle.endDate} onChange={(e) => setNewCycle((c) => ({ ...c, endDate: e.target.value }))} required />
              </div>
            </div>
            <button className="btn primary" type="submit">Create Cycle</button>
          </form>
        ) : null}

        {canManageAllocation ? (
          <form className="card" onSubmit={(event) => void onCreateAllocation(event)}>
            <h3 style={{ marginTop: 0 }}>Allocate Department Budget</h3>
            <div className="grid settings-form-grid">
              <div className="form-row">
                <label>Cycle</label>
                <select className="input" value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)}>
                  <option value="">Select cycle</option>
                  {cycles.map((cycle) => (
                    <option key={cycle.budgetCycleId} value={cycle.budgetCycleId}>
                      {cycle.cycleName} ({cycle.fiscalYear})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Department</label>
                <input className="input" value={allocationForm.departmentName} onChange={(e) => setAllocationForm((f) => ({ ...f, departmentName: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Planned Amount</label>
                <input className="input" type="number" min="0" step="0.01" value={allocationForm.plannedAmount} onChange={(e) => setAllocationForm((f) => ({ ...f, plannedAmount: e.target.value }))} required />
              </div>
            </div>
            <button className="btn primary" type="submit">Add Allocation</button>
          </form>
        ) : null}
      </div>

      <BarFlowChart
        title="Planned vs Actual Spend"
        points={chartPoints.length ? chartPoints : [{ label: 'No Data', value: 0 }]}
        color="#be123c"
      />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Department Budget Variance</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Budget</th>
              <th>Actual</th>
              <th>Variance</th>
              <th>Status</th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6}>No budget allocations yet.</td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.departmentBudgetId}>
                <td>{row.departmentName}</td>
                <td>$ {row.approvedAmount.toLocaleString()}</td>
                <td>$ {row.actualAmount.toLocaleString()}</td>
                <td>{row.varianceAmount >= 0 ? '$ ' : '-$ '}{Math.abs(row.varianceAmount).toLocaleString()}</td>
                <td>
                  <span className={`badge ${row.varianceAmount >= 0 ? 'success' : 'warn'}`}>
                    {row.varianceAmount >= 0 ? 'On Track' : 'Over Budget'}
                  </span>
                </td>
                <td className="no-print">
                  {row.status === 'DRAFT' && canManageAllocation ? (
                    <button className="btn ghost" onClick={() => void submitAllocation(row.departmentBudgetId)}>Submit</button>
                  ) : null}
                  {row.status === 'SUBMITTED' && canManageCycle ? (
                    <button className="btn ghost" onClick={() => void approveAllocation(row.departmentBudgetId, row.plannedAmount)}>Approve</button>
                  ) : null}
                  {canManageAllocation ? (
                    <button className="btn ghost" onClick={() => void updateActual(row.departmentBudgetId, row.actualAmount)}>Actual</button>
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
