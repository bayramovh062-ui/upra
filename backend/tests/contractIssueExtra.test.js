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

const emails = ['cie_client@upra.com', 'cie_free@upra.com', 'cie_outsider@upra.com'];
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Contracts and issues: permissions, response shape, delete, cancel', () => {
    let client, freelancer, outsider;
    let job, contract, issueId;

    const createIssue = async (body) => {
        const res = await request(app)
            .post(`/api/contracts/${contract.id}/issues`)
            .set(auth(client.token))
            .send(body);
        expect(res.status).toBe(201);
        return res.body.issue;
    };

    beforeAll(async () => {
        await cleanUpUsers(emails);

        client = await registerUser({ email: emails[0], password: 'Password123!', fullName: 'CIE Client', role: 'CLIENT' });
        freelancer = await registerUser({ email: emails[1], password: 'Password123!', fullName: 'CIE Freelancer', role: 'FREELANCER' });
        outsider = await registerUser({ email: emails[2], password: 'Password123!', fullName: 'CIE Outsider', role: 'FREELANCER' });

        job = await createJob(client.token, { title: 'Contract and issue extra test job' });
        const proposal = await createProposal(freelancer.token, job.id);
        contract = await createContract(client.token, proposal.id, freelancer.token);
        // Kartı TODO-dan çıxarmaq üçün escrow-da pul lazımdır (P0 pul qapısı)
        await fundContract(client.user.id, contract.id);
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    describe('Contract permissions and response shape', () => {
        it('returns 404 for an unknown contract id', async () => {
            const res = await request(app).get(`/api/contracts/${MISSING_ID}`).set(auth(client.token));
            expect(res.status).toBe(404);
        });

        it('does not leak e-mail addresses of the parties', async () => {
            const one = await request(app).get(`/api/contracts/${contract.id}`).set(auth(freelancer.token));
            expect(one.body.contract.client.email).toBeUndefined();
            expect(one.body.contract.freelancer.email).toBeUndefined();

            const list = await request(app).get('/api/contracts/my').set(auth(client.token));
            list.body.contracts.forEach((c) => {
                expect(c.client.email).toBeUndefined();
                expect(c.freelancer.email).toBeUndefined();
            });
        });

        it('lets the freelancer see the contract in their own list', async () => {
            const res = await request(app).get('/api/contracts/my').set(auth(freelancer.token));
            expect(res.body.contracts.some((c) => c.id === contract.id)).toBe(true);
        });

        it('forbids the freelancer from completing the contract', async () => {
            const complete = await request(app)
                .patch(`/api/contracts/${contract.id}/complete`)
                .set(auth(freelancer.token));
            expect(complete.status).toBe(403);
        });

        it('forbids an outsider from cancelling or requesting cancellation', async () => {
            const cancel = await request(app).patch(`/api/contracts/${contract.id}/cancel`).set(auth(outsider.token));
            expect(cancel.status).toBe(403);

            const request403 = await request(app)
                .patch(`/api/contracts/${contract.id}/cancel-request`)
                .set(auth(outsider.token))
                .send({});
            expect(request403.status).toBe(403);
        });

        it('rejects a malformed proposal id when creating a contract', async () => {
            const res = await request(app)
                .post('/api/contracts')
                .set(auth(client.token))
                .send({ proposalId: 'nope' });
            expect(res.status).toBe(400);
        });
    });

    describe('Issue response shape', () => {
        it('returns assignee and createdBy on create, move and update in the same format', async () => {
            const issue = await createIssue({
                title: 'Shape check issue',
                assigneeId: freelancer.user.id,
            });
            issueId = issue.id;
            expect(issue.assignee.id).toBe(freelancer.user.id);
            expect(issue.createdBy.id).toBe(client.user.id);

            const moved = await request(app)
                .patch(`/api/issues/${issueId}/move`)
                .set(auth(freelancer.token))
                .send({ status: 'IN_PROGRESS', position: 500 });
            expect(moved.status).toBe(200);
            expect(moved.body.issue.assignee.id).toBe(freelancer.user.id);
            expect(moved.body.issue.createdBy.id).toBe(client.user.id);

            const updated = await request(app)
                .patch(`/api/issues/${issueId}`)
                .set(auth(freelancer.token))
                .send({ priority: 'LOW' });
            expect(updated.body.issue.assignee.id).toBe(freelancer.user.id);
            expect(updated.body.issue.createdBy.id).toBe(client.user.id);
        });

        it('lists issues with comments and without e-mail addresses', async () => {
            await request(app)
                .post(`/api/issues/${issueId}/comments`)
                .set(auth(freelancer.token))
                .send({ body: 'Working on it.' });

            const res = await request(app).get(`/api/contracts/${contract.id}/issues`).set(auth(client.token));
            const issue = res.body.issues.find((i) => i.id === issueId);

            expect(Array.isArray(issue.comments)).toBe(true);
            expect(issue.comments).toHaveLength(1);
            expect(issue.createdBy.email).toBeUndefined();
            expect(issue.assignee.email).toBeUndefined();
        });

        it('rejects an assignee that is not a UUID', async () => {
            const res = await request(app)
                .post(`/api/contracts/${contract.id}/issues`)
                .set(auth(client.token))
                .send({ title: 'Bad assignee', assigneeId: 'not-a-uuid' });
            expect(res.status).toBe(400);
        });

        it('rejects an empty comment', async () => {
            const res = await request(app)
                .post(`/api/issues/${issueId}/comments`)
                .set(auth(client.token))
                .send({ body: '   ' });
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/issues/:id', () => {
        it('forbids a non-participant', async () => {
            const res = await request(app).delete(`/api/issues/${issueId}`).set(auth(outsider.token));
            expect(res.status).toBe(403);
        });

        it('returns 404 for an unknown issue', async () => {
            const res = await request(app).delete(`/api/issues/${MISSING_ID}`).set(auth(client.token));
            expect(res.status).toBe(404);
        });

        it('is blocked while the contract is not active', async () => {
            await prisma.contract.update({ where: { id: contract.id }, data: { status: 'COMPLETED' } });

            const res = await request(app).delete(`/api/issues/${issueId}`).set(auth(client.token));
            expect(res.status).toBe(400);

            await prisma.contract.update({ where: { id: contract.id }, data: { status: 'ACTIVE' } });
        });

        it('lets a participant delete the issue together with its comments', async () => {
            const res = await request(app).delete(`/api/issues/${issueId}`).set(auth(freelancer.token));
            expect(res.status).toBe(200);

            expect(await prisma.issue.count({ where: { id: issueId } })).toBe(0);
            expect(await prisma.issueComment.count({ where: { issueId } })).toBe(0);

            const again = await request(app).delete(`/api/issues/${issueId}`).set(auth(freelancer.token));
            expect(again.status).toBe(404);
        });
    });

    describe('Cancelling a contract', () => {
        it('cancels the contract and the job, and then nothing else can be changed', async () => {
            const res = await request(app).patch(`/api/contracts/${contract.id}/cancel`).set(auth(client.token));
            expect(res.status).toBe(200);
            expect(res.body.contract.status).toBe('CANCELLED');

            const storedJob = await prisma.jobPost.findUnique({ where: { id: job.id } });
            expect(storedJob.status).toBe('CANCELLED');

            const cancelAgain = await request(app)
                .patch(`/api/contracts/${contract.id}/cancel`)
                .set(auth(client.token));
            expect(cancelAgain.status).toBe(400);

            const complete = await request(app)
                .patch(`/api/contracts/${contract.id}/complete`)
                .set(auth(client.token));
            expect(complete.status).toBe(400);

            const newIssue = await request(app)
                .post(`/api/contracts/${contract.id}/issues`)
                .set(auth(client.token))
                .send({ title: 'Issue on a cancelled contract' });
            expect(newIssue.status).toBe(400);
        });
    });
});
