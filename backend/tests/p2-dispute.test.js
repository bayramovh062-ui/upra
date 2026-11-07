import { prisma, cleanUpUsers, registerUser } from './helpers/db.js';
import { reconcileWallet } from './helpers/finance.js';
import {
    PASSWORD,
    api,
    pairEmails,
    registerPair,
    registerAdmin,
    createContractWithMilestones,
    fundAndSubmit,
    walletOf,
    milestoneLedger,
} from './helpers/p2.js';
import { autoApproveDue } from '../src/services/financialService.js';

// P2: milestone mübahisəsi və admin həlli (RELEASE / REFUND / SPLIT). E-poçtlar "p2dis_" ilə başlayır.
const PREFIX = 'p2dis';
const MAX_PAIRS = 12;
const ADMIN_EMAIL = `${PREFIX}_admin@upra.com`;
const OUTSIDER_EMAIL = `${PREFIX}_outsider@upra.com`;
const ALL_EMAILS = [
    ADMIN_EMAIL,
    OUTSIDER_EMAIL,
    ...Array.from({ length: MAX_PAIRS }, (_, i) => Object.values(pairEmails(PREFIX, i + 1))).flat(),
];

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Phase 2 milestone disputes', () => {
    let counter = 0;
    let admin;
    let outsider;

    const newPair = async () => {
        counter += 1;
        if (counter > MAX_PAIRS) throw new Error('Increase MAX_PAIRS in p2-dispute.test.js');
        return registerPair(PREFIX, counter);
    };

    const openOn = async (contract, milestone, token, reason = 'The delivered work does not match the agreement') =>
        api.post(token, `/api/milestones/${milestone.id}/dispute`, { reason });
    const resolve = (disputeId, body) =>
        api.patch(admin.token, `/api/admin/disputes/${disputeId}/resolve`, body);

    beforeAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        admin = await registerAdmin(ADMIN_EMAIL);
        outsider = await registerUser({
            email: OUTSIDER_EMAIL,
            password: PASSWORD,
            fullName: 'Dispute Outsider',
            role: 'CLIENT',
        });
    });

    afterAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        await prisma.$disconnect();
    });

    it('lets only contract parties dispute a funded milestone and freezes milestone actions', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Disputed work', amount: 50 }],
        });
        const milestone = contract.milestones[0];

        // PENDING mərhələ escrow-da pul saxlamır
        expect((await openOn(contract, milestone, pair.c.token)).status).toBe(409);
        // Tərəf olmayan şəxs həmişə 403
        expect((await openOn(contract, milestone, outsider.token)).status).toBe(403);
        // Çox qısa səbəb validasiyadan keçmir
        expect(
            (await api.post(pair.c.token, `/api/milestones/${milestone.id}/dispute`, { reason: 'no' })).status
        ).toBe(400);

        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);

        const opened = await openOn(contract, milestone, pair.f.token);
        expect(opened.status).toBe(201);
        expect(opened.body.dispute).toMatchObject({
            milestoneId: milestone.id,
            status: 'OPEN',
            resolution: null,
            openedById: pair.f.user.id,
        });

        expect((await prisma.milestone.findUnique({ where: { id: milestone.id } })).status).toBe('DISPUTED');

        // İkinci açıq mübahisə yoxdur (client də cəhd edir)
        expect((await openOn(contract, milestone, pair.c.token, 'I also want to dispute this')).status).toBe(409);

        // Mübahisə həllinə qədər bütün mərhələ əməliyyatları bloklanır
        expect((await api.post(pair.f.token, `/api/milestones/${milestone.id}/submit`)).status).toBe(409);
        expect((await api.post(pair.c.token, `/api/milestones/${milestone.id}/approve`)).status).toBe(409);
        expect((await api.post(pair.c.token, `/api/milestones/${milestone.id}/request-changes`)).status).toBe(409);

        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 5000 });
        expect((await walletOf(pair.f.user.id))?.availableCents ?? 0).toBe(0);

        // Tarixçə dispute-u göstərir
        const history = await api.get(pair.c.token, `/api/contracts/${contract.id}/history`);
        expect(history.status).toBe(200);
        expect(history.body.disputes).toHaveLength(1);
        expect(history.body.disputes[0]).toMatchObject({ id: opened.body.dispute.id, status: 'OPEN' });
    });

    it('never auto-approves a disputed milestone, even after the waiting period', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Auto guard', amount: 100 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);
        await openOn(contract, milestone, pair.c.token, 'Client is not happy with the delivery');

        // Namizəd olsaydı avtomatik təsdiqlənəcək qədər köhnə tarix
        await prisma.milestone.update({
            where: { id: milestone.id },
            data: { submittedAt: new Date(Date.now() - 8 * DAY_MS) },
        });

        await autoApproveDue();

        expect((await prisma.milestone.findUnique({ where: { id: milestone.id } })).status).toBe('DISPUTED');
        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 10000 });
        // Heç bir pul frilanserə keçmədiyi üçün onun pul kisəsi hələ yaranmayıb
        expect(await walletOf(pair.f.user.id)).toBeNull();
        await reconcileWallet(pair.c.user.id);
    });

    it('RELEASE pays the freelancer with commission and records the ledger atomically', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Release me', amount: 100 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);
        const opened = await openOn(contract, milestone, pair.c.token);
        const disputeId = opened.body.dispute.id;

        const resolved = await resolve(disputeId, { resolution: 'RELEASE', adminNote: 'Work was verified' });
        expect(resolved.status).toBe(200);
        expect(resolved.body.milestone).toMatchObject({
            status: 'PAID',
            resolvedReleaseCents: 10000,
            resolvedRefundCents: 0,
        });
        expect(resolved.body.dispute).toMatchObject({
            status: 'RESOLVED',
            resolution: 'RELEASE',
            releaseToFreelancerCents: 10000,
            refundToClientCents: 0,
            adminId: admin.user.id,
            adminNote: 'Work was verified',
        });
        expect(resolved.body.payout).toEqual({
            grossCents: 10000,
            releaseCents: 10000,
            refundCents: 0,
            commissionCents: 1000,
            netCents: 9000,
        });

        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 0 });
        expect(await walletOf(pair.f.user.id)).toMatchObject({ availableCents: 9000, lockedCents: 0 });

        const rows = await milestoneLedger(milestone.id);
        // Maliyyələşdirmə yazıları (ESCROW_LOCK + MILESTONE_FUNDING) + həll yazıları
        const resolutionRows = rows.filter((t) => !['ESCROW_LOCK', 'MILESTONE_FUNDING'].includes(t.type));
        expect(resolutionRows.map((t) => [t.type, t.direction, t.balanceType, t.amountCents])).toEqual(
            expect.arrayContaining([
                ['ESCROW_RELEASE', 'DEBIT', 'LOCKED', 10000],
                ['MILESTONE_PAYMENT', 'CREDIT', 'AVAILABLE', 10000],
                ['COMMISSION', 'DEBIT', 'AVAILABLE', 1000],
            ])
        );
        expect(resolutionRows).toHaveLength(3);
        expect(new Set(resolutionRows.map((t) => t.reference)).size).toBe(1);

        await reconcileWallet(pair.c.user.id);
        await reconcileWallet(pair.f.user.id);

        // İdempotentlik: ikinci həll 409 və heç bir yeni ledger yazısı yoxdur
        expect((await resolve(disputeId, { resolution: 'RELEASE' })).status).toBe(409);
        expect(await milestoneLedger(milestone.id)).toHaveLength(rows.length);
        expect(await walletOf(pair.f.user.id)).toMatchObject({ availableCents: 9000 });
    });

    it('REFUND returns the full amount to the client without commission', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Refund me', amount: 75 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);
        const opened = await openOn(contract, milestone, pair.f.token);

        const resolved = await resolve(opened.body.dispute.id, { resolution: 'REFUND' });
        expect(resolved.status).toBe(200);
        expect(resolved.body.milestone).toMatchObject({
            status: 'CANCELLED',
            resolvedReleaseCents: 0,
            resolvedRefundCents: 7500,
        });
        expect(resolved.body.dispute).toMatchObject({
            resolution: 'REFUND',
            releaseToFreelancerCents: 0,
            refundToClientCents: 7500,
        });
        expect(resolved.body.payout).toEqual({
            grossCents: 7500,
            releaseCents: 0,
            refundCents: 7500,
            commissionCents: 0,
            netCents: 0,
        });

        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 7500, lockedCents: 0 });
        expect((await walletOf(pair.f.user.id))?.availableCents ?? 0).toBe(0);

        const rows = await milestoneLedger(milestone.id);
        const resolutionRows = rows.filter((t) => !['ESCROW_LOCK', 'MILESTONE_FUNDING'].includes(t.type));
        expect(resolutionRows.map((t) => [t.type, t.direction, t.balanceType, t.amountCents]).sort()).toEqual([
            ['ESCROW_RELEASE', 'DEBIT', 'LOCKED', 7500],
            ['REFUND', 'CREDIT', 'AVAILABLE', 7500],
        ]);
        expect(rows.some((t) => t.type === 'COMMISSION')).toBe(false);

        await reconcileWallet(pair.c.user.id);
        // REFUND zamanı frilanserə heç bir pul keçmir, ona görə pul kisəsi yaranmır
        expect(await walletOf(pair.f.user.id)).toBeNull();
    });

    it('SPLIT releases part, refunds the rest and commissions only the released part', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Split me', amount: 100 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);
        const opened = await openOn(contract, milestone, pair.c.token);

        const resolved = await resolve(opened.body.dispute.id, {
            resolution: 'SPLIT',
            releaseCents: 6000,
            refundCents: 4000,
        });
        expect(resolved.status).toBe(200);
        expect(resolved.body.milestone).toMatchObject({
            status: 'PAID',
            resolvedReleaseCents: 6000,
            resolvedRefundCents: 4000,
        });
        expect(resolved.body.payout).toEqual({
            grossCents: 10000,
            releaseCents: 6000,
            refundCents: 4000,
            commissionCents: 600,
            netCents: 5400,
        });

        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 4000, lockedCents: 0 });
        expect(await walletOf(pair.f.user.id)).toMatchObject({ availableCents: 5400, lockedCents: 0 });

        const rows = await milestoneLedger(milestone.id);
        const resolutionRows = rows.filter((t) => !['ESCROW_LOCK', 'MILESTONE_FUNDING'].includes(t.type));
        expect(resolutionRows.map((t) => [t.type, t.direction, t.balanceType, t.amountCents]).sort()).toEqual([
            ['COMMISSION', 'DEBIT', 'AVAILABLE', 600],
            ['ESCROW_RELEASE', 'DEBIT', 'LOCKED', 10000],
            ['MILESTONE_PAYMENT', 'CREDIT', 'AVAILABLE', 6000],
            ['REFUND', 'CREDIT', 'AVAILABLE', 4000],
        ]);
        expect(new Set(resolutionRows.map((t) => t.reference)).size).toBe(1);

        await reconcileWallet(pair.c.user.id);
        await reconcileWallet(pair.f.user.id);
    });

    it('rejects a split whose parts do not add up to the escrowed amount without moving money', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Bad split', amount: 80 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);
        const opened = await openOn(contract, milestone, pair.c.token);
        const disputeId = opened.body.dispute.id;

        const bad = await resolve(disputeId, { resolution: 'SPLIT', releaseCents: 5000, refundCents: 1000 });
        expect(bad.status).toBe(400);
        expect(bad.body.message).toMatch(/must equal the escrowed amount/);

        expect((await prisma.milestone.findUnique({ where: { id: milestone.id } })).status).toBe('DISPUTED');
        expect(await prisma.dispute.findUnique({ where: { id: disputeId } })).toMatchObject({ status: 'OPEN' });
        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 8000 });
        expect(await milestoneLedger(milestone.id)).toHaveLength(2); // funding + escrow lock
    });

    it('blocks cancellation while a dispute is open, then allows it after a REFUND resolution', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Cancel guard', amount: 50 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);
        const opened = await openOn(contract, milestone, pair.c.token);

        // İş başlayıb (DISPUTED daxil), ona görə yalnız razılıqla ləğv mümkündür
        expect((await api.patch(pair.c.token, `/api/contracts/${contract.id}/cancel`)).status).toBe(400);
        expect(
            (await api.patch(pair.c.token, `/api/contracts/${contract.id}/cancel-request`, { reason: 'Stop' })).status
        ).toBe(200);

        const blocked = await api.patch(pair.f.token, `/api/contracts/${contract.id}/cancel-request/accept`);
        expect(blocked.status).toBe(409);
        expect(blocked.body.message).toMatch(/Resolve open disputes/);

        expect((await prisma.contract.findUnique({ where: { id: contract.id } })).status).toBe('ACTIVE');
        expect((await prisma.milestone.findUnique({ where: { id: milestone.id } })).status).toBe('DISPUTED');
        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 5000 });

        // REFUND həlli dispute-u bağlayır; sonra ləğv təklifi qəbul olunur
        expect((await resolve(opened.body.dispute.id, { resolution: 'REFUND' })).status).toBe(200);
        const accepted = await api.patch(pair.f.token, `/api/contracts/${contract.id}/cancel-request/accept`);
        expect(accepted.status).toBe(200);
        expect(accepted.body.contract.status).toBe('CANCELLED');
        expect((await prisma.milestone.findUnique({ where: { id: milestone.id } })).status).toBe('CANCELLED');
        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 5000, lockedCents: 0 });
        await reconcileWallet(pair.c.user.id);
    });

    it('only ADMIN can list, read and resolve disputes', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Admin only', amount: 20 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);
        const opened = await openOn(contract, milestone, pair.c.token);

        const list = await api.get(admin.token, '/api/admin/disputes?status=OPEN');
        expect(list.status).toBe(200);
        expect(list.body.disputes.some((d) => d.id === opened.body.dispute.id)).toBe(true);

        const detail = await api.get(admin.token, `/api/admin/disputes/${opened.body.dispute.id}`);
        expect(detail.status).toBe(200);
        expect(detail.body.submissions.map((s) => s.type)).toEqual(['SUBMITTED']);

        expect((await api.get(pair.c.token, '/api/admin/disputes')).status).toBe(403);
        expect((await api.get(pair.c.token, `/api/admin/disputes/${opened.body.dispute.id}`)).status).toBe(403);
        expect(
            (await api.patch(pair.c.token, `/api/admin/disputes/${opened.body.dispute.id}/resolve`, { resolution: 'RELEASE' }))
                .status
        ).toBe(403);
        expect((await api.get(admin.token, '/api/admin/disputes/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    });
});
