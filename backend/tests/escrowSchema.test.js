import {
    app,
    prisma,
    auth,
    cleanUpUsers,
    registerUser,
    createJob,
    createProposal,
    createContract,
} from './helpers/db.js';
import request from 'supertest';

const PASSWORD = 'Password123!';

// Mərhələ 2A: yalnız verilənlər bazası strukturu (API hələ yoxdur). E-poçtlar "es_" ilə başlayır
describe('Phase 2A: escrow, milestone and wallet database schema', () => {
    const emails = ['es_client@upra.com', 'es_free@upra.com'];
    let client, free, contract;

    beforeAll(async () => {
        await cleanUpUsers(emails);

        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'ES Client', role: 'CLIENT' });
        free = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'ES Freelancer', role: 'FREELANCER' });

        const job = await createJob(client.token, { title: 'Escrow schema test job' });
        const proposal = await createProposal(free.token, job.id);
        contract = await createContract(client.token, proposal.id);
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    const milestone = (data) =>
        prisma.milestone.create({ data: { contractId: contract.id, title: 'Milestone', amountCents: 10000, ...data } });

    describe('Milestone', () => {
        it('stores several milestones per contract with a deterministic order and PENDING by default', async () => {
            await milestone({ sequence: 2, title: 'Second', amountCents: 2550 });
            await milestone({ sequence: 1, title: 'First', amountCents: 50000, dueDate: new Date('2027-01-01') });

            const list = await prisma.milestone.findMany({
                where: { contractId: contract.id },
                orderBy: { sequence: 'asc' },
            });

            expect(list.map((m) => [m.sequence, m.title, m.amountCents])).toEqual([
                [1, 'First', 50000],
                [2, 'Second', 2550],
            ]);
            list.forEach((m) => {
                expect(m.status).toBe('PENDING');
                expect(m.fundedAt).toBeNull();
                expect(m.paidAt).toBeNull();
            });
        });

        it('rejects a duplicate sequence within the same contract', async () => {
            await expect(milestone({ sequence: 1 })).rejects.toMatchObject({ code: 'P2002' });
        });

        it('rejects a zero or negative amount and a sequence below 1', async () => {
            await expect(milestone({ sequence: 10, amountCents: 0 })).rejects.toThrow();
            await expect(milestone({ sequence: 11, amountCents: -100 })).rejects.toThrow();
            await expect(milestone({ sequence: 0 })).rejects.toThrow();
        });

        it('supports every payment status', async () => {
            const m = await milestone({ sequence: 3 });
            for (const status of ['FUNDED', 'IN_REVIEW', 'APPROVED', 'PAID', 'DISPUTED']) {
                const updated = await prisma.milestone.update({ where: { id: m.id }, data: { status } });
                expect(updated.status).toBe(status);
            }
            await prisma.milestone.delete({ where: { id: m.id } });
        });
    });

    describe('Issue -> Milestone', () => {
        it('keeps issues without a milestone in the backlog and links others to a milestone', async () => {
            const m = await milestone({ sequence: 4 });

            const linked = await request(app)
                .post(`/api/contracts/${contract.id}/issues`)
                .set(auth(client.token))
                .send({ title: 'Linked issue' });
            const backlog = await request(app)
                .post(`/api/contracts/${contract.id}/issues`)
                .set(auth(client.token))
                .send({ title: 'Backlog issue' });
            expect(linked.status).toBe(201);
            expect(backlog.status).toBe(201);

            const linkedId = linked.body.issue.id;
            await prisma.issue.update({ where: { id: linkedId }, data: { milestoneId: m.id } });

            const withIssues = await prisma.milestone.findUnique({ where: { id: m.id }, include: { issues: true } });
            expect(withIssues.issues.map((i) => i.id)).toEqual([linkedId]);

            const backlogIssue = await prisma.issue.findUnique({ where: { id: backlog.body.issue.id } });
            expect(backlogIssue.milestoneId).toBeNull();

            // Mərhələ silinəndə issue silinmir, backlog-a qayıdır
            await prisma.milestone.delete({ where: { id: m.id } });
            const after = await prisma.issue.findUnique({ where: { id: linkedId } });
            expect(after).not.toBeNull();
            expect(after.milestoneId).toBeNull();
        });
    });

    describe('Wallet', () => {
        it('creates one wallet per user with zero balances in USD', async () => {
            const wallet = await prisma.wallet.create({ data: { userId: client.user.id } });

            expect(wallet).toMatchObject({ availableCents: 0, lockedCents: 0, currency: 'USD' });
            await expect(prisma.wallet.create({ data: { userId: client.user.id } })).rejects.toMatchObject({
                code: 'P2002',
            });
        });

        it('stores balances as integer cents and rejects negative balances', async () => {
            const wallet = await prisma.wallet.create({ data: { userId: free.user.id } });

            const updated = await prisma.wallet.update({
                where: { id: wallet.id },
                data: { availableCents: 2550, lockedCents: 10000 },
            });
            expect(updated.availableCents).toBe(2550);
            expect(Number.isInteger(updated.lockedCents)).toBe(true);

            await expect(
                prisma.wallet.update({ where: { id: wallet.id }, data: { availableCents: { decrement: 5000 } } })
            ).rejects.toThrow();
            await expect(
                prisma.wallet.update({ where: { id: wallet.id }, data: { lockedCents: -1 } })
            ).rejects.toThrow();
        });
    });

    describe('Transaction ledger', () => {
        it('records every operation type, grouped by reference, with optional milestone and metadata', async () => {
            const [clientWallet, freeWallet] = await Promise.all([
                prisma.wallet.findUnique({ where: { userId: client.user.id } }),
                prisma.wallet.findUnique({ where: { userId: free.user.id } }),
            ]);
            const m = await milestone({ sequence: 5, amountCents: 10000 });
            const reference = `payment:${m.id}`;

            const entries = [
                { walletId: clientWallet.id, type: 'TOP_UP', direction: 'CREDIT', amountCents: 20000 },
                { walletId: clientWallet.id, type: 'MILESTONE_FUNDING', direction: 'DEBIT', milestoneId: m.id, amountCents: 10000 },
                { walletId: clientWallet.id, type: 'ESCROW_LOCK', direction: 'CREDIT', balanceType: 'LOCKED', milestoneId: m.id, amountCents: 10000 },
                { walletId: clientWallet.id, type: 'ESCROW_RELEASE', direction: 'DEBIT', balanceType: 'LOCKED', milestoneId: m.id, amountCents: 10000, reference },
                { walletId: freeWallet.id, type: 'MILESTONE_PAYMENT', direction: 'CREDIT', milestoneId: m.id, amountCents: 10000, reference },
                { walletId: freeWallet.id, type: 'COMMISSION', direction: 'DEBIT', milestoneId: m.id, amountCents: 1000, reference, metadata: { rateBps: 1000 } },
                { walletId: clientWallet.id, type: 'REFUND', direction: 'CREDIT', amountCents: 500 },
                { walletId: freeWallet.id, type: 'WITHDRAWAL', direction: 'DEBIT', amountCents: 9000, description: 'Demo withdrawal' },
            ];
            for (const data of entries) await prisma.transaction.create({ data });

            const grouped = await prisma.transaction.findMany({ where: { reference }, orderBy: { createdAt: 'asc' } });
            expect(grouped.map((t) => t.type).sort()).toEqual(['COMMISSION', 'ESCROW_RELEASE', 'MILESTONE_PAYMENT']);

            const commission = grouped.find((t) => t.type === 'COMMISSION');
            expect(commission).toMatchObject({ currency: 'USD', balanceType: 'AVAILABLE', metadata: { rateBps: 1000 } });
            expect(commission.createdAt).toBeInstanceOf(Date);
            expect(commission).not.toHaveProperty('updatedAt');
        });

        it('rejects zero or negative amounts', async () => {
            const wallet = await prisma.wallet.findUnique({ where: { userId: client.user.id } });
            const base = { walletId: wallet.id, type: 'TOP_UP', direction: 'CREDIT' };

            await expect(prisma.transaction.create({ data: { ...base, amountCents: 0 } })).rejects.toThrow();
            await expect(prisma.transaction.create({ data: { ...base, amountCents: -1 } })).rejects.toThrow();
        });
    });

    describe('financial history is never deleted by cascade', () => {
        it('blocks deleting a milestone, wallet or user that has ledger entries', async () => {
            const m = await prisma.milestone.findFirst({ where: { contractId: contract.id, sequence: 5 } });
            const wallet = await prisma.wallet.findUnique({ where: { userId: free.user.id } });

            // PostgreSQL 18+ reports RESTRICT violations as 23001, older versions as 23503 (P2003)
            await expect(prisma.milestone.delete({ where: { id: m.id } })).rejects.toThrow(/Transaction_milestoneId_fkey/);
            await expect(prisma.wallet.delete({ where: { id: wallet.id } })).rejects.toThrow(/Transaction_walletId_fkey/);
            await expect(prisma.user.delete({ where: { id: free.user.id } })).rejects.toThrow();

            expect(await prisma.milestone.count({ where: { id: m.id } })).toBe(1);
            expect(await prisma.wallet.count({ where: { id: wallet.id } })).toBe(1);
            expect(await prisma.transaction.count({ where: { walletId: wallet.id } })).toBe(3);
        });

        it('blocks deleting a contract that has milestones', async () => {
            await expect(prisma.contract.delete({ where: { id: contract.id } })).rejects.toThrow();
            expect(await prisma.milestone.count({ where: { contractId: contract.id } })).toBeGreaterThan(0);
        });
    });
});
