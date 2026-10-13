import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Contract Module Integration Tests', () => {
    let clientToken, freelancer1Token, freelancer2Token;
    let jobPostId, proposal1Id, proposal2Id, contractId;

    const clientUser = {
        email: 'contract_client@upra.com',
        password: 'Password123!',
        fullName: 'Contract Client',
        role: 'CLIENT',
    };

    const freelancer1User = {
        email: 'contract_free1@upra.com',
        password: 'Password123!',
        fullName: 'Freelancer One',
        role: 'FREELANCER',
    };

    const freelancer2User = {
        email: 'contract_free2@upra.com',
        password: 'Password123!',
        fullName: 'Freelancer Two',
        role: 'FREELANCER',
    };

    beforeAll(async () => {
        await prisma.user.deleteMany({
            where: {
                email: {
                    in: [clientUser.email, freelancer1User.email, freelancer2User.email],
                },
            },
        });

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
                title: 'Backend Node.js API Contract Test Job',
                description: 'Building secure contract management system with Prisma transactions.',
                budget: 2000,
            });
        jobPostId = jobRes.body.job.id;

        const p1Res = await request(app)
            .post('/api/proposals')
            .set('Authorization', `Bearer ${freelancer1Token}`)
            .send({
                jobPostId,
                coverLetter: 'I am ready to build this contract module efficiently.',
                bidAmount: 1900,
            });
        proposal1Id = p1Res.body.proposal.id;

        const p2Res = await request(app)
            .post('/api/proposals')
            .set('Authorization', `Bearer ${freelancer2Token}`)
            .send({
                jobPostId,
                coverLetter: 'I can complete this project quickly with high quality.',
                bidAmount: 1800,
            });
        proposal2Id = p2Res.body.proposal.id;
    });

    afterAll(async () => {
        if (jobPostId) {
            await prisma.contract.deleteMany({ where: { jobPostId } });
            await prisma.proposal.deleteMany({ where: { jobPostId } });
            await prisma.jobPost.deleteMany({ where: { id: jobPostId } });
        }
        await prisma.user.deleteMany({
            where: {
                email: {
                    in: [clientUser.email, freelancer1User.email, freelancer2User.email],
                },
            },
        });
        await prisma.$disconnect();
    });

    describe('POST /api/contracts (Transaction Check)', () => {
        it('should allow CLIENT to create contract and execute transaction updates', async () => {
            const res = await request(app)
                .post('/api/contracts')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({
                    proposalId: proposal1Id,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.contract.status).toBe('ACTIVE');

            contractId = res.body.contract.id;

            // Tranzaksiyanın nəticələrini yoxlayırıq:
            const p1 = await prisma.proposal.findUnique({ where: { id: proposal1Id } });
            expect(p1.status).toBe('ACCEPTED');

            const p2 = await prisma.proposal.findUnique({ where: { id: proposal2Id } });
            expect(p2.status).toBe('REJECTED');

            const job = await prisma.jobPost.findUnique({ where: { id: jobPostId } });
            expect(job.status).toBe('IN_PROGRESS');
        });

        it('should forbid FREELANCER from creating a contract', async () => {
            const res = await request(app)
                .post('/api/contracts')
                .set('Authorization', `Bearer ${freelancer1Token}`)
                .send({
                    proposalId: proposal2Id,
                });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/contracts/my', () => {
        it('should return active contracts for client', async () => {
            const res = await request(app)
                .get('/api/contracts/my')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.contracts.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/contracts/:id', () => {
        it('should return contract details for participants', async () => {
            const res = await request(app)
                .get(`/api/contracts/${contractId}`)
                .set('Authorization', `Bearer ${freelancer1Token}`);

            expect(res.status).toBe(200);
            expect(res.body.contract.id).toBe(contractId);
        });
    });

    describe('PATCH /api/contracts/:id/complete', () => {
        it('should complete the contract and mark job as COMPLETED', async () => {
            const res = await request(app)
                .patch(`/api/contracts/${contractId}/complete`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(200);
            expect(res.body.contract.status).toBe('COMPLETED');

            const job = await prisma.jobPost.findUnique({ where: { id: jobPostId } });
            expect(job.status).toBe('COMPLETED');
        });
    });
});