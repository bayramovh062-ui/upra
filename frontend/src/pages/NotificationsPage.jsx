import { useState } from 'react';
import { Button, Card, EmptyState, ErrorState, Icon, PageHeader, Skeleton } from '../components/ui';
import NotificationItem from '../features/notifications/NotificationItem';
import {
    PAGE_LIMIT,
    useGetNotificationsQuery,
    useMarkAllNotificationsReadMutation,
} from '../features/notifications/notificationsApi';
import useOpenNotification from '../features/notifications/useOpenNotification';
import { cn } from '../lib/cn';

const TABS = [
    { key: 'ALL', label: 'All' },
    { key: 'UNREAD', label: 'Unread' },
];

const NotificationsPage = () => {
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
                title="Notifications"
                description="Proposals, contract offers, milestones and payments, newest first."
                action={
                    <Button variant="secondary" onClick={() => markAll()} loading={markingAll} disabled={unreadCount === 0}>
                        <Icon name="done_all" className="text-[18px]" />
                        Mark all as read
                    </Button>
                }
            />

            <div className="mb-4 inline-flex gap-1 rounded-xl bg-surface-container-low p-1">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'rounded-lg px-4 py-1.5 text-label-md transition-all',
                            tab === t.key
                                ? 'bg-surface-container-lowest font-semibold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface',
                        )}
                    >
                        {t.label}
                        {t.key === 'UNREAD' && <span className="ml-1 opacity-70">{unreadCount}</span>}
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
                <ErrorState title="Could not load notifications" onRetry={refetch} />
            ) : visible.length === 0 ? (
                <EmptyState
                    icon="notifications_off"
                    title={tab === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
                    description={
                        tab === 'UNREAD'
                            ? 'You have read everything.'
                            : 'When something happens on your jobs, proposals or contracts, it will appear here.'
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
                            Showing your {PAGE_LIMIT} most recent notifications.
                        </p>
                    )}
                </>
            )}
        </>
    );
};

export default NotificationsPage;
