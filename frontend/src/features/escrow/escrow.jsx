import { Badge } from '../../components/ui';
import { useTranslation } from '../locale/useTranslation';

// Milestone statusu -> rəng və yazı.
const MILESTONE_STATUS = {
    PENDING: { tone: 'amber' },
    FUNDED: { tone: 'blue' },
    IN_REVIEW: { tone: 'brand' },
    DISPUTED: { tone: 'red' },
    PAID: { tone: 'green' },
    CANCELLED: { tone: 'gray' },
};

// Hesablama köməkçiləri (calcCommissionCents, summarizeMilestones, hasReachedRevisionLimit) escrowUtils.js-dədir.
export const MilestoneBadge = ({ status }) => {
    const { t } = useTranslation();
    const config = MILESTONE_STATUS[status];
    const label = config ? t(`escrow.status.${status}`) : status || t('common.unknownStatus');
    return <Badge tone={config?.tone ?? 'gray'}>{label}</Badge>;
};
