import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';

describe('App-level behaviour', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('should return 404 JSON for an unknown route', async () => {
        const res = await request(app).get('/unknown-route');

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/cannot find/i);
    });

    it('should return 404 (not 401) for an unknown /api route', async () => {
        const res = await request(app).get('/api/does-not-exist');

        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('should return 401 for a protected route without a token', async () => {
        const res = await request(app).get('/api/contracts/my');

        expect(res.statusCode).toBe(401);
    });
});
