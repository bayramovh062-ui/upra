import { useState } from 'react';
import { Button, Card, EmptyState, ErrorState, Icon, PageHeader, Skeleton } from '../components/ui';
import NotificationItem from '../features/notifications/NotificationItem';
import {
    PAGE_LIMIT,
    useGetNotificationsQuery,
    useMarkAllNotificationsReadMutation,
} from '../features/notifications/notificationsApi';
import useOpenNotification from '../features/notifications/useOpenNotification';
import { useTranslation } from '../features/locale/useTranslation';
import { cn } from '../lib/cn';

const TABS = [
    { key: 'ALL', labelKey: 'notifications.ui.tabAll' },
    { key: 'UNREAD', labelKey: 'notifications.ui.tabUnread' },
];

const NotificationsPage = () => {
    const { t } = useTranslation();
    const [tab, setTab] = useState('ALL');
    const { data, isLoading, isError, refetch } = useGetNotificationsQuery(PAGE_LIMIT);
    const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
    const openNotification = useOpenNotification();

    const notifications = data?.notifications ?? [];
    const unreadCount = data?.unreadCount ?? 0;
    const visible = tab === 'UNREAD' ? notifications.filter((n) => !n.readAt) : notifications;
    // Server ən çox PAGE_LIMIT qaytarır: daha çox varsa istifadəçiyə bildirilir
    const truncated = notifications.length >= PAGE_LIMIT;

    return (
        <>
            <PageHeader
                title={t('notifications.ui.title')}
                description={t('notifications.ui.pageDescription')}
                action={
                    <Button variant="secondary" onClick={() => markAll()} loading={markingAll} disabled={unreadCount === 0}>
                        <Icon name="done_all" className="text-[18px]" />
                        {t('notifications.ui.markAll')}
                    </Button>
                }
            />

            <div className="mb-4 inline-flex gap-1 rounded-xl bg-surface-container-low p-1">
                {TABS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        className={cn(
                            'rounded-lg px-4 py-1.5 text-label-md transition-all',
                            tab === item.key
                                ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface',
                        )}
                    >
                        {t(item.labelKey)}
                        {item.key === 'UNREAD' && <span className="ml-1 opacity-70">{unreadCount}</span>}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <Card className="divide-y divide-line">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-4">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="flex-1">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="mt-2 h-3 w-2/3" />
                            </div>
                        </div>
                    ))}
                </Card>
            ) : isError ? (
                <ErrorState title={t('notifications.ui.loadError')} onRetry={refetch} />
            ) : visible.length === 0 ? (
                <EmptyState
                    icon="notifications_off"
                    title={
                        tab === 'UNREAD'
                            ? t('notifications.ui.emptyUnreadTitle')
                            : t('notifications.ui.emptyTitle')
                    }
                    description={
                        tab === 'UNREAD' ? t('notifications.ui.emptyUnreadText') : t('notifications.ui.emptyText')
                    }
                />
            ) : (
                <>
                    <Card className="divide-y divide-line overflow-hidden">
                        {visible.map((n) => (
                            <NotificationItem key={n.id} notification={n} onClick={openNotification} />
                        ))}
                    </Card>
                    {truncated && (
                        <p className="mt-3 text-center text-label-md text-secondary">
                            {t('notifications.ui.showingRecent', { count: PAGE_LIMIT })}
                        </p>
                    )}
                </>
            )}
        </>
    );
};

export default NotificationsPage;
