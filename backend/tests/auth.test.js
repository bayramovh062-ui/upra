import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

const testUser = {
    email: 'test_coverage@upra.com',
    password: 'Password123!',
    fullName: 'Test Coverage User',
    role: 'CLIENT',
};

const freelancerUser = {
    email: 'freelancer@upra.com',
    password: 'Password123!',
    fullName: 'Test Freelancer',
    role: 'FREELANCER',
};
let authToken;

beforeAll(async () => {
    await prisma.user.deleteMany({
        where: { email: { in: [testUser.email, freelancerUser.email] } },
    });
});

afterAll(async () => {
    await prisma.user.deleteMany({
        where: { email: { in: [testUser.email, freelancerUser.email] } },
    });
    await prisma.$disconnect();
});

describe('Authentication API & Validation Suite', () => {

    describe('POST /api/auth/register', () => {
        it('should fail registration if email format is invalid (Zod validation)', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'invalid-email-format',
                    password: 'Password123!',
                    fullName: 'Test User',
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toMatch(/Invalid email address format/i);
        });

        it('should fail registration if password is too short (Zod validation)', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'valid@upra.com',
                    password: '123',
                    fullName: 'Test User',
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toMatch(/Password must be at least 6 characters long/i);
        });

        it('should successfully register a valid user', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();

            authToken = response.body.token;
        });

        it('should reject re-registration with same email', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
        it('should successfully register a valid FREELANCER user', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(freelancerUser);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.user.role).toBe('FREELANCER');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should fail login with empty payload (Zod validation)', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should login successfully with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password,
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
        });

        it('should reject login with wrong password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'WrongPassword123!',
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should fetch user profile with valid Bearer token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe(testUser.email);
        });

        it('should reject profile request without token', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PATCH /api/auth/update-me', () => {
        it('should reject update if fullName is too short (Zod validation)', async () => {
            const response = await request(app)
                .patch('/api/auth/update-me')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ fullName: 'A' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should update profile name successfully', async () => {
            const response = await request(app)
                .patch('/api/auth/update-me')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ fullName: 'Updated Full Name' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user.fullName).toBe('Updated Full Name');
        });
    });

    describe('PATCH /api/auth/update-password', () => {
        it('should reject password update if current password is wrong', async () => {
            const response = await request(app)
                .patch('/api/auth/update-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'WrongCurrentPassword!',
                    newPassword: 'NewPassword123!',
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should update password successfully', async () => {
            const response = await request(app)
                .patch('/api/auth/update-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: testUser.password,
                    newPassword: 'NewPassword123!',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

});