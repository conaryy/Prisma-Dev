import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ChecklistAuditPage } from '@/pages/ChecklistAuditPage';
import { DashboardPage } from '@/pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="checklist-audit" element={<ChecklistAuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
