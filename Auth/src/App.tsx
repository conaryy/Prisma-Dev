import { Navigate, Route, Routes } from 'react-router-dom';
import { Login } from '@/pages/Login';
import { AdminPortal } from '@/pages/admin/AdminPortal';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-slate-600">
          Login berhasil. Halaman ini placeholder untuk integrasi portal berikutnya.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Placeholder title="Dashboard User" />} />
      <Route path="/portal-admin" element={<AdminPortal />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
