import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Bell, AlertCircle, Clock, ClipboardCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications';
import type { AppNotification } from '@/types/notifications';

interface NotificationCenterProps {
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

const typeMeta: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  'session-opened': { label: 'Sesi Baru', variant: 'default' },
  'category-opened': { label: 'Kategori Baru', variant: 'secondary' },
  'review-sent': { label: 'Review Unit Safety', variant: 'default' },
  'submission-received': { label: 'Masuk', variant: 'secondary' },
  'admin-session-opened': { label: 'Sesi Dibuka', variant: 'secondary' },
};

const getNotificationIcon = (type: string) => {
  if (type === 'review-sent') {
    return <ClipboardCheck className="h-4 w-4 text-blue-500" />;
  }
  if (type === 'submission-received') {
    return <Clock className="h-4 w-4 text-sky-500" />;
  }
  if (type === 'category-opened') {
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  }
  return <Bell className="h-4 w-4 text-blue-500" />;
};

export function NotificationCenter({ onClose, onUnreadChange }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = useCallback(() => {
    setIsLoading(true);
    fetchNotifications({ limit: 30 })
      .then((data) => {
        setNotifications(data.items);
        setUnreadCount(data.unreadCount);
        onUnreadChange?.(data.unreadCount);
      })
      .finally(() => setIsLoading(false));
  }, [onUnreadChange]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.readAt) {
      markNotificationRead(notification.id).then(() => loadNotifications());
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead().then(() => loadNotifications());
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="font-semibold">Notifications</h3>
          <Badge variant="secondary">{unreadCount}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[360px]">
        {isLoading ? (
          <div className="flex items-center justify-center p-6 text-sm text-slate-500">
            Memuat notifikasi...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Bell className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Belum ada notifikasi</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => {
              const meta = typeMeta[notification.type];
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'cursor-pointer p-4 transition-colors hover:bg-accent',
                    !notification.readAt && 'bg-blue-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={meta?.variant ?? 'default'}>
                          {meta?.label ?? 'Info'}
                        </Badge>
                        {!notification.readAt && (
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-sm font-medium">{notification.title}</p>
                      {notification.message && (
                        <p className="text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                      )}
                      {notification.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(notification.createdAt), 'dd MMM yyyy, HH:mm', {
                            locale: enUS,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <Separator />

      <div className="flex items-center justify-between gap-2 p-4">
        <Button variant="outline" className="flex-1" size="sm" onClick={handleMarkAllRead}>
          Tandai semua dibaca
        </Button>
        <Button variant="ghost" size="sm" onClick={loadNotifications}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
