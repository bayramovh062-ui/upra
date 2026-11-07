import request from 'supertest';
import {
    app,
    prisma,
    auth,
    cleanUpUsers,
    registerUser,
    createJob,
    createProposal,
    createContract,
    fundContract,
} from './helpers/db.js';
import { topUp, fundMilestone, submitMilestone, approveMilestone } from '../src/services/financialService.js';

const PASSWORD = 'Password123!';
const emails = ['p0_client@upra.com', 'p0_free@upra.com'];
const DAY_MS = 24 * 60 * 60 * 1000;

// P0: pul qapıları. Escrow-da pul olmadan iş başlamır, bütün mərhələlər ödənilmədən müqavilə bitmir,
// auto-approve xarici cron ilə çağırıla bilir.
describe('P0 money gates', () => {
    let client;
    let freelancer;

    const makeContract = async (milestones) => {
        const total = milestones.reduce((sum, m) => sum + m.amount, 0);
        const job = await createJob(client.token, { title: 'P0 gate job', budget: total + 100 });
        const proposal = await createProposal(freelancer.token, job.id, { bidAmount: total });
        const res = await request(app)
            .post('/api/contracts')
            .set(auth(client.token))
            .send({ proposalId: proposal.id, milestones });
        if (res.status !== 201) throw new Error(`create failed: ${JSON.stringify(res.body)}`);
        const accepted = await request(app).patch(`/api/contracts/${res.body.contract.id}/accept`).set(auth(freelancer.token));
        return accepted.body.contract;
    };

    const addIssue = async (contractId, title = 'Gate card') => {
        const res = await request(app).post(`/api/contracts/${contractId}/issues`).set(auth(client.token)).send({ title });
        expect(res.status).toBe(201);
        return res.body.issue;
    };

    const move = (issueId, status, position = 1000) =>
        request(app).patch(`/api/issues/${issueId}/move`).set(auth(freelancer.token)).send({ status, position });

    beforeAll(async () => {
        await cleanUpUsers(emails);
        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'P0 Client', role: 'CLIENT' });
        freelancer = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'P0 Freelancer', role: 'FREELANCER' });
    });

    afterAll(async () => {
        delete process.env.CRON_SECRET;
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    describe('board is locked until a milestone is funded', () => {
        it('lets cards be created in To do but refuses to start work without escrow', async () => {
            const contract = await makeContract([{ title: 'Only', amount: 50 }]);
            const issue = await addIssue(contract.id);

            const started = await move(issue.id, 'IN_PROGRESS');
            expect(started.status).toBe(400);
            expect(started.body.message).toMatch(/funds? a milestone|escrow/i);

            const done = await move(issue.id, 'DONE');
            expect(done.status).toBe(400);

            // TODO-da yenidən sıralamaq hər zaman mümkündür
            const reorder = await move(issue.id, 'TODO', 1500);
            expect(reorder.status).toBe(200);

            const stored = await prisma.issue.findUnique({ where: { id: issue.id } });
            expect(stored.status).toBe('TODO');
        });

        it('unlocks the board once a milestone is funded', async () => {
            const contract = await makeContract([{ title: 'Only', amount: 50 }]);
            const issue = await addIssue(contract.id);

            await fundContract(client.user.id, contract.id);

            const started = await move(issue.id, 'IN_PROGRESS');
            expect(started.status).toBe(200);
            expect(started.body.issue.status).toBe('IN_PROGRESS');
        });

        it('keeps a card bound to an unfunded milestone locked even if another milestone is funded', async () => {
            const contract = await makeContract([
                { title: 'First', amount: 20 },
                { title: 'Second', amount: 30 },
            ]);
            const [m1, m2] = contract.milestones;
            await fundContract(client.user.id, contract.id); // yalnız m1 FUNDED

            const free = await addIssue(contract.id, 'Backlog card');
            const bound1 = await addIssue(contract.id, 'Card of milestone one');
            const bound2 = await addIssue(contract.id, 'Card of milestone two');
            await prisma.issue.update({ where: { id: bound1.id }, data: { milestoneId: m1.id } });
            await prisma.issue.update({ where: { id: bound2.id }, data: { milestoneId: m2.id } });

            expect((await move(free.id, 'IN_PROGRESS')).status).toBe(200);
            expect((await move(bound1.id, 'IN_PROGRESS')).status).toBe(200);

            const locked = await move(bound2.id, 'IN_PROGRESS');
            expect(locked.status).toBe(400);
        });

        it('does not unlock the board for a cancelled contract that refunded its escrow', async () => {
            const contract = await makeContract([{ title: 'Only', amount: 40 }]);
            await fundContract(client.user.id, contract.id);
            const issue = await addIssue(contract.id);

            const cancelled = await request(app).patch(`/api/contracts/${contract.id}/cancel`).set(auth(client.token));
            expect(cancelled.status).toBe(200);

            const res = await move(issue.id, 'IN_PROGRESS');
            expect(res.status).toBe(400);
        });
    });

    describe('contract completion needs every milestone paid', () => {
        it('refuses completion while any milestone is not PAID and accepts it afterwards', async () => {
            const contract = await makeContract([
                { title: 'One', amount: 10 },
                { title: 'Two', amount: 10 },
            ]);
            const [m1, m2] = contract.milestones;
            const complete = () => request(app).patch(`/api/contracts/${contract.id}/complete`).set(auth(client.token));

            await topUp(client.user.id, 2000);
            expect((await complete()).status).toBe(400);

            await fundMilestone(m1.id, client.user.id);
            await submitMilestone(m1.id, freelancer.user.id);
            await approveMilestone(m1.id, { actorId: client.user.id });
            expect((await complete()).status).toBe(400); // m2 hələ PENDING

            await fundMilestone(m2.id, client.user.id);
            await submitMilestone(m2.id, freelancer.user.id);
            await approveMilestone(m2.id, { actorId: client.user.id });

            const done = await complete();
            expect(done.status).toBe(200);
            expect(done.body.contract.status).toBe('COMPLETED');
        });

        it('exposes no deliver/reopen endpoints anymore', async () => {
            const contract = await makeContract([{ title: 'Only', amount: 10 }]);

            const deliver = await request(app).patch(`/api/contracts/${contract.id}/deliver`).set(auth(freelancer.token));
            const reopen = await request(app).patch(`/api/contracts/${contract.id}/reopen`).set(auth(client.token));
            expect(deliver.status).toBe(404);
            expect(reopen.status).toBe(404);
        });
    });

    describe('POST /api/internal/auto-approve (external cron)', () => {
        it('is disabled (404) when CRON_SECRET is not configured', async () => {
            delete process.env.CRON_SECRET;
            const res = await request(app).post('/api/internal/auto-approve').set('x-cron-secret', 'whatever');
            expect(res.status).toBe(404);
        });

        it('rejects a missing or wrong secret with 401', async () => {
            process.env.CRON_SECRET = 'test-cron-secret-123';

            const missing = await request(app).post('/api/internal/auto-approve');
            expect(missing.status).toBe(401);

            const wrong = await request(app).post('/api/internal/auto-approve').set('x-cron-secret', 'nope');
            expect(wrong.status).toBe(401);
        });

        it('approves milestones that waited 7 full days and reports a summary', async () => {
            process.env.CRON_SECRET = 'test-cron-secret-123';

            const contract = await makeContract([{ title: 'Auto', amount: 100 }]);
            const m = contract.milestones[0];
            await topUp(client.user.id, m.amountCents);
            await fundMilestone(m.id, client.user.id);
            await submitMilestone(m.id, freelancer.user.id);
            await prisma.milestone.update({
                where: { id: m.id },
                data: { submittedAt: new Date(Date.now() - 8 * DAY_MS) },
            });

            const res = await request(app).post('/api/internal/auto-approve').set('x-cron-secret', 'test-cron-secret-123');

            expect(res.status).toBe(200);
            expect(res.body.summary.approved).toBeGreaterThanOrEqual(1);
            expect((await prisma.milestone.findUnique({ where: { id: m.id } })).status).toBe('PAID');

            // İkinci çağırış ikiqat ödəmə etmir
            const again = await request(app).post('/api/internal/auto-approve').set('x-cron-secret', 'test-cron-secret-123');
            expect(again.status).toBe(200);
            expect(await prisma.transaction.count({ where: { milestoneId: m.id, type: 'MILESTONE_PAYMENT' } })).toBe(1);
        });
    });
});
