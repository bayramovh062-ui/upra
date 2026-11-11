import { cn } from '../../lib/cn';
import { useTranslation } from '../../features/locale/useTranslation';

// Rənglər DESIGN.md "Badges & Status Chips" bölməsindən (index.css-də token kimi)
const tones = {
    gray: 'bg-surface-container text-on-surface-variant',
    brand: 'bg-info-soft text-info-ink',
    green: 'bg-success-soft text-success-ink',
    amber: 'bg-warning-soft text-warning-ink',
    red: 'bg-danger-soft text-danger-ink',
    blue: 'bg-info-soft text-info-ink',
};

// Backend enum dəyərləri → rəng. Yazı `common.status.<VALUE>` açarından gəlir.
// Yeni status gələndə yalnız bura və dil fayllarına əlavə et.
const STATUS_TONES = {
    // JobPost
    DRAFT: 'gray',
    OPEN: 'brand',
    IN_PROGRESS: 'blue',
    COMPLETED: 'green',
    CANCELLED: 'gray',
    // Proposal
    PENDING: 'amber',
    ACCEPTED: 'green',
    REJECTED: 'red',
    // Contract
    PENDING_ACCEPTANCE: 'amber',
    ACTIVE: 'brand',
    DELIVERED: 'amber',
    DECLINED: 'red',
    // Issue
    TODO: 'gray',
    DONE: 'green',
    // Priority
    LOW: 'gray',
    MEDIUM: 'amber',
    HIGH: 'red',
};

const Badge = ({ tone = 'gray', className, children }) => (
    <span
        className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm',
            tones[tone],
            className
        )}
    >
        {children}
    </span>
);

export const StatusBadge = ({ status, className }) => {
    const { t } = useTranslation();
    const tone = STATUS_TONES[status] || 'gray';
    const label = status ? t(`common.status.${status}`) : t('common.status.UNKNOWN');

    return (
        <Badge tone={tone} className={className}>
            {label}
        </Badge>
    );
};

export default Badge;
