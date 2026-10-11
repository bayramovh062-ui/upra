import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

const testUser = {
    email: 'test@upra.com',
    password: 'Password123!',
    fullName: 'Test User',
    role: 'CLIENT'
};

beforeAll(async () => {
    await prisma.user.deleteMany({
        where: { email: testUser.email }
    });
});

afterAll(async () => {
    await prisma.user.deleteMany({
        where: { email: testUser.email }
    });
    await prisma.$disconnect();
});

describe('Auth API tests', () => {

    describe('POST /api/auth/register', () => {
        it('must successfully register the new user.', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser);

            // (Expectations)
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.user.email).toBe(testUser.email);
            expect(response.body.user.password).toBeUndefined();
        });

        it('should not allow re-registration with an existing email.', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toMatch(/This email is already registered./i);
        });
    });

    describe('POST /api/auth/login', () => {
        it('must successfully log in to the system with the correct information.', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
        });

        it('should not allow login with an incorrect password.', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'WrongPassword123!'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

});