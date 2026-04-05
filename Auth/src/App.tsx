import { Navigate, Route, Routes } from 'react-router-dom';
import { Login } from '@/pages/Login';
import { Profile } from '@/pages/Profile';
import { UserPortal } from '@/pages/UserPortal';
import { AdminPortal } from '@/pages/admin/AdminPortal';
import { UserManagement } from '@/pages/admin/UserManagement';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Navigate to="/portal-user" replace />} />
      <Route path="/portal-user" element={<UserPortal />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/portal-admin" element={<AdminPortal />} />
      <Route path="/portal-admin/users" element={<UserManagement />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
