import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Issue & Kanban Board Integration Tests', () => {
    let clientToken, freelancerToken, outsiderToken;
    let freelancerId;
    let jobPostId, contractId, issueId;

    const clientUser = {
        email: 'issue_client@upra.com',
        password: 'Password123!',
        fullName: 'Issue Client',
        role: 'CLIENT',
    };

    const freelancerUser = {
        email: 'issue_free@upra.com',
        password: 'Password123!',
        fullName: 'Issue Freelancer',
        role: 'FREELANCER',
    };

    const outsiderUser = {
        email: 'issue_outsider@upra.com',
        password: 'Password123!',
        fullName: 'Outsider User',
        role: 'FREELANCER',
    };

    beforeAll(async () => {
        await prisma.user.deleteMany({
            where: {
                email: {
                    in: [clientUser.email, freelancerUser.email, outsiderUser.email],
                },
            },
        });

        const cRes = await request(app).post('/api/auth/register').send(clientUser);
        clientToken = cRes.body.token;

        const fRes = await request(app).post('/api/auth/register').send(freelancerUser);
        freelancerToken = fRes.body.token;
        freelancerId = fRes.body.user.id;

        const oRes = await request(app).post('/api/auth/register').send(outsiderUser);
        outsiderToken = oRes.body.token;

        const jobRes = await request(app)
            .post('/api/jobs')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                title: 'Kanban Board System Implementation',
                description: 'Building issue tracking system for ongoing contracts with full tests.',
                budget: 1500,
            });

        jobPostId = jobRes.body.job.id;

        const propRes = await request(app)
            .post('/api/proposals')
            .set('Authorization', `Bearer ${freelancerToken}`)
            .send({
                jobPostId,
                coverLetter: 'I am an expert in building Kanban boards and issue trackers.',
                bidAmount: 1400,
            });

        const contractRes = await request(app)
            .post('/api/contracts')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
                proposalId: propRes.body.proposal.id,
            });

        contractId = contractRes.body.contract.id;
    });

    afterAll(async () => {
        // Düzgün təmizlik sırası (FK zəncirinə uyğun)
        if (contractId) {
            const board = await prisma.board.findUnique({ where: { contractId } });
            if (board) {
                await prisma.issueComment.deleteMany({
                    where: { issue: { boardId: board.id } },
                });
                await prisma.issue.deleteMany({ where: { boardId: board.id } });
                await prisma.board.delete({ where: { id: board.id } });
            }
            await prisma.contract.deleteMany({ where: { id: contractId } });
        }

        if (jobPostId) {
            await prisma.proposal.deleteMany({ where: { jobPostId } });
            await prisma.jobPost.deleteMany({ where: { id: jobPostId } });
        }

        await prisma.user.deleteMany({
            where: {
                email: {
                    in: [clientUser.email, freelancerUser.email, outsiderUser.email],
                },
            },
        });
        await prisma.$disconnect();
    });

    describe('POST /api/contracts/:contractId/issues', () => {
        it('should allow contract participant to create an issue', async () => {
            const res = await request(app)
                .post(`/api/contracts/${contractId}/issues`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({
                    title: 'Setup Database Migrations',
                    description: 'Create initial database schema for users and jobs.',
                    priority: 'HIGH',
                    assigneeId: freelancerId,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.issue.title).toBe('Setup Database Migrations');
            expect(res.body.issue.status).toBe('TODO');
            expect(res.body.issue.position).toBe(1000);

            issueId = res.body.issue.id;
        });

        it('should forbid non-participants from creating issues', async () => {
            const res = await request(app)
                .post(`/api/contracts/${contractId}/issues`)
                .set('Authorization', `Bearer ${outsiderToken}`)
                .send({
                    title: 'Unauthorized Issue Attempt',
                });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/contracts/:contractId/issues', () => {
        it('should retrieve all board issues for contract participants', async () => {
            const res = await request(app)
                .get(`/api/contracts/${contractId}/issues`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.issues.length).toBeGreaterThan(0);
        });
    });

    describe('PATCH /api/issues/:id', () => {
        it('should allow participant to update issue details', async () => {
            const res = await request(app)
                .patch(`/api/issues/${issueId}`)
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({
                    description: 'Updated description for database migrations task.',
                    priority: 'HIGH',
                });

            expect(res.status).toBe(200);
            expect(res.body.issue.description).toBe('Updated description for database migrations task.');
        });
    });

    describe('PATCH /api/issues/:id/move', () => {
        it('should move issue to a new status and position on the board', async () => {
            const res = await request(app)
                .patch(`/api/issues/${issueId}/move`)
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({
                    status: 'IN_PROGRESS',
                    position: 1500,
                });

            expect(res.status).toBe(200);
            expect(res.body.issue.status).toBe('IN_PROGRESS');
            expect(res.body.issue.position).toBe(1500);
        });
    });

    describe('POST /api/issues/:id/comments', () => {
        it('should add a comment to an issue', async () => {
            const res = await request(app)
                .post(`/api/issues/${issueId}/comments`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({
                    body: 'Please review the schema changes before pushing to main.',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.comment.body).toBe('Please review the schema changes before pushing to main.');
        });
    });
});