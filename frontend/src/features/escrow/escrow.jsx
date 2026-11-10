import { Badge } from '../../components/ui';

// Milestone statusu -> rəng və yazı.
const MILESTONE_STATUS = {
    PENDING: { tone: 'amber', label: 'Awaiting funding' },
    FUNDED: { tone: 'blue', label: 'In escrow' },
    IN_REVIEW: { tone: 'brand', label: 'In review' },
    DISPUTED: { tone: 'red', label: 'Disputed' },
    PAID: { tone: 'green', label: 'Paid' },
    CANCELLED: { tone: 'gray', label: 'Cancelled' },
};

// Hesablama köməkçiləri (calcCommissionCents, summarizeMilestones, hasReachedRevisionLimit) escrowUtils.js-dədir.
export const MilestoneBadge = ({ status }) => {
    const config = MILESTONE_STATUS[status] || { tone: 'gray', label: status || 'Unknown' };
    return <Badge tone={config.tone}>{config.label}</Badge>;
};
