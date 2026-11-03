import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, registerUser } from './helpers/db.js';

const PASSWORD = 'Password123!';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

// Bütün test faylları eyni bazada paralel işləyir: bu faylın e-poçtları "pf_" ilə başlayır
describe('Phase 1D: profile fields and visibility', () => {
    const emails = ['pf_client@upra.com', 'pf_free@upra.com', 'pf_other@upra.com'];
    let client, free, other;

    beforeAll(async () => {
        await cleanUpUsers(emails);

        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'PF Client', role: 'CLIENT' });
        free = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'PF Freelancer', role: 'FREELANCER' });
        other = await registerUser({ email: emails[2], password: PASSWORD, fullName: 'PF Other', role: 'FREELANCER' });
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    const update = (token, body) => request(app).patch('/api/auth/update-me').set(auth(token)).send(body);

    it('is public by default and exposes profilePublic in GET /auth/me', async () => {
        const res = await request(app).get('/api/auth/me').set(auth(free.token));

        expect(res.status).toBe(200);
        expect(res.body.user.profilePublic).toBe(true);
    });

    it('saves headline, bio, rate, location, timezone and avatar together', async () => {
        const res = await update(free.token, {
            headline: 'Senior backend engineer',
            bio: 'I build APIs.\nSecond line of the bio.',
            hourlyRate: 55,
            location: 'Baku, Azerbaijan',
            timezone: 'Asia/Baku',
            avatarUrl: 'https://example.com/avatar.png',
        });

        expect(res.status).toBe(200);
        expect(res.body.user.headline).toBe('Senior backend engineer');
        expect(res.body.user.bio).toContain('Second line');
        expect(Number(res.body.user.hourlyRate)).toBe(55);
        expect(res.body.user.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('rejects an over-long headline, an over-long bio and a bad hourly rate', async () => {
        const headline = await update(free.token, { headline: 'x'.repeat(121) });
        expect(headline.status).toBe(400);
        expect(headline.body.message).toMatch(/headline/i);

        const bio = await update(free.token, { bio: 'x'.repeat(1001) });
        expect(bio.status).toBe(400);
        expect(bio.body.message).toMatch(/bio/i);

        const negative = await update(free.token, { hourlyRate: -5 });
        expect(negative.status).toBe(400);

        const zero = await update(free.token, { hourlyRate: 0 });
        expect(zero.status).toBe(400);
    });

    it('rejects a non-boolean profilePublic value', async () => {
        const res = await update(free.token, { profilePublic: 'no' });
        expect(res.status).toBe(400);
    });

    it('shows the full public profile to other users while it is public', async () => {
        const res = await request(app).get(`/api/users/${free.user.id}`).set(auth(other.token));

        expect(res.status).toBe(200);
        expect(res.body.user.headline).toBe('Senior backend engineer');
        expect(res.body.user.bio).toContain('I build APIs');
        expect(res.body.user.profilePublic).toBe(true);
        expect(res.body.user.email).toBeUndefined();
        expect(res.body.stats).not.toBeNull();
    });

    describe('after the profile is made private', () => {
        beforeAll(async () => {
            const res = await update(free.token, { profilePublic: false });
            expect(res.status).toBe(200);
            expect(res.body.user.profilePublic).toBe(false);
        });

        it('shows other users only the name and the role', async () => {
            const res = await request(app).get(`/api/users/${free.user.id}`).set(auth(client.token));

            expect(res.status).toBe(200);
            expect(res.body.user).toEqual({
                id: free.user.id,
                fullName: 'PF Freelancer',
                role: 'FREELANCER',
                profilePublic: false,
            });
            expect(res.body.stats).toBeNull();
        });

        it('still shows the owner their full profile', async () => {
            const res = await request(app).get(`/api/users/${free.user.id}`).set(auth(free.token));

            expect(res.status).toBe(200);
            expect(res.body.user.headline).toBe('Senior backend engineer');
            expect(res.body.user.profilePublic).toBe(false);
            expect(res.body.stats).not.toBeNull();
        });

        it('becomes visible again when switched back', async () => {
            await update(free.token, { profilePublic: true });

            const res = await request(app).get(`/api/users/${free.user.id}`).set(auth(client.token));
            expect(res.body.user.bio).toContain('I build APIs');
        });
    });

    it('requires a token and returns 404 for an unknown or deleted user', async () => {
        const anon = await request(app).get(`/api/users/${free.user.id}`);
        expect(anon.status).toBe(401);

        const missing = await request(app).get(`/api/users/${MISSING_ID}`).set(auth(client.token));
        expect(missing.status).toBe(404);

        const temp = await registerUser({
            email: 'pf_temp@upra.com',
            password: PASSWORD,
            fullName: 'PF Temp',
            role: 'FREELANCER',
        });
        await request(app).delete('/api/auth/me').set(auth(temp.token)).send({ password: PASSWORD });

        const deleted = await request(app).get(`/api/users/${temp.user.id}`).set(auth(client.token));
        expect(deleted.status).toBe(404);

        await prisma.user.delete({ where: { id: temp.user.id } });
    });

    it('lets a client use the visibility switch but not the hourly rate', async () => {
        const visibility = await update(client.token, { profilePublic: false });
        expect(visibility.status).toBe(200);

        const rate = await update(client.token, { hourlyRate: 30 });
        expect(rate.status).toBe(400);
    });
});
