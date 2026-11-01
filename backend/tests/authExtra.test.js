import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, registerUser } from './helpers/db.js';

const emails = [
    'extra_norm@upra.com',
    'extra_default_role@upra.com',
    'extra_deleted@upra.com',
    'extra_password@upra.com',
];

describe('Auth edge cases', () => {
    beforeAll(() => cleanUpUsers(emails));
    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    it('normalizes the email (trim + lowercase) on register and login', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: '  Extra_Norm@UPRA.com ',
            password: 'Password123!',
            fullName: 'Normalized User',
            role: 'CLIENT',
        });

        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe('extra_norm@upra.com');

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'EXTRA_NORM@upra.com', password: 'Password123!' });
        expect(login.status).toBe(200);
    });

    it('defaults the role to CLIENT and never returns the password hash', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'extra_default_role@upra.com',
            password: 'Password123!',
            fullName: 'Default Role',
        });

        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe('CLIENT');
        expect(res.body.user.passwordHash).toBeUndefined();
        expect(res.body.user.password).toBeUndefined();
    });

    it('rejects an unknown role with a readable message', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'extra_bad_role@upra.com',
            password: 'Password123!',
            fullName: 'Bad Role',
            role: 'ADMIN',
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Role must be either/i);
    });

    it('returns 401 for a malformed token', async () => {
        const res = await request(app).get('/api/auth/me').set(auth('not-a-real-token'));

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('blocks a soft-deleted user from using an old token and from logging in', async () => {
        const { token, user } = await registerUser({
            email: 'extra_deleted@upra.com',
            password: 'Password123!',
            fullName: 'To Be Deleted',
            role: 'FREELANCER',
        });

        await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

        const me = await request(app).get('/api/auth/me').set(auth(token));
        expect(me.status).toBe(401);

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'extra_deleted@upra.com', password: 'Password123!' });
        expect(login.status).toBe(401);
    });

    it('changes the password: new one works, old one stops working', async () => {
        const { token } = await registerUser({
            email: 'extra_password@upra.com',
            password: 'OldPassword1!',
            fullName: 'Password User',
            role: 'CLIENT',
        });

        const change = await request(app)
            .patch('/api/auth/update-password')
            .set(auth(token))
            .send({ currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' });
        expect(change.status).toBe(200);

        const oldLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'extra_password@upra.com', password: 'OldPassword1!' });
        expect(oldLogin.status).toBe(401);

        const newLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'extra_password@upra.com', password: 'NewPassword1!' });
        expect(newLogin.status).toBe(200);
    });

    it('rejects a too-short new password', async () => {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'extra_password@upra.com', password: 'NewPassword1!' });

        const res = await request(app)
            .patch('/api/auth/update-password')
            .set(auth(login.body.token))
            .send({ currentPassword: 'NewPassword1!', newPassword: '123' });

        expect(res.status).toBe(400);
    });
});
