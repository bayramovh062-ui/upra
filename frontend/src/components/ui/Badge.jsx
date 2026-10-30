import { cn } from '../../lib/cn';

const tones = {
    gray: 'bg-gray-100 text-gray-700',
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
};

// Backend enum dəyərləri → rəng və yazı. Yeni status gələndə yalnız bura əlavə et.
const STATUS_MAP = {
    // JobPost
    OPEN: { tone: 'green', label: 'Open' },
    IN_PROGRESS: { tone: 'blue', label: 'In progress' },
    COMPLETED: { tone: 'brand', label: 'Completed' },
    CANCELLED: { tone: 'gray', label: 'Cancelled' },
    // Proposal
    PENDING: { tone: 'amber', label: 'Pending' },
    ACCEPTED: { tone: 'green', label: 'Accepted' },
    REJECTED: { tone: 'red', label: 'Rejected' },
    // Contract
    ACTIVE: { tone: 'green', label: 'Active' },
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
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
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
