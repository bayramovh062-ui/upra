import { Badge } from '../../components/ui';

// Backend ilə eyni qayda: 10%, tam sentə aşağı yuvarlaqlanır (financialService.calcCommission)
export const calcCommissionCents = (amountCents) => Math.floor(amountCents / 10);

// Milestone statusu -> rəng və yazı. APPROVED/DISPUTED 2B-də istifadə olunmur, ona görə burada yoxdur.
const MILESTONE_STATUS = {
    PENDING: { tone: 'amber', label: 'Awaiting funding' },
    FUNDED: { tone: 'blue', label: 'In escrow' },
    IN_REVIEW: { tone: 'brand', label: 'In review' },
    PAID: { tone: 'green', label: 'Paid' },
    CANCELLED: { tone: 'gray', label: 'Cancelled' },
};

export const MilestoneBadge = ({ status }) => {
    const config = MILESTONE_STATUS[status] || { tone: 'gray', label: status || 'Unknown' };
    return <Badge tone={config.tone}>{config.label}</Badge>;
};

// Müqavilənin mərhələlərindən xülasə (sentlə). Yalnız verilənlərdən hesablanır, ayrıca saxlanmır.
//   lockedCents    escrow-da olan pul (FUNDED + IN_REVIEW)
//   releasedCents  ödənilmiş (PAID). Frilanser üçün komissiyadan sonrakı xalis məbləğ, client üçün ümumi
//   unfundedCents  hələ maliyyələşdirilməmiş (PENDING)
//   paid / total   "x / y mərhələ"; ləğv olunmuşlar y-yə daxil deyil (hamısı ləğvdirsə, hamısı sayılır)
export const summarizeMilestones = (milestones = [], isFreelancer = false) => {
    let lockedCents = 0;
    let releasedCents = 0;
    let unfundedCents = 0;
    let paid = 0;

    milestones.forEach((m) => {
        if (m.status === 'FUNDED' || m.status === 'IN_REVIEW') lockedCents += m.amountCents;
        else if (m.status === 'PENDING') unfundedCents += m.amountCents;
        else if (m.status === 'PAID') {
            paid += 1;
            releasedCents += isFreelancer ? m.amountCents - calcCommissionCents(m.amountCents) : m.amountCents;
        }
    });

    const live = milestones.filter((m) => m.status !== 'CANCELLED').length;
    return { lockedCents, releasedCents, unfundedCents, paid, total: live || milestones.length };
};
