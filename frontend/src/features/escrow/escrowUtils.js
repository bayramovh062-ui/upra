// Backend ilə eyni qayda: 10%, tam sentə aşağı yuvarlaqlaşdırılır (financialService.calcCommission)
export const COMMISSION_PERCENT = 10;
export const calcCommissionCents = (amountCents) => Math.floor(amountCents / 10);

// Frilanserin komissiyadan sonra alacağı xalis məbləğ (sentlə). Hər mərhələ üçün ayrıca hesablanır (backend kimi).
export const netCents = (amountCents) => amountCents - calcCommissionCents(amountCents);

// Decimal sahələr (iş büdcəsi, təklif məbləği) JSON-da dollar sətri kimi gəlir ("50.00"): sentə çevirir
export const toCents = (dollars) => Math.round(Number(dollars) * 100);

// P2: dəyişiklik limiti. Limitə çatanda client yalnız təsdiqləyə və ya mübahisə aça bilər.
export const hasReachedRevisionLimit = (milestone) =>
    (milestone?.revisionCount ?? 0) >= (milestone?.maxRevisions ?? 0);

// Təhvil qapısı (backend submitMilestone ilə eyni qayda): Done olmayan tapşırıq mərhələni saxlayır.
// Yalnız bu mərhələyə bağlı və heç bir mərhələyə bağlı olmayan (backlog) tapşırıqlar sayılır.
export const countBlockingIssues = (issues = [], milestoneId) =>
    issues.filter((i) => i.status !== 'DONE' && (!i.milestoneId || i.milestoneId === milestoneId)).length;

// Mərhələ planının cəmi: client üçün ümumi məbləğ, frilanser üçün hər mərhələdən komissiya çıxılandan sonrakı xalis cəm (sentlə)
export const planTotals = (milestones = []) => {
    const live = milestones.filter((m) => m.status !== 'CANCELLED');
    const grossCents = live.reduce((sum, m) => sum + m.amountCents, 0);
    const netTotalCents = live.reduce((sum, m) => sum + netCents(m.amountCents), 0);
    return { grossCents, netTotalCents, feeCents: grossCents - netTotalCents };
};

// Müqavilənin mərhələlərindən xülasə (sentlə). Yalnız verilənlərdən hesablanır, ayrıca saxlanmır.
//   lockedCents    escrow-da olan pul (FUNDED + IN_REVIEW + DISPUTED). Frilanser üçün komissiyadan sonrakı məbləğ.
//   releasedCents  ödənilmiş (PAID). Frilanser üçün komissiyadan sonrakı xalis məbləğ, client üçün ümumi.
//                  Dispute SPLIT/RELEASE nəticəsində resolvedReleaseCents varsa, o istifadə olunur.
//   unfundedCents  hələ maliyyələşdirilməmiş (PENDING). Frilanser üçün komissiyadan sonrakı məbləğ.
//   paid / total   "x / y mərhələ"; ləğv olunmuşlar y-yə daxil deyil (hamısı ləğvdirsə, hamısı sayılır)
export const summarizeMilestones = (milestones = [], isFreelancer = false) => {
    let lockedCents = 0;
    let releasedCents = 0;
    let unfundedCents = 0;
    let paid = 0;

    // Frilanser hər yerdə "cibinə düşəcək" məbləği görür, client isə ödədiyi ümumi məbləği
    const shown = (cents) => (isFreelancer ? netCents(cents) : cents);

    milestones.forEach((m) => {
        if (m.status === 'FUNDED' || m.status === 'IN_REVIEW' || m.status === 'DISPUTED') lockedCents += shown(m.amountCents);
        else if (m.status === 'PENDING') unfundedCents += shown(m.amountCents);
        else if (m.status === 'PAID') {
            paid += 1;
            releasedCents += shown(m.resolvedReleaseCents ?? m.amountCents);
        }
    });

    const live = milestones.filter((m) => m.status !== 'CANCELLED').length;
    return { lockedCents, releasedCents, unfundedCents, paid, total: live || milestones.length };
};
