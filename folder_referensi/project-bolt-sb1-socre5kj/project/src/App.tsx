import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import LogbookHarian from './pages/LogbookHarian';
import RekapLogbook from './pages/RekapLogbook';

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tower/logbook-harian" element={<LogbookHarian />} />
          <Route path="/tower/rekap-logbook" element={<RekapLogbook />} />
          <Route path="/app/logbook-harian" element={<LogbookHarian />} />
          <Route path="/app/rekap-logbook" element={<RekapLogbook />} />
          <Route path="/teknik/logbook-harian" element={<LogbookHarian />} />
          <Route path="/teknik/rekap-logbook" element={<RekapLogbook />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
