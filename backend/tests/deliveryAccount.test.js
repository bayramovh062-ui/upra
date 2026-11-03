import request from 'supertest';
import {
    app,
    prisma,
    auth,
    cleanUpUsers,
    cleanUpUserIds,
    registerUser,
    createJob,
    createProposal,
    createContract,
} from './helpers/db.js';

const PASSWORD = 'Password123!';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Delivery flow, board rebalance, dashboard stats, public profile
// ---------------------------------------------------------------------------
describe('Delivery flow, dashboard stats and public profile', () => {
    const emails = ['da_client@upra.com', 'da_free@upra.com', 'da_other@upra.com'];
    let client, freelancer, other;
    let job1, contract1;

    const patchContract = (id, action, token) =>
        request(app).patch(`/api/contracts/${id}/${action}`).set(auth(token));

    beforeAll(async () => {
        await cleanUpUsers(emails);

        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'DA Client', role: 'CLIENT' });
        freelancer = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'DA Freelancer', role: 'FREELANCER' });
        other = await registerUser({ email: emails[2], password: PASSWORD, fullName: 'DA Other', role: 'FREELANCER' });

        job1 = await createJob(client.token, { title: 'Delivery flow test job' });
        const proposal = await createProposal(freelancer.token, job1.id);
        contract1 = await createContract(client.token, proposal.id);
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    describe('deliver / reopen', () => {
        it('forbids the client and outsiders from delivering', async () => {
            const byClient = await patchContract(contract1.id, 'deliver', client.token);
            expect(byClient.status).toBe(403);

            const byOutsider = await patchContract(contract1.id, 'deliver', other.token);
            expect(byOutsider.status).toBe(403);
        });

        it('returns 404 when delivering an unknown contract', async () => {
            const res = await patchContract(MISSING_ID, 'deliver', freelancer.token);
            expect(res.status).toBe(404);
        });

        it('lets the freelancer deliver an ACTIVE contract, but only once', async () => {
            const res = await patchContract(contract1.id, 'deliver', freelancer.token);
            expect(res.status).toBe(200);
            expect(res.body.contract.status).toBe('DELIVERED');

            const again = await patchContract(contract1.id, 'deliver', freelancer.token);
            expect(again.status).toBe(400);
        });

        it('makes the board read-only while the contract is DELIVERED, but still readable', async () => {
            const create = await request(app)
                .post(`/api/contracts/${contract1.id}/issues`)
                .set(auth(client.token))
                .send({ title: 'Issue while delivered' });
            expect(create.status).toBe(400);

            const list = await request(app).get(`/api/contracts/${contract1.id}/issues`).set(auth(freelancer.token));
            expect(list.status).toBe(200);
        });

        it('lets only the client request changes, and only on a DELIVERED contract', async () => {
            const byFreelancer = await patchContract(contract1.id, 'reopen', freelancer.token);
            expect(byFreelancer.status).toBe(403);

            const byClient = await patchContract(contract1.id, 'reopen', client.token);
            expect(byClient.status).toBe(200);
            expect(byClient.body.contract.status).toBe('ACTIVE');

            const again = await patchContract(contract1.id, 'reopen', client.token);
            expect(again.status).toBe(400);
        });
    });

    describe('board position rebalance', () => {
        it('renumbers the column when a card is dropped too close to its neighbour', async () => {
            const make = async (title) => {
                const res = await request(app)
                    .post(`/api/contracts/${contract1.id}/issues`)
                    .set(auth(client.token))
                    .send({ title });
                expect(res.status).toBe(201);
                return res.body.issue;
            };

            const a = await make('Rebalance card A'); // position 1000
            const b = await make('Rebalance card B'); // position 2000
            expect(a.position).toBe(1000);
            expect(b.position).toBe(2000);

            // B-ni A-dan 0.0005 sonraya qoyuruq: fərq 0.001-dən kiçikdir
            const moved = await request(app)
                .patch(`/api/issues/${b.id}/move`)
                .set(auth(client.token))
                .send({ status: 'TODO', position: a.position + 0.0005 });

            expect(moved.status).toBe(200);
            expect(moved.body.rebalanced).toBe(true);
            expect(moved.body.issue.position).toBe(2000);

            const list = await request(app).get(`/api/contracts/${contract1.id}/issues`).set(auth(client.token));
            const todo = list.body.issues.filter((i) => i.status === 'TODO').map((i) => i.position);
            expect(todo).toEqual([1000, 2000]);
        });

        it('does not renumber when cards are far enough apart', async () => {
            const list = await request(app).get(`/api/contracts/${contract1.id}/issues`).set(auth(client.token));
            const first = list.body.issues.find((i) => i.title === 'Rebalance card A');

            const moved = await request(app)
                .patch(`/api/issues/${first.id}/move`)
                .set(auth(client.token))
                .send({ status: 'IN_PROGRESS', position: 500 });

            expect(moved.status).toBe(200);
            expect(moved.body.rebalanced).toBe(false);
        });
    });

    describe('finishing a delivered contract', () => {
        it('lets the client complete a DELIVERED contract and marks the job COMPLETED', async () => {
            await patchContract(contract1.id, 'deliver', freelancer.token);

            const res = await patchContract(contract1.id, 'complete', client.token);
            expect(res.status).toBe(200);
            expect(res.body.contract.status).toBe('COMPLETED');

            const job = await prisma.jobPost.findUnique({ where: { id: job1.id } });
            expect(job.status).toBe('COMPLETED');

            const late = await patchContract(contract1.id, 'deliver', freelancer.token);
            expect(late.status).toBe(400);
        });

        it('does not let either party cancel a DELIVERED contract alone, only by agreement', async () => {
            const job = await createJob(client.token, { title: 'Delivered then cancelled job' });
            const proposal = await createProposal(freelancer.token, job.id);
            const contract = await createContract(client.token, proposal.id);

            await patchContract(contract.id, 'deliver', freelancer.token);

            // Təhvil verilib = iş başlayıb: tək ləğv olmur
            const direct = await patchContract(contract.id, 'cancel', client.token);
            expect(direct.status).toBe(400);

            const asked = await patchContract(contract.id, 'cancel-request', client.token);
            expect(asked.status).toBe(200);
            expect(asked.body.contract.cancelRequestedById).toBe(client.user.id);

            const res = await patchContract(contract.id, 'cancel-request/accept', freelancer.token);
            expect(res.status).toBe(200);
            expect(res.body.contract.status).toBe('CANCELLED');
            const stored = await prisma.jobPost.findUnique({ where: { id: job.id } });
            expect(stored.status).toBe('CANCELLED');
        });
    });

    describe('GET /api/dashboard/stats', () => {
        beforeAll(async () => {
            // Client üçün: 1 açıq iş və onda 1 gözləyən təklif
            const openJob = await createJob(client.token, { title: 'Open job for stats' });
            await createProposal(other.token, openJob.id);
        });

        it('requires authentication', async () => {
            const res = await request(app).get('/api/dashboard/stats');
            expect(res.status).toBe(401);
        });

        it('returns client numbers', async () => {
            const res = await request(app).get('/api/dashboard/stats').set(auth(client.token));
            expect(res.status).toBe(200);
            expect(res.body.stats).toEqual({
                openJobs: 1,
                proposalsToReview: 1,
                activeContracts: 0,
                completedContracts: 1,
            });
        });

        it('returns freelancer numbers', async () => {
            const res = await request(app).get('/api/dashboard/stats').set(auth(freelancer.token));
            expect(res.status).toBe(200);
            expect(res.body.stats).toEqual({
                activeContracts: 0,
                pendingProposals: 0,
                acceptedProposals: 2,
                completedContracts: 1,
            });

            const pending = await request(app).get('/api/dashboard/stats').set(auth(other.token));
            expect(pending.body.stats.pendingProposals).toBe(1);
        });
    });

    describe('GET /api/users/:id', () => {
        it('requires authentication', async () => {
            const res = await request(app).get(`/api/users/${freelancer.user.id}`);
            expect(res.status).toBe(401);
        });

        it('returns a public freelancer profile without private fields', async () => {
            const res = await request(app).get(`/api/users/${freelancer.user.id}`).set(auth(client.token));

            expect(res.status).toBe(200);
            expect(res.body.user.fullName).toBe('DA Freelancer');
            expect(res.body.user.role).toBe('FREELANCER');
            expect(res.body.user.email).toBeUndefined();
            expect(res.body.user.passwordHash).toBeUndefined();
            expect(res.body.user.deletedAt).toBeUndefined();
            expect(res.body.stats.completedContracts).toBe(1);
            expect(res.body.stats.jobsPosted).toBeNull();
        });

        it('returns the number of posted jobs for a client', async () => {
            const res = await request(app).get(`/api/users/${client.user.id}`).set(auth(freelancer.token));

            expect(res.status).toBe(200);
            expect(res.body.stats.jobsPosted).toBe(3);
            expect(res.body.stats.completedContracts).toBe(1);
        });

        it('returns 404 for an unknown id', async () => {
            const res = await request(app).get(`/api/users/${MISSING_ID}`).set(auth(client.token));
            expect(res.status).toBe(404);
        });
    });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/me (soft delete)
// Silinmiş hesabın e-poçtu dəyişir, ona görə təmizlik id ilə edilir.
// ---------------------------------------------------------------------------
describe('DELETE /api/auth/me', () => {
    const emails = {
        delClient: 'da_del_client@upra.com',
        delFree: 'da_del_free@upra.com',
        rejFree: 'da_rej_free@upra.com',
        busyClient: 'da_busy_client@upra.com',
        busyFree: 'da_busy_free@upra.com',
    };
    const ids = [];
    let delClient, delFree, rejFree, busyClient, busyFree;
    let jobX, jobZ, busyContract;

    const register = async (email, fullName, role) => {
        const u = await registerUser({ email, password: PASSWORD, fullName, role });
        ids.push(u.user.id);
        return u;
    };

    const del = (token, body) => request(app).delete('/api/auth/me').set(auth(token)).send(body);

    beforeAll(async () => {
        await cleanUpUsers(Object.values(emails));

        delClient = await register(emails.delClient, 'Del Client', 'CLIENT');
        delFree = await register(emails.delFree, 'Del Freelancer', 'FREELANCER');
        rejFree = await register(emails.rejFree, 'Rej Freelancer', 'FREELANCER');
        busyClient = await register(emails.busyClient, 'Busy Client', 'CLIENT');
        busyFree = await register(emails.busyFree, 'Busy Freelancer', 'FREELANCER');

        // delClient-in açıq işi X: iki gözləyən təklif (delFree, rejFree)
        jobX = await createJob(delClient.token, { title: 'Job X of the deleted client' });
        await createProposal(delFree.token, jobX.id);
        await createProposal(rejFree.token, jobX.id);

        // busyClient: Y işində aktiv müqavilə, Z işi açıq (delFree-nin gözləyən təklifi var)
        const jobY = await createJob(busyClient.token, { title: 'Job Y with active contract' });
        jobZ = await createJob(busyClient.token, { title: 'Job Z still open' });
        await createProposal(delFree.token, jobZ.id);
        const proposalY = await createProposal(busyFree.token, jobY.id);
        busyContract = await createContract(busyClient.token, proposalY.id);
    });

    afterAll(async () => {
        await cleanUpUserIds(ids);
        await prisma.$disconnect();
    });

    it('requires authentication', async () => {
        const res = await request(app).delete('/api/auth/me').send({ password: PASSWORD });
        expect(res.status).toBe(401);
    });

    it('requires the password in the body', async () => {
        const res = await del(delClient.token, {});
        expect(res.status).toBe(400);
    });

    it('rejects a wrong password with 400 (not 401) and keeps the account', async () => {
        const res = await del(delClient.token, { password: 'WrongPassword1!' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/incorrect/i);

        const me = await request(app).get('/api/auth/me').set(auth(delClient.token));
        expect(me.status).toBe(200);
    });

    it('is blocked while the user has an ACTIVE contract', async () => {
        const res = await del(busyClient.token, { password: PASSWORD });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/active contracts/i);

        const me = await request(app).get('/api/auth/me').set(auth(busyClient.token));
        expect(me.status).toBe(200);
    });

    it('is also blocked while the contract is DELIVERED', async () => {
        const deliver = await request(app)
            .patch(`/api/contracts/${busyContract.id}/deliver`)
            .set(auth(busyFree.token));
        expect(deliver.status).toBe(200);

        const res = await del(busyFree.token, { password: PASSWORD });
        expect(res.status).toBe(400);
    });

    it('anonymizes a client, cancels open jobs, rejects pending proposals and frees the e-mail', async () => {
        const res = await del(delClient.token, { password: PASSWORD });
        expect(res.status).toBe(200);

        const stored = await prisma.user.findUnique({ where: { id: delClient.user.id } });
        expect(stored.deletedAt).not.toBeNull();
        expect(stored.fullName).toBe('Deleted user');
        expect(stored.email).toMatch(/@deleted\.upra\.local$/);

        const me = await request(app).get('/api/auth/me').set(auth(delClient.token));
        expect(me.status).toBe(401);

        const login = await request(app).post('/api/auth/login').send({ email: emails.delClient, password: PASSWORD });
        expect(login.status).toBe(401);

        const job = await prisma.jobPost.findUnique({ where: { id: jobX.id } });
        expect(job.status).toBe('CANCELLED');

        const proposals = await prisma.proposal.findMany({ where: { jobPostId: jobX.id } });
        expect(proposals).toHaveLength(2);
        proposals.forEach((p) => expect(p.status).toBe('REJECTED'));

        // Eyni e-poçtla yenidən qeydiyyat mümkündür
        const again = await register(emails.delClient, 'Del Client Again', 'CLIENT');
        expect(again.user.email).toBe(emails.delClient);
    });

    it('withdraws the pending proposals of a deleted freelancer', async () => {
        const res = await del(delFree.token, { password: PASSWORD });
        expect(res.status).toBe(200);

        const pending = await prisma.proposal.count({
            where: { freelancerId: delFree.user.id, status: 'PENDING' },
        });
        expect(pending).toBe(0);

        const onJobZ = await prisma.proposal.count({
            where: { jobPostId: jobZ.id, freelancerId: delFree.user.id },
        });
        expect(onJobZ).toBe(0);
    });

    it('keeps the contract history after a party deletes their account', async () => {
        const complete = await request(app)
            .patch(`/api/contracts/${busyContract.id}/complete`)
            .set(auth(busyClient.token));
        expect(complete.status).toBe(200);

        const res = await del(busyFree.token, { password: PASSWORD });
        expect(res.status).toBe(200);

        const stored = await prisma.contract.findUnique({ where: { id: busyContract.id } });
        expect(stored).not.toBeNull();
        expect(stored.status).toBe('COMPLETED');

        const view = await request(app).get(`/api/contracts/${busyContract.id}`).set(auth(busyClient.token));
        expect(view.status).toBe(200);
        expect(view.body.contract.freelancer.fullName).toBe('Deleted user');
    });

    it('returns 404 for the public profile of a deleted user', async () => {
        const res = await request(app).get(`/api/users/${busyFree.user.id}`).set(auth(busyClient.token));
        expect(res.status).toBe(404);
    });
});
