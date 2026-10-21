import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('Jobs Module Integration Tests', () => {
    let clientToken;
    let freelancerToken;
    let clientId;
    let createdJobId;

    const clientUser = {
        email: 'job_client_test@upra.com',
        password: 'Password123!',
        fullName: 'Client Test User',
        role: 'CLIENT',
    };

    const freelancerUser = {
        email: 'job_freelancer_test@upra.com',
        password: 'Password123!',
        fullName: 'Freelancer Test User',
        role: 'FREELANCER',
    };

    const otherClientEmail = 'otherclient@example.com';
    const testEmails = [clientUser.email, freelancerUser.email, otherClientEmail];

    const cleanUp = async () => {
        const users = await prisma.user.findMany({
            where: { email: { in: testEmails } },
            select: { id: true },
        });

        if (users.length === 0) return;

        const userIds = users.map((u) => u.id);

        await prisma.jobPost.deleteMany({
            where: { clientId: { in: userIds } },
        });

        await prisma.user.deleteMany({
            where: { id: { in: userIds } },
        });
    };

    beforeAll(async () => {
        await cleanUp();

        const clientRes = await request(app).post('/api/auth/register').send(clientUser);
        clientToken = clientRes.body.token;
        clientId = clientRes.body.user.id;

        const freelancerRes = await request(app).post('/api/auth/register').send(freelancerUser);
        freelancerToken = freelancerRes.body.token;
    });

    afterAll(async () => {
        await cleanUp();
        await prisma.$disconnect();
    });

    describe('POST /api/jobs', () => {
        it('should create a job post successfully when role is CLIENT', async () => {
            const jobData = {
                title: 'Need Node.js Developer for Marketplace',
                description: 'Building a production-grade backend with Express, Prisma, and Zod validation.',
                budget: 500,
            };

            const res = await request(app)
                .post('/api/jobs')
                .set('Authorization', `Bearer ${clientToken}`)
                .send(jobData);

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.job.title).toBe(jobData.title);
            expect(Number(res.body.job.budget)).toBe(500);

            createdJobId = res.body.job.id;
        });

        it('should return 403 Forbidden if role is FREELANCER', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({
                    title: 'Freelancer Job Attempt',
                    description: 'Freelancers should not be able to create job posts.',
                    budget: 200,
                });

            expect(res.status).toBe(403);
        });

        it('should return 400 Bad Request if validation fails', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({
                    title: 'Short',
                    description: 'Too short',
                    budget: -100,
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('GET /api/jobs', () => {
        it('should retrieve list of open jobs with pagination metadata', async () => {
            const res = await request(app).get('/api/jobs?page=1&limit=5');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.jobs)).toBe(true);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.page).toBe(1);
        });
    });

    describe('GET /api/jobs/my', () => {
        it('should return jobs created by the logged-in client', async () => {
            const res = await request(app)
                .get('/api/jobs/my')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.jobs.length).toBeGreaterThan(0);
        });
    });

    describe('PATCH /api/jobs/:id', () => {
        it('should update an existing job when user is the owner', async () => {
            const res = await request(app)
                .patch(`/api/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ budget: 650 });

            expect(res.status).toBe(200);
            expect(Number(res.body.job.budget)).toBe(650);
        });
    });

    describe('DELETE /api/jobs/:id', () => {
        it('should mark job as CANCELLED', async () => {
            const res = await request(app)
                .delete(`/api/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Job Post Edge Cases & Authorization', () => {
        it('should return 403 when another client attempts to update or delete a job', async () => {
            const otherClientRes = await request(app)
                .post('/api/auth/register')
                .send({
                    fullName: 'Other Client',
                    email: otherClientEmail,
                    password: 'Password123!',
                    role: 'CLIENT',
                });

            const otherClientToken = otherClientRes.body.token;

            const updateRes = await request(app)
                .patch(`/api/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${otherClientToken}`)
                .send({ title: 'Hacked Title' });

            expect(updateRes.statusCode).toBe(403);

            const deleteRes = await request(app)
                .delete(`/api/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${otherClientToken}`);

            expect(deleteRes.statusCode).toBe(403);
        });

        it('should return 400 when attempting to update a job that is not OPEN', async () => {
            await prisma.jobPost.update({
                where: { id: createdJobId },
                data: { status: 'IN_PROGRESS' },
            });

            const res = await request(app)
                .patch(`/api/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'New Title' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/open status/i);
        });

        it('should ignore status field if sent in update payload', async () => {
            await prisma.jobPost.update({
                where: { id: createdJobId },
                data: { status: 'OPEN' },
            });

            const res = await request(app)
                .patch(`/api/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'Updated Title', status: 'COMPLETED' });

            expect(res.statusCode).toBe(200);
            expect(res.body.job.status).toBe('OPEN');
        });
    });
});