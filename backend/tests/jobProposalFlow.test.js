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
} from './helpers/db.js';

const emails = ['jpf_client@upra.com', 'jpf_other_client@upra.com', 'jpf_free1@upra.com', 'jpf_free2@upra.com'];
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Jobs and proposals: filters, edge cases and flows', () => {
    let client, otherClient, free1, free2;
    let cheapJob, premiumJob, cancelJob;
    let free1PremiumProposal;

    beforeAll(async () => {
        await cleanUpUsers(emails);

        client = await registerUser({ email: emails[0], password: 'Password123!', fullName: 'JPF Client', role: 'CLIENT' });
        otherClient = await registerUser({ email: emails[1], password: 'Password123!', fullName: 'JPF Other', role: 'CLIENT' });
        free1 = await registerUser({ email: emails[2], password: 'Password123!', fullName: 'JPF Free One', role: 'FREELANCER' });
        free2 = await registerUser({ email: emails[3], password: 'Password123!', fullName: 'JPF Free Two', role: 'FREELANCER' });

        cheapJob = await createJob(client.token, { title: 'Quokka widget cheap project', budget: 300 });
        premiumJob = await createJob(client.token, { title: 'Quokka widget premium project', budget: 900 });
        cancelJob = await createJob(client.token, { title: 'Quokka widget job to cancel', budget: 500 });
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    describe('GET /api/jobs filters', () => {
        it('filters by search text', async () => {
            const res = await request(app).get('/api/jobs?search=quokka&limit=50');

            expect(res.status).toBe(200);
            expect(res.body.jobs.length).toBeGreaterThanOrEqual(3);
            res.body.jobs.forEach((j) => expect(j.title).toMatch(/quokka/i));
        });

        it('sorts by budget descending', async () => {
            const res = await request(app).get('/api/jobs?search=quokka&sort=budget_desc&limit=50');
            const budgets = res.body.jobs.map((j) => Number(j.budget));

            expect(budgets).toEqual([...budgets].sort((a, b) => b - a));
        });

        it('filters by minimum budget', async () => {
            const res = await request(app).get('/api/jobs?search=quokka&minBudget=600&limit=50');

            expect(res.body.jobs.length).toBeGreaterThan(0);
            res.body.jobs.forEach((j) => expect(Number(j.budget)).toBeGreaterThanOrEqual(600));
            expect(res.body.jobs.some((j) => j.id === premiumJob.id)).toBe(true);
            expect(res.body.jobs.some((j) => j.id === cheapJob.id)).toBe(false);
        });

        it('includes the proposal count in public and own lists', async () => {
            const pub = await request(app).get('/api/jobs?search=quokka&limit=50');
            pub.body.jobs.forEach((j) => expect(typeof j._count.proposals).toBe('number'));

            const mine = await request(app).get('/api/jobs/my').set(auth(client.token));
            mine.body.jobs.forEach((j) => expect(typeof j._count.proposals).toBe('number'));
        });

        it('does not let a FREELANCER call /jobs/my', async () => {
            const res = await request(app).get('/api/jobs/my').set(auth(free1.token));
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/jobs/:id', () => {
        it('returns 404 for an unknown job id', async () => {
            const res = await request(app).get(`/api/jobs/${MISSING_ID}`).set(auth(client.token));
            expect(res.status).toBe(404);
        });

        it('requires a token', async () => {
            const res = await request(app).get(`/api/jobs/${premiumJob.id}`);
            expect(res.status).toBe(401);
        });

        it('returns myProposal=null for a client and for a freelancer without a proposal', async () => {
            const asClient = await request(app).get(`/api/jobs/${premiumJob.id}`).set(auth(client.token));
            expect(asClient.body.myProposal).toBeNull();

            const asFree = await request(app).get(`/api/jobs/${premiumJob.id}`).set(auth(free1.token));
            expect(asFree.status).toBe(200);
            expect(asFree.body.myProposal).toBeNull();
        });
    });

    describe('Whitespace-only input', () => {
        it('rejects a job whose title and description are only spaces', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set(auth(client.token))
                .send({ title: '          ', description: ' '.repeat(40), budget: 100 });
            expect(res.status).toBe(400);
        });

        it('rejects a proposal whose cover letter is only spaces', async () => {
            const res = await request(app)
                .post('/api/proposals')
                .set(auth(free1.token))
                .send({ jobPostId: premiumJob.id, coverLetter: ' '.repeat(30), bidAmount: 100 });
            expect(res.status).toBe(400);
        });
    });

    describe('PATCH /api/jobs/:id validation', () => {
        it('rejects an empty update body', async () => {
            const res = await request(app).patch(`/api/jobs/${cheapJob.id}`).set(auth(client.token)).send({});
            expect(res.status).toBe(400);
        });

        it('rejects a negative budget', async () => {
            const res = await request(app)
                .patch(`/api/jobs/${cheapJob.id}`)
                .set(auth(client.token))
                .send({ budget: -5 });
            expect(res.status).toBe(400);
        });
    });

    describe('Proposal creation rules', () => {
        it('returns 404 when the job does not exist', async () => {
            const res = await request(app)
                .post('/api/proposals')
                .set(auth(free1.token))
                .send({
                    jobPostId: MISSING_ID,
                    coverLetter: 'A cover letter that is definitely long enough.',
                    bidAmount: 100,
                });
            expect(res.status).toBe(404);
        });

        it('rejects a malformed job id with 400', async () => {
            const res = await request(app)
                .post('/api/proposals')
                .set(auth(free1.token))
                .send({ jobPostId: 'abc', coverLetter: 'A cover letter that is long enough.', bidAmount: 100 });
            expect(res.status).toBe(400);
        });

        it('returns 409 (not 500) when the same freelancer sends two requests at the same time', async () => {
            free1PremiumProposal = null;
            const body = { jobPostId: premiumJob.id, coverLetter: 'Concurrent duplicate cover letter text.', bidAmount: 800 };

            const [a, b] = await Promise.all([
                request(app).post('/api/proposals').set(auth(free2.token)).send(body),
                request(app).post('/api/proposals').set(auth(free2.token)).send(body),
            ]);

            expect([a.status, b.status].sort()).toEqual([201, 409]);
        });

        it('shows myProposal to the freelancer after sending one', async () => {
            free1PremiumProposal = await createProposal(free1.token, premiumJob.id, { bidAmount: 850 });

            const res = await request(app).get(`/api/jobs/${premiumJob.id}`).set(auth(free1.token));
            expect(res.body.myProposal.id).toBe(free1PremiumProposal.id);
            expect(res.body.myProposal.status).toBe('PENDING');
        });
    });

    describe('Proposal access control', () => {
        it('forbids another freelancer from updating or deleting a proposal', async () => {
            const upd = await request(app)
                .patch(`/api/proposals/${free1PremiumProposal.id}`)
                .set(auth(free2.token))
                .send({ bidAmount: 1 });
            expect(upd.status).toBe(403);

            const del = await request(app).delete(`/api/proposals/${free1PremiumProposal.id}`).set(auth(free2.token));
            expect(del.status).toBe(403);
        });

        it('forbids outsiders from reading a proposal, allows the job owner', async () => {
            const outsider = await request(app)
                .get(`/api/proposals/${free1PremiumProposal.id}`)
                .set(auth(otherClient.token));
            expect(outsider.status).toBe(403);

            const otherFree = await request(app)
                .get(`/api/proposals/${free1PremiumProposal.id}`)
                .set(auth(free2.token));
            expect(otherFree.status).toBe(403);

            const owner = await request(app)
                .get(`/api/proposals/${free1PremiumProposal.id}`)
                .set(auth(client.token));
            expect(owner.status).toBe(200);
        });

        it('rejects an empty proposal update', async () => {
            const res = await request(app)
                .patch(`/api/proposals/${free1PremiumProposal.id}`)
                .set(auth(free1.token))
                .send({});
            expect(res.status).toBe(400);
        });
    });

    describe('Cancelling a job', () => {
        it('rejects pending proposals and blocks new ones', async () => {
            const proposal = await createProposal(free1.token, cancelJob.id);

            const del = await request(app).delete(`/api/jobs/${cancelJob.id}`).set(auth(client.token));
            expect(del.status).toBe(200);

            const stored = await prisma.proposal.findUnique({ where: { id: proposal.id } });
            expect(stored.status).toBe('REJECTED');

            const late = await request(app)
                .post('/api/proposals')
                .set(auth(free2.token))
                .send({
                    jobPostId: cancelJob.id,
                    coverLetter: 'Trying to apply after the job was cancelled.',
                    bidAmount: 100,
                });
            expect(late.status).toBe(400);
            expect(late.body.message).toMatch(/OPEN/);
        });

        it('cannot delete a job that is no longer OPEN', async () => {
            await prisma.jobPost.update({ where: { id: cheapJob.id }, data: { status: 'IN_PROGRESS' } });

            const res = await request(app).delete(`/api/jobs/${cheapJob.id}`).set(auth(client.token));
            expect(res.status).toBe(400);
        });
    });

    describe('Accepting a proposal', () => {
        it('exposes the contract id on the accepted proposal and locks it', async () => {
            const contract = await createContract(client.token, free1PremiumProposal.id);

            const mine = await request(app).get('/api/proposals/my').set(auth(free1.token));
            const accepted = mine.body.proposals.find((p) => p.id === free1PremiumProposal.id);
            expect(accepted.status).toBe('ACCEPTED');
            expect(accepted.contract.id).toBe(contract.id);

            const free2Proposal = (await request(app).get('/api/proposals/my').set(auth(free2.token))).body.proposals.find(
                (p) => p.jobPost.id === premiumJob.id,
            );
            expect(free2Proposal.status).toBe('REJECTED');
            expect(free2Proposal.contract).toBeNull();
        });

        it('cannot update or withdraw an accepted proposal', async () => {
            const upd = await request(app)
                .patch(`/api/proposals/${free1PremiumProposal.id}`)
                .set(auth(free1.token))
                .send({ bidAmount: 10 });
            expect(upd.status).toBe(400);

            const del = await request(app).delete(`/api/proposals/${free1PremiumProposal.id}`).set(auth(free1.token));
            expect(del.status).toBe(400);
        });
    });
});
