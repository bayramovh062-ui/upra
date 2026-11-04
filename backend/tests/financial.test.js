import request from 'supertest';
import {
    app,
    prisma,
    auth,
    cleanUpUsers,
    registerUser,
    createJob,
    createProposal,
} from './helpers/db.js';
import { reconcileWallet, getWalletRow } from './helpers/finance.js';
import {
    topUp,
    fundMilestone,
    submitMilestone,
    approveMilestone,
    autoApproveDue,
    calcCommission,
} from '../src/services/financialService.js';

const PASSWORD = 'Password123!';
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// Mərhələ 2B: pul kisəsi, mərhələ həyat dövrü, escrow, ləğv, avtomatik təsdiq. E-poçtlar "fin_" ilə başlayır.
// Paralellik testləri real test bazasına qarşı işləyir (mock yoxdur).
describe('Phase 2B: wallet, milestones, escrow ledger', () => {
    let counter = 0;
    const MAX_PAIRS = 60;
    const fixedEmails = ['fin_outsider@upra.com', 'fin_race@upra.com'];
    const allEmails = [
        ...fixedEmails,
        ...Array.from({ length: MAX_PAIRS }, (_, i) => `fin_c${i + 1}@upra.com`),
        ...Array.from({ length: MAX_PAIRS }, (_, i) => `fin_f${i + 1}@upra.com`),
    ];
    let outsider;

    beforeAll(async () => {
        await cleanUpUsers(allEmails);
        outsider = await registerUser({
            email: 'fin_outsider@upra.com',
            password: PASSWORD,
            fullName: 'Fin Outsider',
            role: 'CLIENT',
        });
    });

    afterAll(async () => {
        await cleanUpUsers(allEmails);
        await prisma.$disconnect();
    });

    // ---------- köməkçilər ----------

    const newPair = async () => {
        counter += 1;
        if (counter > MAX_PAIRS) throw new Error('Increase MAX_PAIRS in financial.test.js');
        const c = await registerUser({
            email: `fin_c${counter}@upra.com`,
            password: PASSWORD,
            fullName: `Fin Client ${counter}`,
            role: 'CLIENT',
        });
        const f = await registerUser({
            email: `fin_f${counter}@upra.com`,
            password: PASSWORD,
            fullName: `Fin Freelancer ${counter}`,
            role: 'FREELANCER',
        });
        return { c, f };
    };

    // milestones: [{ title, amount }] dollarla. Cəmi təklifin məbləği olur.
    const makeContract = async (pair, milestones) => {
        const total = milestones.reduce((sum, m) => sum + m.amount, 0);
        const job = await createJob(pair.c.token, { title: 'Financial test job', budget: total + 1000 });
        const proposal = await createProposal(pair.f.token, job.id, { bidAmount: total });
        const res = await request(app)
            .post('/api/contracts')
            .set(auth(pair.c.token))
            .send({ proposalId: proposal.id, milestones });
        if (res.status !== 201) throw new Error(`makeContract failed: ${JSON.stringify(res.body)}`);

        // Client təklif göndərir, frilanser qəbul edir: müqavilə ACTIVE olur
        const acceptRes = await request(app)
            .patch(`/api/contracts/${res.body.contract.id}/accept`)
            .set(auth(pair.f.token));
        if (acceptRes.status !== 200) throw new Error(`acceptContract failed: ${JSON.stringify(acceptRes.body)}`);

        return acceptRes.body.contract;
    };

    const post = (token, url, body) => request(app).post(url).set(auth(token)).send(body);
    const patch = (token, url, body) => request(app).patch(url).set(auth(token)).send(body);

    const topup = (token, amountCents) => post(token, '/api/wallet/topup', { amountCents });
    const fund = (token, id) => post(token, `/api/milestones/${id}/fund`);
    const submit = (token, id) => post(token, `/api/milestones/${id}/submit`);
    const approve = (token, id) => post(token, `/api/milestones/${id}/approve`);
    const requestChanges = (token, id) => post(token, `/api/milestones/${id}/request-changes`);

    const milestoneRow = (id) => prisma.milestone.findUnique({ where: { id } });
    const ledgerFor = (walletId) => prisma.transaction.findMany({ where: { walletId }, orderBy: { createdAt: 'asc' } });

    // Bir mərhələni IN_REVIEW vəziyyətinə gətirir (client pulu yükləyir, maliyyələşdirir, frilanser təhvil verir)
    const toInReview = async (amountDollars = 100) => {
        const pair = await newPair();
        const contract = await makeContract(pair, [{ title: 'Delivery', amount: amountDollars }]);
        const milestone = contract.milestones[0];
        expect((await topup(pair.c.token, milestone.amountCents)).status).toBe(201);
        expect((await fund(pair.c.token, milestone.id)).status).toBe(200);
        expect((await submit(pair.f.token, milestone.id)).status).toBe(200);
        return { pair, contract, milestone };
    };

    // ---------- müqavilə yaradılması ----------

    describe('contract creation and milestones', () => {
        it('creates one "Full delivery" milestone for the whole bid when none is provided', async () => {
            const pair = await newPair();
            const job = await createJob(pair.c.token, { title: 'Default milestone job' });
            const proposal = await createProposal(pair.f.token, job.id, { bidAmount: 250.5 });

            const res = await post(pair.c.token, '/api/contracts', { proposalId: proposal.id });

            expect(res.status).toBe(201);
            expect(res.body.contract.milestones).toHaveLength(1);
            expect(res.body.contract.milestones[0]).toMatchObject({
                title: 'Full delivery',
                amountCents: 25050,
                sequence: 1,
                status: 'PENDING',
            });
        });

        it('stores custom milestones in dollars as integer cents in order', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [
                { title: 'Design', amount: 30.25 },
                { title: 'Build', amount: 69.75 },
            ]);

            expect(contract.milestones.map((m) => [m.sequence, m.title, m.amountCents])).toEqual([
                [1, 'Design', 3025],
                [2, 'Build', 6975],
            ]);
        });

        it('rejects milestones that do not add up to the bid and keeps the job open', async () => {
            const pair = await newPair();
            const job = await createJob(pair.c.token, { title: 'Mismatch job' });
            const proposal = await createProposal(pair.f.token, job.id, { bidAmount: 100 });

            const res = await post(pair.c.token, '/api/contracts', {
                proposalId: proposal.id,
                milestones: [
                    { title: 'A', amount: 40 },
                    { title: 'B', amount: 40 },
                ],
            });

            expect(res.status).toBe(400);
            expect(await prisma.contract.count({ where: { proposalId: proposal.id } })).toBe(0);
            expect((await prisma.jobPost.findUnique({ where: { id: job.id } })).status).toBe('OPEN');
        });

        it('lists milestones to the parties only', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [{ title: 'Only', amount: 10 }]);

            const asFreelancer = await request(app)
                .get(`/api/contracts/${contract.id}/milestones`)
                .set(auth(pair.f.token));
            expect(asFreelancer.status).toBe(200);
            expect(asFreelancer.body.count).toBe(1);

            const asOutsider = await request(app)
                .get(`/api/contracts/${contract.id}/milestones`)
                .set(auth(outsider.token));
            expect([403, 404]).toContain(asOutsider.status);
        });
    });

    // ---------- pul kisəsi ----------

    describe('wallet', () => {
        it('tops up, withdraws and keeps the ledger in sync with the balance', async () => {
            const pair = await newPair();

            const empty = await request(app).get('/api/wallet').set(auth(pair.c.token));
            expect(empty.status).toBe(200);
            expect(empty.body.wallet).toMatchObject({ availableCents: 0, lockedCents: 0, currency: 'USD' });

            const up = await topup(pair.c.token, 12345);
            expect(up.status).toBe(201);
            expect(up.body.demo).toBe(true);
            expect(up.body.wallet.availableCents).toBe(12345);

            const out = await post(pair.c.token, '/api/wallet/withdraw', { amountCents: 2345 });
            expect(out.status).toBe(200);
            expect(out.body.wallet.availableCents).toBe(10000);

            const summary = await request(app).get('/api/wallet').set(auth(pair.c.token));
            expect(summary.body.transactions.map((t) => t.type).sort()).toEqual(['TOP_UP', 'WITHDRAWAL']);

            await reconcileWallet(pair.c.user.id);
        });

        it('rejects a top-up over the per-request limit and non-integer or non-positive amounts', async () => {
            const pair = await newPair();

            expect((await topup(pair.c.token, 500001)).status).toBe(400);
            expect((await topup(pair.c.token, 0)).status).toBe(400);
            expect((await topup(pair.c.token, -5)).status).toBe(400);
            expect((await topup(pair.c.token, 10.5)).status).toBe(400);
            expect((await topup(pair.c.token, 500000)).status).toBe(201);

            await reconcileWallet(pair.c.user.id);
        });

        it('rejects a withdrawal above the available balance and changes nothing', async () => {
            const pair = await newPair();
            await topup(pair.c.token, 1000);

            const res = await post(pair.c.token, '/api/wallet/withdraw', { amountCents: 1001 });

            expect(res.status).toBe(400);
            expect((await getWalletRow(pair.c.user.id)).availableCents).toBe(1000);
            await reconcileWallet(pair.c.user.id);
        });

        it('requires authentication', async () => {
            expect((await request(app).get('/api/wallet')).status).toBe(401);
            expect((await request(app).post('/api/wallet/topup').send({ amountCents: 100 })).status).toBe(401);
        });

        it('two simultaneous first-use requests create exactly one wallet and lose no balance', async () => {
            const race = await registerUser({
                email: 'fin_race@upra.com',
                password: PASSWORD,
                fullName: 'Fin Race',
                role: 'CLIENT',
            });
            expect(await prisma.wallet.count({ where: { userId: race.user.id } })).toBe(0);

            const results = await Promise.all([topup(race.token, 1000), topup(race.token, 1000), topup(race.token, 1000)]);

            expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
            expect(await prisma.wallet.count({ where: { userId: race.user.id } })).toBe(1);
            expect((await getWalletRow(race.user.id)).availableCents).toBe(3000);
            await reconcileWallet(race.user.id);
        }, 30000);
    });

    // ---------- mərhələ həyat dövrü ----------

    describe('milestone lifecycle', () => {
        it('happy path: fund -> submit -> approve with exact balances, 10% commission and a matching ledger', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [{ title: 'Full', amount: 100 }]);
            const m = contract.milestones[0];

            expect((await topup(pair.c.token, 20000)).status).toBe(201);

            const funded = await fund(pair.c.token, m.id);
            expect(funded.status).toBe(200);
            expect(funded.body.milestone.status).toBe('FUNDED');
            expect(funded.body.wallet).toMatchObject({ availableCents: 10000, lockedCents: 10000 });
            await reconcileWallet(pair.c.user.id);

            const submitted = await submit(pair.f.token, m.id);
            expect(submitted.status).toBe(200);
            expect(submitted.body.milestone.status).toBe('IN_REVIEW');
            expect(submitted.body.milestone.submittedAt).toBeTruthy();

            const approved = await approve(pair.c.token, m.id);
            expect(approved.status).toBe(200);
            expect(approved.body.milestone.status).toBe('PAID');
            expect(approved.body.payout).toEqual({ grossCents: 10000, commissionCents: 1000, netCents: 9000 });

            const clientWallet = await getWalletRow(pair.c.user.id);
            const freeWallet = await getWalletRow(pair.f.user.id);
            expect(clientWallet).toMatchObject({ availableCents: 10000, lockedCents: 0 });
            expect(freeWallet).toMatchObject({ availableCents: 9000, lockedCents: 0 });

            // Frilanser: MILESTONE_PAYMENT CREDIT 10000 + COMMISSION DEBIT 1000, komissiya yalnız bir dəfə
            const freeLedger = await ledgerFor(freeWallet.id);
            expect(freeLedger.map((t) => [t.type, t.direction, t.balanceType, t.amountCents]).sort()).toEqual([
                ['COMMISSION', 'DEBIT', 'AVAILABLE', 1000],
                ['MILESTONE_PAYMENT', 'CREDIT', 'AVAILABLE', 10000],
            ]);

            // Client: escrow-dan tam (gross) məbləğ buraxılır
            const clientLedger = await ledgerFor(clientWallet.id);
            const release = clientLedger.filter((t) => t.type === 'ESCROW_RELEASE');
            expect(release).toHaveLength(1);
            expect(release[0]).toMatchObject({ direction: 'DEBIT', balanceType: 'LOCKED', amountCents: 10000 });
            expect(clientLedger.every((t) => t.milestoneId === null || t.milestoneId === m.id)).toBe(true);

            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        });

        it('rounds the commission down to whole cents and keeps the remainder with the freelancer', async () => {
            expect(calcCommission(1005)).toBe(100);
            expect(calcCommission(9)).toBe(0);
            expect(calcCommission(10)).toBe(1);

            const pair = await newPair();
            const contract = await makeContract(pair, [{ title: 'Odd amount', amount: 10.05 }]);
            const m = contract.milestones[0];
            await topup(pair.c.token, 1005);
            await fund(pair.c.token, m.id);
            await submit(pair.f.token, m.id);

            const approved = await approve(pair.c.token, m.id);

            expect(approved.status).toBe(200);
            expect(approved.body.payout).toEqual({ grossCents: 1005, commissionCents: 100, netCents: 905 });
            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(905);
            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        });

        it('writes no commission row when the commission rounds down to zero', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [{ title: 'Tiny', amount: 0.09 }]);
            const m = contract.milestones[0];
            await topup(pair.c.token, 9);
            await fund(pair.c.token, m.id);
            await submit(pair.f.token, m.id);

            const approved = await approve(pair.c.token, m.id);

            expect(approved.status).toBe(200);
            expect(approved.body.payout).toEqual({ grossCents: 9, commissionCents: 0, netCents: 9 });
            const freeWallet = await getWalletRow(pair.f.user.id);
            expect(freeWallet.availableCents).toBe(9);
            expect((await ledgerFor(freeWallet.id)).map((t) => t.type)).toEqual(['MILESTONE_PAYMENT']);
            await reconcileWallet(pair.f.user.id);
        });

        it('rejects wrong roles and non-parties with 403 without changing anything', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [{ title: 'Guarded', amount: 50 }]);
            const m = contract.milestones[0];
            await topup(pair.c.token, 5000);
            await topup(outsider.token, 5000);

            expect((await fund(pair.f.token, m.id)).status).toBe(403); // frilanser maliyyələşdirə bilməz
            expect((await fund(outsider.token, m.id)).status).toBe(403); // müqavilənin tərəfi deyil
            expect((await milestoneRow(m.id)).status).toBe('PENDING');

            await fund(pair.c.token, m.id);
            expect((await submit(pair.c.token, m.id)).status).toBe(403); // client təhvil verə bilməz
            await submit(pair.f.token, m.id);

            expect((await approve(pair.f.token, m.id)).status).toBe(403); // frilanser özü təsdiqləyə bilməz
            expect((await approve(outsider.token, m.id)).status).toBe(403);
            expect((await requestChanges(pair.f.token, m.id)).status).toBe(403);
            expect((await milestoneRow(m.id)).status).toBe('IN_REVIEW');

            await reconcileWallet(pair.c.user.id);
        });

        it('rejects funding with an insufficient balance and changes nothing', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [{ title: 'Costly', amount: 100 }]);
            const m = contract.milestones[0];
            await topup(pair.c.token, 9999);

            const res = await fund(pair.c.token, m.id);

            expect(res.status).toBe(400);
            expect((await milestoneRow(m.id)).status).toBe('PENDING');
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 9999, lockedCents: 0 });
            expect(await prisma.transaction.count({ where: { milestoneId: m.id } })).toBe(0);
            await reconcileWallet(pair.c.user.id);
        });

        it('only allows the documented status transitions', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [{ title: 'Strict', amount: 20 }]);
            const m = contract.milestones[0];
            await topup(pair.c.token, 2000);

            expect((await submit(pair.f.token, m.id)).status).toBe(409); // PENDING -> IN_REVIEW yoxdur
            expect((await approve(pair.c.token, m.id)).status).toBe(409); // PENDING -> PAID yoxdur
            expect((await requestChanges(pair.c.token, m.id)).status).toBe(409);

            await fund(pair.c.token, m.id);
            expect((await fund(pair.c.token, m.id)).status).toBe(409); // ikiqat maliyyələşdirmə
            expect((await approve(pair.c.token, m.id)).status).toBe(409); // FUNDED -> PAID yoxdur
            expect((await requestChanges(pair.c.token, m.id)).status).toBe(409);

            await submit(pair.f.token, m.id);
            expect((await submit(pair.f.token, m.id)).status).toBe(409);

            await approve(pair.c.token, m.id);
            expect((await approve(pair.c.token, m.id)).status).toBe(409); // ikiqat təsdiq
            expect((await requestChanges(pair.c.token, m.id)).status).toBe(409); // PAID-dən geri yol yoxdur

            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(1800);
            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        });

        it('request-changes sends the milestone back to FUNDED, keeps the escrow and allows a second submission', async () => {
            const { pair, milestone } = await toInReview(40);

            const changes = await requestChanges(pair.c.token, milestone.id);
            expect(changes.status).toBe(200);
            expect(changes.body.milestone.status).toBe('FUNDED');
            expect(changes.body.milestone.submittedAt).toBeNull();
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 4000 });

            expect((await submit(pair.f.token, milestone.id)).status).toBe(200);
            const approved = await approve(pair.c.token, milestone.id);
            expect(approved.status).toBe(200);
            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(3600);

            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        });
    });

    // ---------- ardıcıllıq ----------

    describe('sequential funding', () => {
        it('funds milestone 2 only after milestone 1 is PAID', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [
                { title: 'One', amount: 10 },
                { title: 'Two', amount: 10 },
            ]);
            const [m1, m2] = contract.milestones;
            await topup(pair.c.token, 5000);

            expect((await fund(pair.c.token, m2.id)).status).toBe(400); // m1 hələ PENDING
            expect((await milestoneRow(m2.id)).status).toBe('PENDING');

            await fund(pair.c.token, m1.id);
            expect((await fund(pair.c.token, m2.id)).status).toBe(400); // m1 FUNDED, PAID deyil
            await submit(pair.f.token, m1.id);
            expect((await fund(pair.c.token, m2.id)).status).toBe(400); // m1 IN_REVIEW

            await approve(pair.c.token, m1.id);
            const second = await fund(pair.c.token, m2.id);
            expect(second.status).toBe(200);
            expect(second.body.milestone.status).toBe('FUNDED');

            await reconcileWallet(pair.c.user.id);
        });

        it('two simultaneous fund requests for different milestones of one contract: only milestone 1 can win', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [
                { title: 'One', amount: 10 },
                { title: 'Two', amount: 10 },
            ]);
            const [m1, m2] = contract.milestones;
            await topup(pair.c.token, 5000);

            const [r1, r2] = await Promise.all([fund(pair.c.token, m1.id), fund(pair.c.token, m2.id)]);

            expect(r1.status).toBe(200);
            expect(r2.status).toBe(400);
            expect((await milestoneRow(m1.id)).status).toBe('FUNDED');
            expect((await milestoneRow(m2.id)).status).toBe('PENDING');
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 4000, lockedCents: 1000 });
            await reconcileWallet(pair.c.user.id);
        }, 30000);
    });

    // ---------- paralellik ----------

    describe('concurrency', () => {
        it('two simultaneous approvals pay out exactly once', async () => {
            const { pair, milestone } = await toInReview(100);

            const results = await Promise.all([
                approve(pair.c.token, milestone.id),
                approve(pair.c.token, milestone.id),
                approve(pair.c.token, milestone.id),
            ]);

            expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(9000);
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 0 });
            expect(await prisma.transaction.count({ where: { milestoneId: milestone.id, type: 'MILESTONE_PAYMENT' } })).toBe(1);
            expect(await prisma.transaction.count({ where: { milestoneId: milestone.id, type: 'COMMISSION' } })).toBe(1);
            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        }, 30000);

        it('two simultaneous fund requests for the same milestone lock the money once', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [{ title: 'Once', amount: 30 }]);
            const m = contract.milestones[0];
            await topup(pair.c.token, 9000);

            const results = await Promise.all([fund(pair.c.token, m.id), fund(pair.c.token, m.id)]);

            expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 6000, lockedCents: 3000 });
            expect(await prisma.transaction.count({ where: { milestoneId: m.id, type: 'ESCROW_LOCK' } })).toBe(1);
            await reconcileWallet(pair.c.user.id);
        }, 30000);

        it('two simultaneous withdrawals can never overdraw the wallet', async () => {
            const pair = await newPair();
            await topup(pair.c.token, 1000);

            const results = await Promise.all([
                post(pair.c.token, '/api/wallet/withdraw', { amountCents: 700 }),
                post(pair.c.token, '/api/wallet/withdraw', { amountCents: 700 }),
            ]);

            expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
            expect((await getWalletRow(pair.c.user.id)).availableCents).toBe(300);
            await reconcileWallet(pair.c.user.id);
        }, 30000);

        it('contracts with swapped client/freelancer wallets running concurrently never deadlock', async () => {
            const pair = await newPair();
            const ROUNDS = 3;
            const AMOUNT = 1000;
            const c = pair.c.user.id;
            const f = pair.f.user.id;

            // Müqavilə A: client = c, frilanser = f (API ilə). Müqavilə B: rollar tərsinə (client = f, frilanser = c).
            // Rol yoxlaması yalnız HTTP qatındadır; kilid sırasını xidmət qatından birbaşa yoxlayırıq.
            const contractA = await makeContract(
                pair,
                Array.from({ length: ROUNDS }, (_, i) => ({ title: `A${i + 1}`, amount: AMOUNT / 100 }))
            );
            const jobB = await createJob(pair.c.token, { title: 'Swapped roles job' });
            const proposalB = await createProposal(pair.f.token, jobB.id, { bidAmount: 30 });
            const contractB = await prisma.contract.create({
                data: { jobPostId: jobB.id, proposalId: proposalB.id, clientId: f, freelancerId: c },
            });
            await prisma.milestone.createMany({
                data: Array.from({ length: ROUNDS }, (_, i) => ({
                    contractId: contractB.id,
                    title: `B${i + 1}`,
                    amountCents: AMOUNT,
                    sequence: i + 1,
                    updatedAt: new Date(),
                })),
            });
            const milestonesB = await prisma.milestone.findMany({
                where: { contractId: contractB.id },
                orderBy: { sequence: 'asc' },
            });

            await topUp(c, 100000);
            await topUp(f, 100000);

            for (let i = 0; i < ROUNDS; i += 1) {
                const a = contractA.milestones[i];
                const b = milestonesB[i];

                await fundMilestone(a.id, c);
                await fundMilestone(b.id, f);
                await submitMilestone(a.id, f);
                await submitMilestone(b.id, c);

                const settled = await Promise.allSettled([
                    approveMilestone(a.id, { actorId: c }),
                    approveMilestone(b.id, { actorId: f }),
                ]);
                expect(settled.map((s) => s.status)).toEqual(['fulfilled', 'fulfilled']);
            }

            const statuses = await prisma.milestone.findMany({
                where: { contractId: { in: [contractA.id, contractB.id] } },
                select: { status: true },
            });
            expect(statuses.every((s) => s.status === 'PAID')).toBe(true);
            await reconcileWallet(c);
            await reconcileWallet(f);
        }, 60000);
    });

    // ---------- avtomatik təsdiq ----------

    describe('automatic approval (7 full days in review)', () => {
        const setSubmittedAt = (id, date) => prisma.milestone.update({ where: { id }, data: { submittedAt: date } });

        it('does not approve before seven full days (6d 23h 59m)', async () => {
            const { pair, milestone } = await toInReview(100);
            const now = new Date();
            await setSubmittedAt(milestone.id, new Date(now.getTime() - (7 * DAY_MS - MINUTE_MS)));

            await autoApproveDue({ now });

            expect((await milestoneRow(milestone.id)).status).toBe('IN_REVIEW');
            await expect(approveMilestone(milestone.id, { actorId: 'SYSTEM', now })).rejects.toMatchObject({
                statusCode: 409,
            });
            expect((await getWalletRow(pair.f.user.id))?.availableCents ?? 0).toBe(0);
            await reconcileWallet(pair.c.user.id);
        });

        it('approves at exactly seven days', async () => {
            const { pair, milestone } = await toInReview(100);
            const now = new Date();
            await setSubmittedAt(milestone.id, new Date(now.getTime() - 7 * DAY_MS));

            await autoApproveDue({ now });

            const paid = await milestoneRow(milestone.id);
            expect(paid.status).toBe('PAID');
            expect(paid.paidAt).toBeTruthy();
            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(9000);
            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        });

        it('approves at seven days plus one minute', async () => {
            const { pair, milestone } = await toInReview(100);
            const now = new Date();
            await setSubmittedAt(milestone.id, new Date(now.getTime() - (7 * DAY_MS + MINUTE_MS)));

            await autoApproveDue({ now });

            expect((await milestoneRow(milestone.id)).status).toBe('PAID');
            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(9000);
            await reconcileWallet(pair.f.user.id);
        });

        it('pays once even when the scheduler runs twice, concurrently or one after another', async () => {
            const { pair, milestone } = await toInReview(100);
            const now = new Date();
            await setSubmittedAt(milestone.id, new Date(now.getTime() - 8 * DAY_MS));

            await Promise.all([autoApproveDue({ now }), autoApproveDue({ now })]);
            await autoApproveDue({ now });

            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(9000);
            expect(await prisma.transaction.count({ where: { milestoneId: milestone.id, type: 'MILESTONE_PAYMENT' } })).toBe(1);
            expect(await prisma.transaction.count({ where: { milestoneId: milestone.id, type: 'COMMISSION' } })).toBe(1);
            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        }, 30000);

        it('loses the race gracefully when the client approves first', async () => {
            const { pair, milestone } = await toInReview(100);
            const now = new Date();
            await setSubmittedAt(milestone.id, new Date(now.getTime() - 9 * DAY_MS));

            const [manual] = await Promise.all([approve(pair.c.token, milestone.id), autoApproveDue({ now })]);

            expect([200, 409]).toContain(manual.status);
            expect((await milestoneRow(milestone.id)).status).toBe('PAID');
            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(9000);
            await reconcileWallet(pair.f.user.id);
        }, 30000);
    });

    // ---------- ləğv ----------

    describe('cancellation and refunds', () => {
        it('cancel-request accept: refunds FUNDED escrow, cancels PENDING without ledger rows, leaves PAID untouched', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [
                { title: 'One', amount: 30 },
                { title: 'Two', amount: 30 },
                { title: 'Three', amount: 40 },
            ]);
            const [m1, m2, m3] = contract.milestones;
            await topup(pair.c.token, 10000);

            await fund(pair.c.token, m1.id);
            await submit(pair.f.token, m1.id);
            await approve(pair.c.token, m1.id); // m1 PAID: 3000 - 300 komissiya = 2700 frilanserdə
            await fund(pair.c.token, m2.id); // m2 FUNDED: 3000 escrow-da
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 4000, lockedCents: 3000 });

            // İş başlayıb (m1 PAID) => birbaşa ləğv olmaz, razılıq lazımdır
            expect((await patch(pair.c.token, `/api/contracts/${contract.id}/cancel`)).status).toBe(400);
            expect((await patch(pair.c.token, `/api/contracts/${contract.id}/cancel-request`, { reason: 'Stop' })).status).toBe(200);
            expect((await patch(pair.c.token, `/api/contracts/${contract.id}/cancel-request/accept`)).status).toBe(403); // öz təklifi
            expect((await milestoneRow(m2.id)).status).toBe('FUNDED'); // razılıq olmayınca pul toxunulmaz

            const accepted = await patch(pair.f.token, `/api/contracts/${contract.id}/cancel-request/accept`);
            expect(accepted.status).toBe(200);
            expect(accepted.body.contract.status).toBe('CANCELLED');

            expect((await milestoneRow(m1.id)).status).toBe('PAID'); // ödənilmiş heç vaxt geri qaytarılmır
            expect((await milestoneRow(m2.id)).status).toBe('CANCELLED');
            expect((await milestoneRow(m3.id)).status).toBe('CANCELLED');
            expect(await prisma.transaction.count({ where: { milestoneId: m3.id } })).toBe(0); // PENDING: ledger yoxdur

            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 7000, lockedCents: 0 });
            expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(2700);

            const m2Ledger = await prisma.transaction.findMany({ where: { milestoneId: m2.id } });
            expect(m2Ledger.map((t) => [t.type, t.direction, t.balanceType, t.amountCents]).sort()).toEqual([
                ['ESCROW_LOCK', 'CREDIT', 'LOCKED', 3000],
                ['ESCROW_RELEASE', 'DEBIT', 'LOCKED', 3000],
                ['MILESTONE_FUNDING', 'DEBIT', 'AVAILABLE', 3000],
                ['REFUND', 'CREDIT', 'AVAILABLE', 3000],
            ]);

            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        }, 30000);

        it('cancel-request accept refunds an IN_REVIEW milestone', async () => {
            const { pair, contract, milestone } = await toInReview(60);

            expect((await patch(pair.f.token, `/api/contracts/${contract.id}/cancel-request`, {})).status).toBe(200);
            const accepted = await patch(pair.c.token, `/api/contracts/${contract.id}/cancel-request/accept`);

            expect(accepted.status).toBe(200);
            expect((await milestoneRow(milestone.id)).status).toBe('CANCELLED');
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 6000, lockedCents: 0 });
            expect((await getWalletRow(pair.f.user.id))?.availableCents ?? 0).toBe(0);
            await reconcileWallet(pair.c.user.id);
        });

        it('direct cancel (work not started) refunds a FUNDED milestone and cancels the rest', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [
                { title: 'One', amount: 25 },
                { title: 'Two', amount: 25 },
            ]);
            const [m1, m2] = contract.milestones;
            await topup(pair.c.token, 2500);
            await fund(pair.c.token, m1.id);

            const cancelled = await patch(pair.f.token, `/api/contracts/${contract.id}/cancel`);

            expect(cancelled.status).toBe(200);
            expect((await milestoneRow(m1.id)).status).toBe('CANCELLED');
            expect((await milestoneRow(m2.id)).status).toBe('CANCELLED');
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 2500, lockedCents: 0 });
            await reconcileWallet(pair.c.user.id);

            // Ləğv olunmuş müqavilədə heç bir maliyyə əməliyyatı yoxdur
            await topup(pair.c.token, 2500);
            expect((await fund(pair.c.token, m2.id)).status).toBe(400);
        });

        it('a simultaneous cancellation and approval never double-spends the escrow', async () => {
            const { pair, contract, milestone } = await toInReview(100);
            await patch(pair.f.token, `/api/contracts/${contract.id}/cancel-request`, {});

            const [accept, approval] = await Promise.all([
                patch(pair.c.token, `/api/contracts/${contract.id}/cancel-request/accept`),
                approve(pair.c.token, milestone.id),
            ]);

            const final = await milestoneRow(milestone.id);
            expect(['PAID', 'CANCELLED']).toContain(final.status);
            if (final.status === 'PAID') {
                expect(approval.status).toBe(200);
                expect((await getWalletRow(pair.f.user.id)).availableCents).toBe(9000);
                expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 0 });
            } else {
                expect(accept.status).toBe(200);
                expect((await getWalletRow(pair.f.user.id))?.availableCents ?? 0).toBe(0);
                expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 10000, lockedCents: 0 });
            }
            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        }, 30000);

        it('a duplicate accept request does not refund twice', async () => {
            const { pair, contract } = await toInReview(50);
            await patch(pair.f.token, `/api/contracts/${contract.id}/cancel-request`, {});

            const results = await Promise.all([
                patch(pair.c.token, `/api/contracts/${contract.id}/cancel-request/accept`),
                patch(pair.c.token, `/api/contracts/${contract.id}/cancel-request/accept`),
            ]);

            expect(results.filter((r) => r.status === 200)).toHaveLength(1);
            expect(await getWalletRow(pair.c.user.id)).toMatchObject({ availableCents: 5000, lockedCents: 0 });
            expect(await prisma.transaction.count({ where: { walletId: (await getWalletRow(pair.c.user.id)).id, type: 'REFUND' } })).toBe(1);
            await reconcileWallet(pair.c.user.id);
        }, 30000);
    });

    // ---------- müqaviləni bitirmə ----------

    describe('completing a contract', () => {
        it('is blocked while a milestone holds funds, then cancels the remaining PENDING milestones', async () => {
            const pair = await newPair();
            const contract = await makeContract(pair, [
                { title: 'One', amount: 20 },
                { title: 'Two', amount: 20 },
            ]);
            const [m1, m2] = contract.milestones;
            await topup(pair.c.token, 2000);
            await fund(pair.c.token, m1.id);

            const blocked = await patch(pair.c.token, `/api/contracts/${contract.id}/complete`);
            expect(blocked.status).toBe(400);
            expect((await prisma.contract.findUnique({ where: { id: contract.id } })).status).toBe('ACTIVE');
            expect((await milestoneRow(m1.id)).status).toBe('FUNDED');

            await submit(pair.f.token, m1.id);
            const stillBlocked = await patch(pair.c.token, `/api/contracts/${contract.id}/complete`);
            expect(stillBlocked.status).toBe(400); // IN_REVIEW də pulu saxlayır

            await approve(pair.c.token, m1.id);
            const done = await patch(pair.c.token, `/api/contracts/${contract.id}/complete`);

            expect(done.status).toBe(200);
            expect(done.body.contract.status).toBe('COMPLETED');
            expect((await milestoneRow(m1.id)).status).toBe('PAID');
            expect((await milestoneRow(m2.id)).status).toBe('CANCELLED');
            expect(await prisma.transaction.count({ where: { milestoneId: m2.id } })).toBe(0);
            await reconcileWallet(pair.c.user.id);
            await reconcileWallet(pair.f.user.id);
        });

        it('treats a milestone in review as started work for the cancellation rules', async () => {
            const { pair, contract } = await toInReview(10);

            const direct = await patch(pair.c.token, `/api/contracts/${contract.id}/cancel`);

            expect(direct.status).toBe(400);
            const fetched = await request(app).get(`/api/contracts/${contract.id}`).set(auth(pair.c.token));
            expect(fetched.body.contract.workStarted).toBe(true);
            expect(fetched.body.contract.milestones).toHaveLength(1);
        });
    });
});
