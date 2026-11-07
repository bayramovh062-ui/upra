import { Badge } from '../../components/ui';

// Backend ilə eyni qayda: 10%, tam sentə aşağı yuvarlaqlaşdırılır (financialService.calcCommission)
export const calcCommissionCents = (amountCents) => Math.floor(amountCents / 10);

// Milestone statusu -> rəng və yazı.
const MILESTONE_STATUS = {
    PENDING: { tone: 'amber', label: 'Awaiting funding' },
    FUNDED: { tone: 'blue', label: 'In escrow' },
    IN_REVIEW: { tone: 'brand', label: 'In review' },
    DISPUTED: { tone: 'red', label: 'Disputed' },
    PAID: { tone: 'green', label: 'Paid' },
    CANCELLED: { tone: 'gray', label: 'Cancelled' },
};

export const MilestoneBadge = ({ status }) => {
    const config = MILESTONE_STATUS[status] || { tone: 'gray', label: status || 'Unknown' };
    return <Badge tone={config.tone}>{config.label}</Badge>;
};

// P2: dəyişiklik limiti. Limitə çatanda client yalnız təsdiqləyə və ya mübahisə aça bilər.
export const hasReachedRevisionLimit = (milestone) =>
    (milestone?.revisionCount ?? 0) >= (milestone?.maxRevisions ?? 0);

// Müqavilənin mərhələlərindən xülasə (sentlə). Yalnız verilənlərdən hesablanır, ayrıca saxlanmır.
//   lockedCents    escrow-da olan pul (FUNDED + IN_REVIEW + DISPUTED)
//   releasedCents  ödənilmiş (PAID). Frilanser üçün komissiyadan sonrakı xalis məbləğ, client üçün ümumi.
//                  Dispute SPLIT/RELEASE nəticəsində resolvedReleaseCents varsa, o istifadə olunur.
//   unfundedCents  hələ maliyyələşdirilməmiş (PENDING)
//   paid / total   "x / y mərhələ"; ləğv olunmuşlar y-yə daxil deyil (hamısı ləğvdirsə, hamısı sayılır)
export const summarizeMilestones = (milestones = [], isFreelancer = false) => {
    let lockedCents = 0;
    let releasedCents = 0;
    let unfundedCents = 0;
    let paid = 0;

    milestones.forEach((m) => {
        if (m.status === 'FUNDED' || m.status === 'IN_REVIEW' || m.status === 'DISPUTED') lockedCents += m.amountCents;
        else if (m.status === 'PENDING') unfundedCents += m.amountCents;
        else if (m.status === 'PAID') {
            paid += 1;
            const released = m.resolvedReleaseCents ?? m.amountCents;
            releasedCents += isFreelancer ? released - calcCommissionCents(released) : released;
        }
    });

    const live = milestones.filter((m) => m.status !== 'CANCELLED').length;
    return { lockedCents, releasedCents, unfundedCents, paid, total: live || milestones.length };
};
