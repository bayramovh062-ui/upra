import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, cleanUpTestSkills, registerUser } from './helpers/db.js';

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
        await cleanUpTestSkills();
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

    describe('validation of individual fields', () => {
        it('accepts IANA time zones and rejects unknown ones', async () => {
            expect((await update(free.token, { timezone: 'Mars/Phobos' })).status).toBe(400);

            const utc = await update(free.token, { timezone: 'UTC' });
            expect(utc.status).toBe(200);
            expect(utc.body.user.timezone).toBe('UTC');

            const cleared = await update(free.token, { timezone: '' });
            expect(cleared.body.user.timezone).toBeNull();

            await update(free.token, { timezone: 'Asia/Baku' });
        });

        it('allows at most 2 decimal places in the hourly rate', async () => {
            expect((await update(free.token, { hourlyRate: 55.555 })).status).toBe(400);
            expect((await update(free.token, { hourlyRate: '55' })).status).toBe(400);

            const ok = await update(free.token, { hourlyRate: 55.5 });
            expect(ok.status).toBe(200);
            expect(Number(ok.body.user.hourlyRate)).toBe(55.5);

            const cleared = await update(free.token, { hourlyRate: null });
            expect(cleared.body.user.hourlyRate).toBeNull();

            await update(free.token, { hourlyRate: 55 });
        });

        it('only accepts known availability values', async () => {
            expect((await update(free.token, { availability: 'ON_VACATION' })).status).toBe(400);

            const busy = await update(free.token, { availability: 'BUSY' });
            expect(busy.body.user.availability).toBe('BUSY');
            await update(free.token, { availability: 'AVAILABLE' });
        });

        it('rejects non-http avatar URLs and clears the avatar with an empty string', async () => {
            expect((await update(free.token, { avatarUrl: 'javascript:alert(1)' })).status).toBe(400);
            expect((await update(free.token, { avatarUrl: 'not a url' })).status).toBe(400);

            const cleared = await update(free.token, { avatarUrl: '' });
            expect(cleared.status).toBe(200);
            expect(cleared.body.user.avatarUrl).toBeNull();

            await update(free.token, { avatarUrl: 'https://example.com/avatar.png' });
        });

        it('rejects an over-long full name and an empty body', async () => {
            expect((await update(free.token, { fullName: 'x'.repeat(101) })).status).toBe(400);
            expect((await update(free.token, {})).status).toBe(400);
        });
    });

    describe('skills', () => {
        const skillNames = (res) => res.body.user.skills.map((s) => s.name);

        it('adds skills, removes duplicates case-insensitively and replaces the list', async () => {
            const added = await update(free.token, { skills: ['zz-Alpha', 'zz-beta', 'ZZ-ALPHA'] });
            expect(added.status).toBe(200);
            expect(skillNames(added)).toEqual(['zz-Alpha', 'zz-beta']);

            const replaced = await update(free.token, { skills: ['zz-beta'] });
            expect(skillNames(replaced)).toEqual(['zz-beta']);
        });

        it('removes every skill with an empty list', async () => {
            const res = await update(free.token, { skills: [] });
            expect(res.status).toBe(200);
            expect(res.body.user.skills).toEqual([]);
        });

        it('rejects invalid skill names and more than 15 skills', async () => {
            expect((await update(free.token, { skills: ['zz,comma'] })).status).toBe(400);
            expect((await update(free.token, { skills: ['  '] })).status).toBe(400);
            expect((await update(free.token, { skills: 'zz-alpha' })).status).toBe(400);

            const tooMany = Array.from({ length: 16 }, (_, i) => `zz-skill-${i}`);
            const res = await update(free.token, { skills: tooMany });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/at most 15/);
        });

        it('shows skills on the public profile', async () => {
            await update(free.token, { skills: ['zz-gamma'] });
            const res = await request(app).get(`/api/users/${free.user.id}`).set(auth(other.token));
            expect(res.body.user.skills.map((s) => s.name)).toEqual(['zz-gamma']);
        });

        it('does not let a client set skills', async () => {
            expect((await update(client.token, { skills: ['zz-alpha'] })).status).toBe(400);
        });
    });

    describe('authorization and sensitive fields', () => {
        it('ignores attempts to change role, email, password hash, id or deletion state', async () => {
            const res = await update(other.token, {
                fullName: 'PF Other Renamed',
                role: 'CLIENT',
                email: 'hijack@upra.com',
                passwordHash: 'x',
                password: 'NewPassword1!',
                id: free.user.id,
                deletedAt: new Date().toISOString(),
                createdAt: '2000-01-01T00:00:00.000Z',
            });

            expect(res.status).toBe(200);
            expect(res.body.user.id).toBe(other.user.id);
            expect(res.body.user.fullName).toBe('PF Other Renamed');
            expect(res.body.user.role).toBe('FREELANCER');
            expect(res.body.user.email).toBe(emails[2]);
            expect(res.body.user.passwordHash).toBeUndefined();

            const stored = await prisma.user.findUnique({ where: { id: other.user.id } });
            expect(stored.deletedAt).toBeNull();
            expect(stored.role).toBe('FREELANCER');

            const login = await request(app).post('/api/auth/login').send({ email: emails[2], password: PASSWORD });
            expect(login.status).toBe(200);
        });

        it('rejects a body made only of protected fields', async () => {
            const res = await update(other.token, { role: 'CLIENT', email: 'hijack@upra.com' });
            expect(res.status).toBe(400);
        });

        it('never modifies another user even when their id is sent', async () => {
            const before = await prisma.user.findUnique({ where: { id: free.user.id } });
            await update(other.token, { id: free.user.id, headline: 'Hijacked headline' });
            const after = await prisma.user.findUnique({ where: { id: free.user.id } });

            expect(after.headline).toBe(before.headline);
        });

        it('has no endpoint for editing someone else\'s profile', async () => {
            const res = await request(app)
                .patch(`/api/users/${free.user.id}`)
                .set(auth(other.token))
                .send({ headline: 'Hijacked' });
            expect(res.status).toBe(404);
        });

        it('requires authentication to update a profile', async () => {
            const res = await request(app).patch('/api/auth/update-me').send({ headline: 'Anon' });
            expect(res.status).toBe(401);
        });

        it('never exposes email or security fields on public or private profiles', async () => {
            const forbidden = ['email', 'passwordHash', 'password', 'deletedAt', 'token'];

            const pub = await request(app).get(`/api/users/${free.user.id}`).set(auth(other.token));
            for (const key of forbidden) expect(pub.body.user[key]).toBeUndefined();
            expect(pub.body.token).toBeUndefined();

            await update(free.token, { profilePublic: false });
            const priv = await request(app).get(`/api/users/${free.user.id}`).set(auth(other.token));
            for (const key of [...forbidden, 'bio', 'headline', 'hourlyRate', 'location', 'timezone', 'skills', 'avatarUrl']) {
                expect(priv.body.user[key]).toBeUndefined();
            }

            const own = await request(app).get(`/api/users/${free.user.id}`).set(auth(free.token));
            expect(own.body.user.email).toBeUndefined();
            expect(own.body.user.passwordHash).toBeUndefined();

            await update(free.token, { profilePublic: true });
        });
    });
});
