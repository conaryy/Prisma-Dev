import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { AuthCallbackPage } from '@/pages/AuthCallback';
import { ChecklistAuditPage } from '@/pages/ChecklistAuditPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UploadDocumentsPage } from '@/pages/UploadDocumentsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="upload-dokumen" element={<UploadDocumentsPage />} />
          <Route path="checklist-audit" element={<ChecklistAuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
