export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt?: string | null;
};
