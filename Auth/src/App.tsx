import { Navigate, Route, Routes } from 'react-router-dom';
import { Login } from '@/pages/Login';
import { AdminPortal } from '@/pages/admin/AdminPortal';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-16 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
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
