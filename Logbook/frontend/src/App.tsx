import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import LogbookHarian from './pages/LogbookHarian';
import RekapLogbook from './pages/RekapLogbook';
import AuthCallback from './pages/AuthCallback';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/:category/logbook-harian" element={<LogbookHarian />} />
          <Route path="/:category/rekap-logbook" element={<RekapLogbook />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
