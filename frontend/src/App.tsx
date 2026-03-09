import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/rbac/ProtectedRoute';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LedgerPage } from './pages/ledger/LedgerPage';
import { InvoicePage } from './pages/invoices/InvoicePage';
import { PayrollPage } from './pages/payroll/PayrollPage';
import { BudgetPage } from './pages/budgets/BudgetPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { SettingsPage } from './pages/settings/SettingsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route
          path="invoices"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "ACCOUNTANT", "FINANCE_MANAGER", "DEPARTMENT_MANAGER", "AUDITOR"]}>
              <InvoicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="payroll"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "HR", "FINANCE_MANAGER"]}>
              <PayrollPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="budgets"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "ACCOUNTANT", "FINANCE_MANAGER", "DEPARTMENT_MANAGER", "AUDITOR"]}>
              <BudgetPage />
            </ProtectedRoute>
          }
        />
        <Route path="reports" element={<ReportsPage />} />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
