import { cn } from '../../lib/cn';

// Rənglər DESIGN.md "Badges & Status Chips" bölməsindən (index.css-də token kimi)
const tones = {
    gray: 'bg-surface-container text-on-surface-variant',
    brand: 'bg-info-soft text-info-ink',
    green: 'bg-success-soft text-success-ink',
    amber: 'bg-warning-soft text-warning-ink',
    red: 'bg-danger-soft text-danger-ink',
    blue: 'bg-blue-50 text-blue-700',
};

// Backend enum dəyərləri → rəng və yazı. Yeni status gələndə yalnız bura əlavə et.
const STATUS_MAP = {
    // JobPost
    OPEN: { tone: 'brand', label: 'Open' },
    IN_PROGRESS: { tone: 'blue', label: 'In progress' },
    COMPLETED: { tone: 'green', label: 'Completed' },
    CANCELLED: { tone: 'gray', label: 'Cancelled' },
    // Proposal
    PENDING: { tone: 'amber', label: 'Pending' },
    ACCEPTED: { tone: 'green', label: 'Accepted' },
    REJECTED: { tone: 'red', label: 'Rejected' },
    // Contract
    ACTIVE: { tone: 'brand', label: 'Active' },
    // Issue
    TODO: { tone: 'gray', label: 'To do' },
    DONE: { tone: 'green', label: 'Done' },
    // Priority
    LOW: { tone: 'gray', label: 'Low' },
    MEDIUM: { tone: 'amber', label: 'Medium' },
    HIGH: { tone: 'red', label: 'High' },
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
    const config = STATUS_MAP[status] || { tone: 'gray', label: status || 'Unknown' };
    return (
        <Badge tone={config.tone} className={className}>
            {config.label}
        </Badge>
    );
};

export default Badge;
