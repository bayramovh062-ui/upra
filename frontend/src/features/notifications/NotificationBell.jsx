import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Spinner } from '../../components/ui';
import { useTranslation } from '../locale/useTranslation';
import { cn } from '../../lib/cn';
import NotificationItem from './NotificationItem';
import { BELL_LIMIT, useGetNotificationsQuery, useMarkAllNotificationsReadMutation } from './notificationsApi';
import useOpenNotification from './useOpenNotification';

const badgeText = (count) => (count > 9 ? '9+' : String(count));

// Üst paneldəki zəng: oxunmamış sayı nişanı + son bildirişlərin açılan paneli.
// Siyahı socket ilə (useNotificationSocket) canlı yenilənir, burada polling yoxdur.
const NotificationBell = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { data, isLoading, isError, refetch } = useGetNotificationsQuery(BELL_LIMIT);
    const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();

    const close = useCallback(() => setOpen(false), []);
    const openNotification = useOpenNotification(close);

    // Escape ilə bağlanma
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && close();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, close]);

    const notifications = data?.notifications ?? [];
    const unreadCount = data?.unreadCount ?? 0;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={
                    unreadCount > 0
                        ? t('notifications.ui.bellAriaUnread', { count: unreadCount })
                        : t('notifications.ui.bellAria')
                }
                aria-expanded={open}
                className="relative rounded-lg p-2 text-secondary-fixed-dim transition hover:bg-white/10 hover:text-white"
            >
                <Icon name="notifications" />
                {unreadCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-on-error">
                        {badgeText(unreadCount)}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
                    {/* Mobildə ekranın eninə, geniş ekranda zəngin altında açılır */}
                    <div className="fixed left-2 right-2 top-[4.25rem] z-20 overflow-hidden rounded-xl border border-line bg-surface-container-lowest shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
                        <div className="flex items-center justify-between border-b border-line px-4 py-3">
                            <h2 className="text-title-md text-on-surface">{t('notifications.ui.title')}</h2>
                            <button
                                type="button"
                                onClick={() => markAll()}
                                disabled={unreadCount === 0 || markingAll}
                                className="text-label-md font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-secondary disabled:no-underline"
                            >
                                {t('notifications.ui.markAll')}
                            </button>
                        </div>

                        <div className="max-h-[26rem] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex justify-center py-10 text-primary-container">
                                    <Spinner />
                                </div>
                            ) : isError ? (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-body-md text-secondary">{t('notifications.ui.loadError')}</p>
                                    <button
                                        type="button"
                                        onClick={refetch}
                                        className="mt-2 text-label-md font-semibold text-primary hover:underline"
                                    >
                                        {t('notifications.ui.retry')}
                                    </button>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="flex flex-col items-center px-4 py-10 text-center">
                                    <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-secondary">
                                        <Icon name="notifications_off" />
                                    </span>
                                    <p className="text-body-md font-medium text-on-surface">
                                        {t('notifications.ui.caughtUp')}
                                    </p>
                                    <p className="mt-0.5 text-label-md text-secondary">
                                        {t('notifications.ui.caughtUpText')}
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-line">
                                    {notifications.map((n) => (
                                        <li key={n.id}>
                                            <NotificationItem notification={n} onClick={openNotification} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <Link
                            to="/notifications"
                            onClick={close}
                            className={cn(
                                'block border-t border-line px-4 py-3 text-center text-label-md font-semibold text-primary',
                                'hover:bg-surface-container-low',
                            )}
                        >
                            {t('notifications.ui.viewAll')}
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationBell;
