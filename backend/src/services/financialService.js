import { randomUUID } from 'node:crypto';
import prisma from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { emitToContract } from '../socket.js';

// =====================================================================================
// Maliyyə servisi (escrow, pul kisəsi, mərhələlər). BÜTÜN pul hərəkəti yalnız buradan keçir.
//
// Qaydalar:
//  - Məbləğlər USD sentlə tam ədəddir (float yoxdur).
//  - Hər funksiya TƏK interaktiv tranzaksiyadır: balans, mərhələ statusu və ledger yazıları birlikdə
//    uğur qazanır, ya da birlikdə geri qayıdır.
//  - KİLİD SIRASI (hər əməliyyatda eyni):
//      (a) Contract sətri: SELECT ... FOR UPDATE. Eyni müqavilə üzrə bütün maliyyə əməliyyatları növbəyə düzülür.
//      (b) Mərhələ: şərti updateMany({ where: { id, status: <gözlənilən> } }). count === 0 => 409.
//      (c) Pul kisələri: userId ARTAN sırası ilə (client/freelancer rolundan asılı olmayaraq). Beləcə rolları
//          tərsinə olan iki müqavilə eyni anda işləsə də deadlock olmur.
//  - Ledger yazıları yalnız create ilə əlavə olunur, heç vaxt dəyişdirilmir və silinmir (test təmizləməsi istisna).
//  - Təkrarlanan sorğuları (ikiqat təsdiq, ikiqat maliyyələşdirmə) şərti updateMany rədd edir:
//    ikinci sorğu count: 0 alır. Ona görə ayrıca idempotency cədvəli lazım deyil.
// =====================================================================================

export const SYSTEM_ACTOR = 'SYSTEM';
export const AUTO_APPROVE_DAYS = 7;
export const MAX_TOPUP_CENTS = 500_000; // bir sorğuya $5000 (demo limiti)
export const MAX_AMOUNT_CENTS = 2_000_000_000; // PostgreSQL INTEGER (2^31 - 1) həddinin altında
const MAX_INT = 2_147_483_647;
const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_CONTRACT_STATUSES = ['ACTIVE', 'DELIVERED'];

// Komissiya: 10%, tam sentə aşağı yuvarlaqlanır. Qalıq (yuvarlaqlama) frilanserdə qalır.
// Platformanın ayrıca pul kisəsi yoxdur: komissiya frilanserin balansından çıxılır və platforma gəliri sayılır.
export const calcCommission = (amountCents) => Math.floor(amountCents / 10);

const isValidCents = (value, max) => Number.isInteger(value) && value > 0 && value <= max;

// ---------- infrastruktur köməkçiləri ----------

// Yalnız Prisma P2034 (deadlock / yazma konflikti) təkrarlanır, maksimum 3 cəhd. Biznes xətaları (AppError) heç vaxt.
const withRetry = async (fn) => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await fn();
        } catch (err) {
            if (err?.code === 'P2034' && attempt < MAX_ATTEMPTS) continue;
            throw err;
        }
    }
};

const runTx = (fn) => withRetry(() => prisma.$transaction(fn, { maxWait: 10_000, timeout: 20_000 }));

// Pul kisəsini tranzaksiyadan ƏVVƏL yaradırıq: mövcud olmayan sətri FOR UPDATE ilə kilidləmək olmur.
// İki sorğu eyni anda ilk dəfə yaradanda biri P2002 alır, o da mövcud sətri oxuyur.
export const ensureWallet = async (userId) => {
    try {
        return await prisma.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
    } catch (err) {
        if (err?.code === 'P2002') return prisma.wallet.findUniqueOrThrow({ where: { userId } });
        throw err;
    }
};

const lockContract = async (tx, contractId) => {
    const rows = await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${contractId} FOR UPDATE`;
    if (rows.length === 0) throw new AppError('Contract not found', 404);
};

// Pul kisəsi dəyişikliklərini userId ARTAN sırası ilə tətbiq edir (kilid sırası qaydası (c)).
// change: { wallet: { id, userId }, where?: extraşərtlər, data, error: () => AppError }
// Şərt ödənmirsə (məs. kifayət qədər balans yoxdur) updateMany 0 qaytarır və tranzaksiya geri qayıdır.
const applyWalletChanges = async (tx, changes) => {
    const ordered = [...changes].sort((a, b) => (a.wallet.userId < b.wallet.userId ? -1 : a.wallet.userId > b.wallet.userId ? 1 : 0));

    for (const change of ordered) {
        const result = await tx.wallet.updateMany({
            where: { id: change.wallet.id, ...change.where },
            data: change.data,
        });
        if (result.count === 0) throw change.error();
    }
};

const ledgerRow = (walletId, type, direction, balanceType, amountCents, extra = {}) => ({
    walletId,
    type,
    direction,
    balanceType,
    amountCents,
    currency: 'USD',
    ...extra,
});

const writeLedger = (tx, rows) => tx.transaction.createMany({ data: rows });

const loadMilestone = async (milestoneId) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { contract: { select: { id: true, clientId: true, freelancerId: true } } },
    });
    if (!milestone) throw new AppError('Milestone not found', 404);
    return milestone;
};

// Tranzaksiya daxilində: Contract kilidi + müqavilənin aktivliyi + mərhələnin təzə vəziyyəti
const lockAndLoad = async (tx, contractId, milestoneId) => {
    await lockContract(tx, contractId);

    const contract = await tx.contract.findUnique({
        where: { id: contractId },
        select: { id: true, status: true, clientId: true, freelancerId: true },
    });
    if (!ACTIVE_CONTRACT_STATUSES.includes(contract.status)) {
        throw new AppError('Contract is not active', 400);
    }

    const milestone = await tx.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) throw new AppError('Milestone not found', 404);

    return { contract, milestone };
};

// Mərhələ konflikti (başqa sorğu əvvəl keçib)
const conflict = (message) => new AppError(message, 409);

const notifyMilestone = (contractId, milestone) =>
    emitToContract(contractId, 'milestone:updated', { id: milestone.id, status: milestone.status, contractId });

// ---------- pul kisəsi: top-up, withdraw, xülasə ----------

// DEMO: real ödəniş provayderi yoxdur. Endpoint DEMO_TOPUP_ENABLED=false ilə söndürülə bilər (controller yoxlayır).
export const topUp = async (userId, amountCents) => {
    if (!isValidCents(amountCents, MAX_TOPUP_CENTS)) {
        throw new AppError(`Amount must be a whole number of cents between 1 and ${MAX_TOPUP_CENTS}`, 400);
    }

    const wallet = await ensureWallet(userId);
    const reference = randomUUID();

    return runTx(async (tx) => {
        await applyWalletChanges(tx, [
            {
                wallet,
                where: { availableCents: { lte: MAX_INT - amountCents } },
                data: { availableCents: { increment: amountCents } },
                error: () => new AppError('Wallet balance limit reached', 400),
            },
        ]);

        await writeLedger(tx, [
            ledgerRow(wallet.id, 'TOP_UP', 'CREDIT', 'AVAILABLE', amountCents, {
                description: 'Demo top-up',
                reference,
                metadata: { demo: true },
            }),
        ]);

        return tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    });
};

export const withdraw = async (userId, amountCents) => {
    if (!isValidCents(amountCents, MAX_AMOUNT_CENTS)) {
        throw new AppError('Amount must be a positive whole number of cents', 400);
    }

    const wallet = await ensureWallet(userId);
    const reference = randomUUID();

    return runTx(async (tx) => {
        await applyWalletChanges(tx, [
            {
                wallet,
                where: { availableCents: { gte: amountCents } },
                data: { availableCents: { decrement: amountCents } },
                error: () => new AppError('Insufficient available balance', 400),
            },
        ]);

        await writeLedger(tx, [
            ledgerRow(wallet.id, 'WITHDRAWAL', 'DEBIT', 'AVAILABLE', amountCents, {
                description: 'Demo withdrawal',
                reference,
                metadata: { demo: true },
            }),
        ]);

        return tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    });
};

export const getWalletSummary = async (userId) => {
    const wallet = await ensureWallet(userId);

    const transactions = await prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 20,
        include: { milestone: { select: { id: true, title: true } } },
    });

    return { wallet, transactions };
};

// ---------- mərhələ həyat dövrü ----------

// PENDING -> FUNDED (client). Yalnız bütün əvvəlki mərhələlər PAID olanda.
export const fundMilestone = async (milestoneId, actorId) => {
    const pre = await loadMilestone(milestoneId);
    if (pre.contract.clientId !== actorId) throw new AppError('Only the client can fund a milestone', 403);

    const clientWallet = await ensureWallet(pre.contract.clientId);
    const reference = randomUUID();

    const result = await runTx(async (tx) => {
        const { milestone } = await lockAndLoad(tx, pre.contractId, milestoneId);

        if (milestone.status !== 'PENDING') throw conflict('This milestone is not waiting for funding');

        const unpaidBefore = await tx.milestone.count({
            where: { contractId: pre.contractId, sequence: { lt: milestone.sequence }, status: { not: 'PAID' } },
        });
        if (unpaidBefore > 0) {
            throw new AppError('Earlier milestones must be paid before this one can be funded', 400);
        }

        const amount = milestone.amountCents;

        const updated = await tx.milestone.updateMany({
            where: { id: milestoneId, status: 'PENDING' },
            data: { status: 'FUNDED', fundedAt: new Date() },
        });
        if (updated.count === 0) throw conflict('This milestone is no longer waiting for funding');

        await applyWalletChanges(tx, [
            {
                wallet: clientWallet,
                where: { availableCents: { gte: amount } },
                data: { availableCents: { decrement: amount }, lockedCents: { increment: amount } },
                error: () => new AppError('Insufficient wallet balance. Top up your wallet first.', 400),
            },
        ]);

        const common = { milestoneId, reference };
        await writeLedger(tx, [
            ledgerRow(clientWallet.id, 'MILESTONE_FUNDING', 'DEBIT', 'AVAILABLE', amount, {
                ...common,
                description: `Fund milestone ${milestone.sequence}: ${milestone.title}`,
            }),
            ledgerRow(clientWallet.id, 'ESCROW_LOCK', 'CREDIT', 'LOCKED', amount, {
                ...common,
                description: `Escrow locked for milestone ${milestone.sequence}`,
            }),
        ]);

        return {
            milestone: await tx.milestone.findUniqueOrThrow({ where: { id: milestoneId } }),
            wallet: await tx.wallet.findUniqueOrThrow({ where: { id: clientWallet.id } }),
        };
    });

    notifyMilestone(pre.contractId, result.milestone);
    return result;
};

// FUNDED -> IN_REVIEW (freelancer)
export const submitMilestone = async (milestoneId, actorId) => {
    const pre = await loadMilestone(milestoneId);
    if (pre.contract.freelancerId !== actorId) throw new AppError('Only the freelancer can submit a milestone', 403);

    const milestone = await runTx(async (tx) => {
        await lockAndLoad(tx, pre.contractId, milestoneId);

        const updated = await tx.milestone.updateMany({
            where: { id: milestoneId, status: 'FUNDED' },
            data: { status: 'IN_REVIEW', submittedAt: new Date() },
        });
        if (updated.count === 0) throw conflict('Only a funded milestone can be submitted');

        return tx.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
    });

    notifyMilestone(pre.contractId, milestone);
    return milestone;
};

// IN_REVIEW -> FUNDED (client: "dəyişiklik istəyirəm"). Pul escrow-da qalır.
export const requestChanges = async (milestoneId, actorId) => {
    const pre = await loadMilestone(milestoneId);
    if (pre.contract.clientId !== actorId) throw new AppError('Only the client can request changes', 403);

    const milestone = await runTx(async (tx) => {
        await lockAndLoad(tx, pre.contractId, milestoneId);

        const updated = await tx.milestone.updateMany({
            where: { id: milestoneId, status: 'IN_REVIEW' },
            data: { status: 'FUNDED', submittedAt: null },
        });
        if (updated.count === 0) throw conflict('Only a milestone that is in review can be sent back');

        return tx.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
    });

    notifyMilestone(pre.contractId, milestone);
    return milestone;
};

// IN_REVIEW -> PAID. Təsdiq və ödəniş eyni addımdır (APPROVED ara statusu yoxdur).
// actorId: client-in id-si (əl ilə təsdiq) və ya SYSTEM_ACTOR (avtomatik təsdiq: 7 tam gün IN_REVIEW).
//
// 100$ nümunəsi (X = 10000 sent, komissiya = 1000):
//   client:     locked -10000                                -> ESCROW_RELEASE DEBIT LOCKED 10000
//   freelancer: available +9000 (xalis)                      -> MILESTONE_PAYMENT CREDIT AVAILABLE 10000
//                                                               COMMISSION DEBIT AVAILABLE 1000
// Hər pul kisəsi üçün ledger (kredit - debit) balans dəyişikliyinə bərabərdir.
export const approveMilestone = async (milestoneId, { actorId, now = new Date() } = {}) => {
    const isSystem = actorId === SYSTEM_ACTOR;
    const pre = await loadMilestone(milestoneId);

    if (!isSystem && pre.contract.clientId !== actorId) {
        throw new AppError('Only the client can approve a milestone', 403);
    }

    const cutoff = new Date(now.getTime() - AUTO_APPROVE_DAYS * DAY_MS);

    const clientWallet = await ensureWallet(pre.contract.clientId);
    const freelancerWallet = await ensureWallet(pre.contract.freelancerId);
    const reference = randomUUID();

    const result = await runTx(async (tx) => {
        const { milestone } = await lockAndLoad(tx, pre.contractId, milestoneId);

        if (milestone.status !== 'IN_REVIEW') throw conflict('Only a milestone that is in review can be approved');

        // Avtomatik təsdiq yalnız 7 TAM gün keçibsə (sərhəd daxildir: tam 7 gün = uyğundur)
        if (isSystem && (!milestone.submittedAt || milestone.submittedAt > cutoff)) {
            throw conflict('This milestone is not yet due for automatic approval');
        }

        const gross = milestone.amountCents;
        const commission = calcCommission(gross);
        const net = gross - commission;

        const updated = await tx.milestone.updateMany({
            where: {
                id: milestoneId,
                status: 'IN_REVIEW',
                ...(isSystem && { submittedAt: { lte: cutoff } }),
            },
            data: { status: 'PAID', approvedAt: now, paidAt: now },
        });
        if (updated.count === 0) throw conflict('This milestone was already approved');

        await applyWalletChanges(tx, [
            {
                wallet: clientWallet,
                where: { lockedCents: { gte: gross } },
                data: { lockedCents: { decrement: gross } },
                error: () => new AppError('Escrow balance is inconsistent. Please contact support.', 500),
            },
            {
                wallet: freelancerWallet,
                where: { availableCents: { lte: MAX_INT - net } },
                data: { availableCents: { increment: net } },
                error: () => new AppError('Freelancer wallet balance limit reached', 400),
            },
        ]);

        const common = { milestoneId, reference, metadata: isSystem ? { auto: true } : undefined };
        const rows = [
            ledgerRow(clientWallet.id, 'ESCROW_RELEASE', 'DEBIT', 'LOCKED', gross, {
                ...common,
                description: `Escrow released for milestone ${milestone.sequence}`,
            }),
            ledgerRow(freelancerWallet.id, 'MILESTONE_PAYMENT', 'CREDIT', 'AVAILABLE', gross, {
                ...common,
                description: `Payment for milestone ${milestone.sequence}: ${milestone.title}`,
            }),
        ];
        // amountCents > 0 CHECK: komissiya 0 olarsa (X < 10 sent) yazı yaradılmır
        if (commission > 0) {
            rows.push(
                ledgerRow(freelancerWallet.id, 'COMMISSION', 'DEBIT', 'AVAILABLE', commission, {
                    ...common,
                    description: `Platform commission (10%) for milestone ${milestone.sequence}`,
                })
            );
        }
        await writeLedger(tx, rows);

        return {
            milestone: await tx.milestone.findUniqueOrThrow({ where: { id: milestoneId } }),
            payout: { grossCents: gross, commissionCents: commission, netCents: net },
        };
    });

    notifyMilestone(pre.contractId, result.milestone);
    return result;
};

// Gözləmə müddəti keçmiş (7 tam gün IN_REVIEW) mərhələləri avtomatik təsdiqləyir.
// "Nə vaxt təsdiqlənir" qaydası approveMilestone-dadır; bu funksiya yalnız namizədləri tapıb onu çağırır.
// Bir neçə instansiya eyni anda işləsə də təhlükəsizdir: ikinci instansiya 409 alır və keçir.
export const autoApproveDue = async ({ now = new Date(), batchSize = 100 } = {}) => {
    const cutoff = new Date(now.getTime() - AUTO_APPROVE_DAYS * DAY_MS);

    const due = await prisma.milestone.findMany({
        where: { status: 'IN_REVIEW', submittedAt: { lte: cutoff } },
        orderBy: { submittedAt: 'asc' },
        take: batchSize,
        select: { id: true },
    });

    const summary = { due: due.length, approved: 0, skipped: 0, failed: 0 };

    for (const { id } of due) {
        try {
            await approveMilestone(id, { actorId: SYSTEM_ACTOR, now });
            summary.approved += 1;
        } catch (err) {
            if (err instanceof AppError && err.statusCode < 500) {
                summary.skipped += 1; // başqa instansiya və ya client artıq təsdiqləyib
            } else {
                summary.failed += 1;
                logger.error(`Auto-approval failed for milestone ${id}: ${err.message}`, { stack: err.stack });
            }
        }
    }

    return summary;
};

// ---------- müqavilə ləğvi: escrow-un geri qaytarılması ----------

// applyCancellation-ın tranzaksiyası daxilində çağırılır (Contract kilidi artıq alınıb, client-in pul kisəsi
// tranzaksiyadan əvvəl ensureWallet ilə yaradılıb).
//   FUNDED / IN_REVIEW -> CANCELLED + geri qaytarma:  ESCROW_RELEASE DEBIT LOCKED + REFUND CREDIT AVAILABLE
//   PENDING            -> CANCELLED, ledger yazısı YOXDUR (pul hərəkət etməyib)
//   PAID               -> toxunulmur (ödənilmiş pul heç vaxt geri qaytarılmır)
export const refundContractEscrow = async (tx, contract) => {
    const milestones = await tx.milestone.findMany({
        where: { contractId: contract.id },
        orderBy: { sequence: 'asc' },
    });

    const funded = milestones.filter((m) => m.status === 'FUNDED' || m.status === 'IN_REVIEW');
    const total = funded.reduce((sum, m) => sum + m.amountCents, 0);

    if (funded.length > 0) {
        const clientWallet = await tx.wallet.findUnique({ where: { userId: contract.clientId } });
        if (!clientWallet) throw new AppError('Client wallet is missing. Please contact support.', 500);

        for (const milestone of funded) {
            const updated = await tx.milestone.updateMany({
                where: { id: milestone.id, status: milestone.status },
                data: { status: 'CANCELLED' },
            });
            if (updated.count === 0) throw conflict('A milestone changed while the contract was being cancelled');
        }

        await applyWalletChanges(tx, [
            {
                wallet: clientWallet,
                where: { lockedCents: { gte: total } },
                data: { lockedCents: { decrement: total }, availableCents: { increment: total } },
                error: () => new AppError('Escrow balance is inconsistent. Please contact support.', 500),
            },
        ]);

        const reference = randomUUID();
        const rows = funded.flatMap((m) => [
            ledgerRow(clientWallet.id, 'ESCROW_RELEASE', 'DEBIT', 'LOCKED', m.amountCents, {
                milestoneId: m.id,
                reference,
                description: `Escrow released: contract cancelled (milestone ${m.sequence})`,
            }),
            ledgerRow(clientWallet.id, 'REFUND', 'CREDIT', 'AVAILABLE', m.amountCents, {
                milestoneId: m.id,
                reference,
                description: `Refund: contract cancelled (milestone ${m.sequence})`,
            }),
        ]);
        await writeLedger(tx, rows);
    }

    await tx.milestone.updateMany({
        where: { contractId: contract.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
    });

    return { refundedCents: total, refundedMilestones: funded.length };
};

// Müqaviləni bitirməzdən əvvəl: BÜTÜN mərhələlər ödənilmiş (PAID) olmalıdır (ləğv olunmuşlar sayılmır, ən azı biri PAID).
// Ödənilməmiş mərhələ varsa müqavilə bitirilmir: client ya onları maliyyələşdirib təsdiqləməli, ya da ləğv etməlidir.
// completeContract-ın tranzaksiyası daxilində çağırılır (Contract kilidi artıq alınıb).
export const settleMilestonesOnComplete = async (tx, contractId) => {
    const unpaid = await tx.milestone.count({
        where: { contractId, status: { notIn: ['PAID', 'CANCELLED'] } },
    });
    if (unpaid > 0) {
        throw new AppError(
            'All milestones must be paid before the contract can be completed. Fund and approve the remaining milestones, or cancel the contract.',
            400
        );
    }

    const paid = await tx.milestone.count({ where: { contractId, status: 'PAID' } });
    if (paid === 0) {
        throw new AppError('A contract with no paid milestone cannot be completed. Cancel it instead.', 400);
    }
};

// Lövhədə işə başlamaq üçün pul escrow-da olmalıdır. issue bir mərhələyə bağlıdırsa həmin mərhələ,
// bağlı deyilsə (backlog) müqavilədə ən azı bir mərhələ FUNDED/IN_REVIEW olmalıdır.
export const assertWorkFunded = async (contractId, milestoneId = null) => {
    if (milestoneId) {
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            select: { status: true },
        });
        if (milestone && ['FUNDED', 'IN_REVIEW', 'PAID'].includes(milestone.status)) return;
    } else {
        const funded = await prisma.milestone.count({
            where: { contractId, status: { in: ['FUNDED', 'IN_REVIEW'] } },
        });
        if (funded > 0) return;
    }
    throw new AppError('Work is locked until the client funds a milestone (escrow). Cards stay in To do for now.', 400);
};

export { lockContract };
