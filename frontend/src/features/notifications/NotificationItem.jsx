import { cn } from '../../lib/cn';
import { timeAgo } from '../../lib/format';
import { Icon } from '../../components/ui';

// Bildirişin növünə görə ikon (naməlum növ üçün zəng)
const iconFor = (type = '') => {
    if (type.startsWith('PROPOSAL')) return 'description';
    if (type === 'ISSUE_ASSIGNED') return 'task_alt';
    if (type === 'COMMENT_ADDED') return 'chat_bubble';
    if (type.startsWith('MILESTONE') || type === 'CHANGES_REQUESTED') return 'account_balance';
    if (type.startsWith('DISPUTE')) return 'report_problem';
    if (type === 'REVIEW_RECEIVED') return 'star';
    if (type.startsWith('REPORT')) return 'flag';
    if (type === 'ACCOUNT_SUSPENDED') return 'block';
    if (type === 'ACCOUNT_REINSTATED') return 'how_to_reg';
    if (type.startsWith('CANCEL') || type === 'CONTRACT_CANCELLED' || type === 'CONTRACT_DECLINED') return 'event_busy';
    if (type.startsWith('CONTRACT')) return 'verified_user';
    return 'notifications';
};

// Zəng paneli və "hamısı" səhifəsi eyni sətri işlədir. Oxunmamışlar solda nöqtə və tünd başlıqla seçilir.
const NotificationItem = ({ notification, onClick, className }) => {
    const unread = !notification.readAt;

    return (
        <button
            type="button"
            onClick={() => onClick(notification)}
            className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-container-low',
                unread && 'bg-primary-fixed/30',
                className,
            )}
        >
            <span
                className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    unread ? 'bg-primary-container text-on-primary' : 'bg-surface-container-high text-secondary',
                )}
            >
                <Icon name={iconFor(notification.type)} className="text-[18px]" />
            </span>

            <span className="min-w-0 flex-1">
                <span className={cn('block text-body-md text-on-surface', unread ? 'font-semibold' : 'font-medium')}>
                    {notification.title}
                </span>
                {notification.body && (
                    <span className="mt-0.5 line-clamp-2 block break-words text-label-md text-secondary">
                        {notification.body}
                    </span>
                )}
                <span className="mt-1 block text-caption text-secondary">{timeAgo(notification.createdAt)}</span>
            </span>

            {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-container" aria-label="Unread" />}
        </button>
    );
};

export default NotificationItem;
