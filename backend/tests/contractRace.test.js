import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Contract race condition (two proposals accepted at the same time)', () => {
    let clientToken, freelancer1Token, freelancer2Token;
    let jobPostId, proposal1Id, proposal2Id;

    const clientUser = {
        email: 'race_client@upra.com',
        password: 'Password123!',
        fullName: 'Race Client',
        role: 'CLIENT',
    };
    const freelancer1User = {
        email: 'race_free1@upra.com',
        password: 'Password123!',
        fullName: 'Race Freelancer One',
        role: 'FREELANCER',
    };
    const freelancer2User = {
        email: 'race_free2@upra.com',
        password: 'Password123!',
        fullName: 'Race Freelancer Two',
        role: 'FREELANCER',
    };

    const testEmails = [clientUser.email, freelancer1User.email, freelancer2User.email];

    const cleanUp = async () => {
        const users = await prisma.user.findMany({
            where: { email: { in: testEmails } },
            select: { id: true },
        });

        if (users.length === 0) return;

        const userIds = users.map((u) => u.id);

        await prisma.board.deleteMany({
            where: {
                contract: {
                    OR: [{ clientId: { in: userIds } }, { freelancerId: { in: userIds } }],
                },
            },
        });
        await prisma.contract.deleteMany({
            where: {
                OR: [{ clientId: { in: userIds } }, { freelancerId: { in: userIds } }],
            },
        });
        await prisma.proposal.deleteMany({
            where: {
                OR: [{ freelancerId: { in: userIds } }, { jobPost: { clientId: { in: userIds } } }],
            },
        });
        await prisma.jobPost.deleteMany({ where: { clientId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    };

    beforeAll(async () => {
        await cleanUp();

        const cRes = await request(app).post('/api/auth/register').send(clientUser);
        clientToken = cRes.body.token;

        const f1Res = await request(app).post('/api/auth/register').send(freelancer1User);
        freelancer1Token = f1Res.body.token;

        const f2Res = await request(app).post('/api/auth/register').send(freelancer2User);
        freelancer2Token = f2Res.body.token;

        const jobRes = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                title: 'Race Condition Test Job',
                description: 'Two proposals will be accepted at the very same moment.',
                budget: 1000,
            });
        jobPostId = jobRes.body.job.id;

        const p1Res = await request(app)
            .post('/api/proposals')
            .set('Authorization', `Bearer ${freelancer1Token}`)
            .send({
                jobPostId,
                coverLetter: 'First freelancer proposal for the race condition test.',
                bidAmount: 900,
            });
        proposal1Id = p1Res.body.proposal.id;

        const p2Res = await request(app)
            .post('/api/proposals')
            .set('Authorization', `Bearer ${freelancer2Token}`)
            .send({
                jobPostId,
                coverLetter: 'Second freelancer proposal for the race condition test.',
                bidAmount: 800,
            });
        proposal2Id = p2Res.body.proposal.id;
    });

    afterAll(async () => {
        await cleanUp();
        await prisma.$disconnect();
    });

    it('should create exactly one contract when two proposals are accepted simultaneously', async () => {
        const [resA, resB] = await Promise.all([
            request(app)
                .post('/api/contracts')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ proposalId: proposal1Id }),
            request(app)
                .post('/api/contracts')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ proposalId: proposal2Id }),
        ]);

        const statuses = [resA.statusCode, resB.statusCode].sort();
        expect(statuses).toEqual([201, 400]);

        const contractCount = await prisma.contract.count({ where: { jobPostId } });
        expect(contractCount).toBe(1);

        const job = await prisma.jobPost.findUnique({ where: { id: jobPostId } });
        expect(job.status).toBe('IN_PROGRESS');
    });
});
