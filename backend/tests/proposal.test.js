import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Proposal Module Integration Tests', () => {
    let clientToken, freelancerToken, otherClientToken;
    let clientId, freelancerId;
    let jobPostId;
    let proposalId;

    const clientUser = {
        email: 'prop_client@upra.com',
        password: 'Password123!',
        fullName: 'Proposal Client',
        role: 'CLIENT',
    };

    const otherClientUser = {
        email: 'prop_other_client@upra.com',
        password: 'Password123!',
        fullName: 'Other Proposal Client',
        role: 'CLIENT',
    };

    const freelancerUser = {
        email: 'prop_freelancer@upra.com',
        password: 'Password123!',
        fullName: 'Proposal Freelancer',
        role: 'FREELANCER',
    };

    beforeAll(async () => {
        await prisma.user.deleteMany({
            where: {
                email: {
                    in: [clientUser.email, otherClientUser.email, freelancerUser.email],
                },
            },
        });

        // Client qeydiyyatı
        const clientRes = await request(app).post('/api/auth/register').send(clientUser);
        clientToken = clientRes.body.token;
        clientId = clientRes.body.user.id;

        // Digər Client qeydiyyatı
        const otherClientRes = await request(app).post('/api/auth/register').send(otherClientUser);
        otherClientToken = otherClientRes.body.token;

        // Freelancer qeydiyyatı
        const freelancerRes = await request(app).post('/api/auth/register').send(freelancerUser);
        freelancerToken = freelancerRes.body.token;
        freelancerId = freelancerRes.body.user.id;

        // Client tərəfindən test üçün JobPost yaradılır
        const jobRes = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                title: 'Fullstack Next.js & Node.js Developer',
                description: 'Looking for an experienced engineer to build marketplace modules.',
                budget: 1200,
            });

        jobPostId = jobRes.body.job.id;
    });

    afterAll(async () => {
        // Məlumatların təmizlənməsi
        await prisma.proposal.deleteMany({ where: { freelancerId } });
        await prisma.jobPost.deleteMany({ where: { clientId } });
        await prisma.user.deleteMany({
            where: {
                email: {
                    in: [clientUser.email, otherClientUser.email, freelancerUser.email],
                },
            },
        });
        await prisma.$disconnect();
    });

    describe('POST /api/proposals', () => {
        it('should allow FREELANCER to submit a proposal', async () => {
            const res = await request(app)
                .post('/api/proposals')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({
                    jobPostId,
                    coverLetter: 'I am very interested in this job and have relevant experience with Node.js.',
                    bidAmount: 1100,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.proposal.jobPostId).toBe(jobPostId);
            expect(Number(res.body.proposal.bidAmount)).toBe(1100);

            proposalId = res.body.proposal.id;
        });

        it('should prevent duplicate proposals for the same job', async () => {
            const res = await request(app)
                .post('/api/proposals')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({
                    jobPostId,
                    coverLetter: 'Attempting to send a second proposal for the same job post.',
                    bidAmount: 1000,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should forbid CLIENT from submitting a proposal', async () => {
            const res = await request(app)
                .post('/api/proposals')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({
                    jobPostId,
                    coverLetter: 'Clients should not be able to submit proposals.',
                    bidAmount: 500,
                });

            expect(res.status).toBe(403);
        });

        it('should return 400 when validation fails', async () => {
            const res = await request(app)
                .post('/api/proposals')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({
                    jobPostId,
                    coverLetter: 'Short',
                    bidAmount: -50,
                });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/proposals/my', () => {
        it('should return all proposals submitted by logged-in freelancer', async () => {
            const res = await request(app)
                .get('/api/proposals/my')
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.proposals.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/proposals/job/:jobId', () => {
        it('should allow job owner CLIENT to view job proposals', async () => {
            const res = await request(app)
                .get(`/api/proposals/job/${jobPostId}`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.proposals.length).toBeGreaterThan(0);
        });

        it('should forbid non-owner CLIENT from viewing proposals', async () => {
            const res = await request(app)
                .get(`/api/proposals/job/${jobPostId}`)
                .set('Authorization', `Bearer ${otherClientToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/proposals/:id', () => {
        it('should return proposal details for owner freelancer', async () => {
            const res = await request(app)
                .get(`/api/proposals/${proposalId}`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.proposal.id).toBe(proposalId);
        });
    });

    describe('PATCH /api/proposals/:id', () => {
        it('should allow freelancer to update proposal details', async () => {
            const res = await request(app)
                .patch(`/api/proposals/${proposalId}`)
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({
                    bidAmount: 1150,
                });

            expect(res.status).toBe(200);
            expect(Number(res.body.proposal.bidAmount)).toBe(1150);
        });
    });

    describe('DELETE /api/proposals/:id', () => {
        it('should allow freelancer to withdraw (delete) proposal', async () => {
            const res = await request(app)
                .delete(`/api/proposals/${proposalId}`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});