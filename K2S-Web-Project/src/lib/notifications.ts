import { apiFetch } from '@/lib/api';
import type { AppNotification } from '@/types/notifications';

export async function fetchNotifications(params: { limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  const response = await apiFetch<{ data: { items: AppNotification[]; unreadCount: number } }>(
    `/api/notifications?${query.toString()}`
  );
  return response.data;
}

export async function markNotificationRead(id: string) {
  const response = await apiFetch<{ data: { success: boolean } }>(
    `/api/notifications/${id}/read`,
    { method: 'PATCH' }
  );
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await apiFetch<{ data: { success: boolean } }>(
    '/api/notifications/read-all',
    { method: 'POST' }
  );
  return response.data;
}
