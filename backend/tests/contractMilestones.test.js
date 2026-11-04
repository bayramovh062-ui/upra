import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import { cleanUpUsers } from './helpers/db.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const clientUser = {
    email: 'contract.milestones.client@upra.com',
    password: 'Password123!',
    fullName: 'Milestone Plan Client',
    role: 'CLIENT',
};

const freelancerUser = {
    email: 'contract.milestones.freelancer@upra.com',
    password: 'Password123!',
    fullName: 'Milestone Plan Freelancer',
    role: 'FREELANCER',
};

const testEmails = [clientUser.email, freelancerUser.email];

describe('POST /api/contracts — milestone plan', () => {
    let clientToken;
    let freelancerToken;
    let jobSeq = 0;

    const cleanUp = () => cleanUpUsers(testEmails);

    // Hər test təzə iş + təklif yaradır: contract yaradanda iş IN_PROGRESS olur və
    // təklif ACCEPTED olur, ona görə eyni job ikinci dəfə istifadə edilə bilməz.
    const createJobAndProposal = async ({ bidAmount = 1900 } = {}) => {
        jobSeq += 1;

        const jobRes = await request(app)
            .post('/api/jobs')
            .set(auth(clientToken))
            .send({
                title: `Milestone plan regression job ${jobSeq}`,
                description: 'A sufficiently long description for the milestone plan regression test.',
                budget: 2000,
            });

        if (jobRes.status !== 201) {
            throw new Error(`createJob failed (${jobRes.status}): ${JSON.stringify(jobRes.body)}`);
        }

        const jobPostId = jobRes.body.job.id;

        const proposalRes = await request(app)
            .post('/api/proposals')
            .set(auth(freelancerToken))
            .send({
                jobPostId,
                coverLetter: 'I can deliver this project in well defined milestones.',
                bidAmount,
            });

        if (proposalRes.status !== 201) {
            throw new Error(`createProposal failed (${proposalRes.status}): ${JSON.stringify(proposalRes.body)}`);
        }

        return { jobPostId, proposalId: proposalRes.body.proposal.id };
    };

    const createContract = (proposalId, milestones) =>
        request(app)
            .post('/api/contracts')
            .set(auth(clientToken))
            .send(milestones === undefined ? { proposalId } : { proposalId, milestones });

    beforeAll(async () => {
        await cleanUp();

        const clientRes = await request(app).post('/api/auth/register').send(clientUser);
        clientToken = clientRes.body.token;

        const freelancerRes = await request(app).post('/api/auth/register').send(freelancerUser);
        freelancerToken = freelancerRes.body.token;
    });

    afterAll(async () => {
        await cleanUp();
        await prisma.$disconnect();
    });

    it('keeps a 2-milestone plan in the database and exposes it to the escrow endpoints', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const res = await createContract(proposalId, [
            { title: 'Design', amount: 950 },
            { title: 'Development', amount: 950 },
        ]);

        expect(res.status).toBe(201);
        expect(res.body.contract.milestones).toHaveLength(2);
        expect(res.body.contract.milestones.map((m) => m.sequence)).toEqual([1, 2]);
        expect(res.body.contract.milestones.map((m) => m.title)).toEqual(['Design', 'Development']);
        expect(res.body.contract.milestones.map((m) => m.amountCents)).toEqual([95000, 95000]);

        const contractId = res.body.contract.id;
        const stored = await prisma.milestone.findMany({
            where: { contractId },
            orderBy: { sequence: 'asc' },
        });

        expect(stored).toHaveLength(2);
        expect(stored.map((m) => m.amountCents)).toEqual([95000, 95000]);

        // Escrow UI bu endpoint-dən oxuyur (GET /api/contracts/:id)
        const detailRes = await request(app).get(`/api/contracts/${contractId}`).set(auth(freelancerToken));
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.contract.milestones).toHaveLength(2);
        expect(detailRes.body.contract.milestones.map((m) => m.sequence)).toEqual([1, 2]);
    });

    it('keeps a 3-milestone plan with titles, amounts, sequences and due dates', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const res = await createContract(proposalId, [
            { title: 'Discovery', amount: 600, dueDate: '2026-12-01' },
            { title: 'Design', amount: 500, dueDate: '2026-12-15' },
            { title: 'Build and handover', amount: 800 },
        ]);

        expect(res.status).toBe(201);
        expect(res.body.contract.milestones).toHaveLength(3);
        expect(res.body.contract.milestones.map((m) => m.sequence)).toEqual([1, 2, 3]);
        expect(res.body.contract.milestones.map((m) => m.title)).toEqual([
            'Discovery',
            'Design',
            'Build and handover',
        ]);
        expect(res.body.contract.milestones.map((m) => m.amountCents)).toEqual([60000, 50000, 80000]);

        const [first, second, third] = res.body.contract.milestones;
        expect(first.dueDate).toBe('2026-12-01T00:00:00.000Z');
        expect(second.dueDate).toBe('2026-12-15T00:00:00.000Z');
        expect(third.dueDate).toBeNull();

        const contractId = res.body.contract.id;

        const myRes = await request(app).get('/api/contracts/my').set(auth(clientToken));
        const mine = myRes.body.contracts.find((c) => c.id === contractId);
        expect(mine.milestones).toHaveLength(3);
        expect(mine.milestones.map((m) => m.sequence)).toEqual([1, 2, 3]);

        const milestonesRes = await request(app)
            .get(`/api/contracts/${contractId}/milestones`)
            .set(auth(clientToken));
        expect(milestonesRes.status).toBe(200);
        expect(milestonesRes.body.count).toBe(3);
    });

    it('keeps more than three milestones (5) untouched', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const plan = [
            { title: 'One', amount: 100 },
            { title: 'Two', amount: 200 },
            { title: 'Three', amount: 300 },
            { title: 'Four', amount: 500 },
            { title: 'Five', amount: 800 },
        ];

        const res = await createContract(proposalId, plan);

        expect(res.status).toBe(201);
        expect(res.body.contract.milestones).toHaveLength(5);
        expect(res.body.contract.milestones.map((m) => m.title)).toEqual(plan.map((m) => m.title));
        expect(res.body.contract.milestones.map((m) => m.amountCents)).toEqual([
            10000, 20000, 30000, 50000, 80000,
        ]);
    });

    it('accepts a split that adds up to the bid with cent precision', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const res = await createContract(proposalId, [
            { title: 'Part 1', amount: 633.33 },
            { title: 'Part 2', amount: 633.33 },
            { title: 'Part 3', amount: 633.34 },
        ]);

        expect(res.status).toBe(201);
        expect(res.body.contract.milestones.map((m) => m.amountCents)).toEqual([63333, 63333, 63334]);
        expect(res.body.contract.milestones.reduce((sum, m) => sum + m.amountCents, 0)).toBe(190000);
    });

    it('keeps the one-payment flow when milestones are omitted', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const res = await createContract(proposalId);

        expect(res.status).toBe(201);
        expect(res.body.contract.milestones).toHaveLength(1);
        expect(res.body.contract.milestones[0]).toMatchObject({
            title: 'Full delivery',
            amountCents: 190000,
            sequence: 1,
            dueDate: null,
        });
    });

    it('rejects a plan that does not add up to the bid and writes nothing', async () => {
        const { proposalId, jobPostId } = await createJobAndProposal({ bidAmount: 1900 });

        const res = await createContract(proposalId, [
            { title: 'Only part', amount: 600 },
            { title: 'Another part', amount: 500 },
        ]);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/add up to the accepted bid/i);

        expect(await prisma.contract.findFirst({ where: { jobPostId } })).toBeNull();
        expect(await prisma.milestone.count({ where: { contract: { jobPostId } } })).toBe(0);

        const job = await prisma.jobPost.findUnique({ where: { id: jobPostId } });
        const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
        expect(job.status).toBe('OPEN');
        expect(proposal.status).toBe('PENDING');
    });

    it('rejects a zero or negative milestone amount', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const zero = await createContract(proposalId, [
            { title: 'Free work', amount: 0 },
            { title: 'Rest', amount: 1900 },
        ]);
        expect(zero.status).toBe(400);
        expect(zero.body.message).toMatch(/positive/i);

        const negative = await createContract(proposalId, [
            { title: 'Negative', amount: -100 },
            { title: 'Rest', amount: 2000 },
        ]);
        expect(negative.status).toBe(400);
        expect(negative.body.message).toMatch(/positive/i);
    });

    it('rejects amounts with more than two decimal places', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const res = await createContract(proposalId, [
            { title: 'Too precise', amount: 10.005 },
            { title: 'Rest', amount: 1889.995 },
        ]);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/2 decimal places/i);
    });

    it('rejects an invalid due date', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const res = await createContract(proposalId, [
            { title: 'Bad date', amount: 1900, dueDate: 'not-a-date' },
        ]);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/valid date/i);
    });

    it('rejects more than 20 milestones', async () => {
        const { proposalId } = await createJobAndProposal({ bidAmount: 1900 });

        const plan = Array.from({ length: 21 }, (_, i) => ({ title: `Milestone ${i + 1}`, amount: 1 }));

        const res = await createContract(proposalId, plan);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at most 20 milestones/i);
    });

    it('rejects an empty milestone array instead of silently creating a full-delivery contract', async () => {
        const { proposalId, jobPostId } = await createJobAndProposal({ bidAmount: 1900 });

        const res = await createContract(proposalId, []);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least one milestone/i);
        expect(await prisma.contract.findFirst({ where: { jobPostId } })).toBeNull();
    });
});
