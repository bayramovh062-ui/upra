import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Issue & Kanban Board Integration Tests', () => {
    let clientToken, freelancerToken, outsiderToken;
    let freelancerId;
    let contractId, issueId;

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

    const randomUserEmail = 'random@example.com';
    const testEmails = [clientUser.email, freelancerUser.email, outsiderUser.email, randomUserEmail];

    // Baza təmizlik funksiyası (FK zəncirinə uyğun ardıcıllıq)
    const cleanUp = async () => {
        const users = await prisma.user.findMany({
            where: { email: { in: testEmails } },
            select: { id: true },
        });

        if (users.length === 0) return;

        const userIds = users.map((u) => u.id);

        await prisma.issueComment.deleteMany({
            where: { authorId: { in: userIds } },
        });

        await prisma.issue.deleteMany({
            where: {
                OR: [{ createdById: { in: userIds } }, { assigneeId: { in: userIds } }],
            },
        });

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

        await prisma.jobPost.deleteMany({
            where: { clientId: { in: userIds } },
        });

        await prisma.user.deleteMany({
            where: { id: { in: userIds } },
        });
    };

    beforeAll(async () => {
        await cleanUp();

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

        const propRes = await request(app)
            .post('/api/proposals')
            .set('Authorization', `Bearer ${freelancerToken}`)
            .send({
                jobPostId: jobRes.body.job.id,
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
        await cleanUp();
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

    describe('Issue Security & Validation Edge Cases', () => {
        it('should return 400 when assignee is not a participant of the contract', async () => {
            const randomUser = await prisma.user.create({
                data: {
                    email: randomUserEmail,
                    fullName: 'Random User',
                    passwordHash: 'hashedpassword',
                    role: 'FREELANCER',
                },
            });

            const res = await request(app)
                .post(`/api/contracts/${contractId}/issues`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({
                    title: 'Task for outsider',
                    assigneeId: randomUser.id,
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/must be a participant/i);
        });

        it('should return 400 when attempting to create, update, or move issue on an inactive contract', async () => {
            await prisma.contract.update({
                where: { id: contractId },
                data: { status: 'COMPLETED' },
            });

            const createRes = await request(app)
                .post(`/api/contracts/${contractId}/issues`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'New Task on Closed Contract' });

            expect(createRes.statusCode).toBe(400);

            const moveRes = await request(app)
                .patch(`/api/issues/${issueId}/move`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ status: 'DONE', position: 2000 });

            expect(moveRes.statusCode).toBe(400);
        });

        it('should return 400 when moveIssue receives invalid status or negative position', async () => {
            await prisma.contract.update({
                where: { id: contractId },
                data: { status: 'ACTIVE' },
            });

            const invalidStatusRes = await request(app)
                .patch(`/api/issues/${issueId}/move`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ status: 'INVALID_STATUS', position: 1000 });

            expect(invalidStatusRes.statusCode).toBe(400);

            const negativePositionRes = await request(app)
                .patch(`/api/issues/${issueId}/move`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ status: 'IN_PROGRESS', position: -5 });

            expect(negativePositionRes.statusCode).toBe(400);
        });

        it('should accept a fractional position (card dropped between two cards)', async () => {
            const res = await request(app)
                .patch(`/api/issues/${issueId}/move`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ status: 'IN_PROGRESS', position: 1500.5 });

            expect(res.statusCode).toBe(200);
            expect(res.body.issue.position).toBe(1500.5);
        });

        it('should ignore protected fields (boardId, status) sent to PATCH /api/issues/:id', async () => {
            const res = await request(app)
                .patch(`/api/issues/${issueId}`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'Renamed Task', status: 'DONE', boardId: 'hacked' });

            expect(res.statusCode).toBe(200);
            expect(res.body.issue.title).toBe('Renamed Task');
            expect(res.body.issue.status).toBe('IN_PROGRESS');
        });
    });
});