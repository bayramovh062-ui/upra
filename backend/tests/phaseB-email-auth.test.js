import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/db.js';
import { testOutbox, clearTestOutbox } from '../src/services/emailService.js';
import { hashToken } from '../src/services/authTokenService.js';
import { cleanUpUsers } from './helpers/db.js';

// Phase B: e-poçt təsdiqi, parol bərpası, sessiya ləğvi və təsdiq qapısı.

const client = {
    email: 'phaseb_client@upra.test',
    password: 'Password123!',
    fullName: 'Phase B Client',
    role: 'CLIENT',
};
const other = {
    email: 'phaseb_other@upra.test',
    password: 'Password123!',
    fullName: 'Phase B Other',
    role: 'FREELANCER',
};
const emails = [client.email, other.email];

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const lastMailTo = (to) => [...testOutbox].reverse().find((m) => m.to === to);
const tokenFromMail = (mail) => mail.text.match(/token=([a-f0-9]{64})/)?.[1];

const jobBody = {
    title: 'Phase B gate test job',
    description: 'A sufficiently long description for the Phase B gate test job.',
    budget: 500,
};

let clientToken;
let verifiedWithToken;
let originalGateFlag;

beforeAll(async () => {
    originalGateFlag = process.env.REQUIRE_EMAIL_VERIFICATION;
    await cleanUpUsers(emails);
});

afterAll(async () => {
    if (originalGateFlag === undefined) delete process.env.REQUIRE_EMAIL_VERIFICATION;
    else process.env.REQUIRE_EMAIL_VERIFICATION = originalGateFlag;
    await cleanUpUsers(emails);
    await prisma.$disconnect();
});

beforeEach(() => {
    clearTestOutbox();
});

describe('Phase B: email verification', () => {
    it('registers an unverified user and sends a verification email', async () => {
        const res = await request(app).post('/api/auth/register').send(client);

        expect(res.status).toBe(201);
        expect(res.body.user.emailVerified).toBe(false);
        expect(res.body.user.tokenVersion).toBeUndefined();
        clientToken = res.body.token;

        const mail = lastMailTo(client.email);
        expect(mail).toBeDefined();
        expect(mail.subject).toMatch(/confirm your email/i);
        expect(tokenFromMail(mail)).toMatch(/^[a-f0-9]{64}$/);
    });

    it('stores only a hash of the token', async () => {
        const res = await request(app).post('/api/auth/verify-email/send').set(auth(clientToken));
        expect(res.status).toBe(200);

        const token = tokenFromMail(lastMailTo(client.email));
        const user = await prisma.user.findUnique({ where: { email: client.email }, select: { id: true } });
        const rows = await prisma.authToken.findMany({ where: { userId: user.id, type: 'EMAIL_VERIFY', usedAt: null } });

        // Yenidən göndəriş köhnə istifadə olunmamış tokeni əvəz edir: yalnız bir aktiv token qalır
        expect(rows).toHaveLength(1);
        expect(rows[0].tokenHash).toBe(hashToken(token));
        expect(rows[0].tokenHash).not.toBe(token);
    });

    it('rejects an invalid token', async () => {
        const res = await request(app).post('/api/auth/verify-email').send({ token: 'not-a-real-token' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('rejects an expired token', async () => {
        await request(app).post('/api/auth/verify-email/send').set(auth(clientToken)).expect(200);
        const token = tokenFromMail(lastMailTo(client.email));

        const user = await prisma.user.findUnique({ where: { email: client.email }, select: { id: true } });
        await prisma.authToken.updateMany({
            where: { userId: user.id, type: 'EMAIL_VERIFY', usedAt: null },
            data: { expiresAt: new Date(Date.now() - 1000) },
        });

        const res = await request(app).post('/api/auth/verify-email').send({ token });
        expect(res.status).toBe(400);

        const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } });
        expect(fresh.emailVerified).toBe(false);
    });

    it('blocks unverified users from posting jobs when the gate is on', async () => {
        process.env.REQUIRE_EMAIL_VERIFICATION = 'true';

        const res = await request(app).post('/api/jobs').set(auth(clientToken)).send(jobBody);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('does not apply the gate when it is switched off', async () => {
        process.env.REQUIRE_EMAIL_VERIFICATION = 'false';

        const res = await request(app).post('/api/jobs').set(auth(clientToken)).send(jobBody);
        expect(res.status).toBe(201);
    });

    it('verifies the email with a valid token and lifts the gate', async () => {
        process.env.REQUIRE_EMAIL_VERIFICATION = 'true';

        await request(app).post('/api/auth/verify-email/send').set(auth(clientToken)).expect(200);
        verifiedWithToken = tokenFromMail(lastMailTo(client.email));

        const res = await request(app).post('/api/auth/verify-email').send({ token: verifiedWithToken });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const me = await request(app).get('/api/auth/me').set(auth(clientToken));
        expect(me.body.user.emailVerified).toBe(true);

        const job = await request(app).post('/api/jobs').set(auth(clientToken)).send(jobBody);
        expect(job.status).toBe(201);
    });

    it('treats a second click on the same link as success, not an error', async () => {
        const res = await request(app).post('/api/auth/verify-email').send({ token: verifiedWithToken });

        expect(res.status).toBe(200);
        expect(res.body.alreadyVerified).toBe(true);
    });

    it('does not resend to an already verified account', async () => {
        clearTestOutbox();
        const res = await request(app).post('/api/auth/verify-email/send').set(auth(clientToken));

        expect(res.status).toBe(200);
        expect(res.body.alreadyVerified).toBe(true);
        expect(lastMailTo(client.email)).toBeUndefined();
    });

    it('requires authentication to resend the verification email', async () => {
        const res = await request(app).post('/api/auth/verify-email/send');
        expect(res.status).toBe(401);
    });
});

describe('Phase B: password reset', () => {
    beforeAll(async () => {
        const res = await request(app).post('/api/auth/register').send(other);
        expect(res.status).toBe(201);
    });

    it('answers identically for existing and unknown emails and only mails real accounts', async () => {
        const known = await request(app).post('/api/auth/forgot-password').send({ email: other.email });
        const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody_phaseb@upra.test' });

        expect(known.status).toBe(200);
        expect(unknown.status).toBe(200);
        expect(unknown.body).toEqual(known.body);

        expect(lastMailTo(other.email)?.subject).toMatch(/reset your password/i);
        expect(lastMailTo('nobody_phaseb@upra.test')).toBeUndefined();
    });

    it('rejects an invalid email format', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nope' });
        expect(res.status).toBe(400);
    });

    it('does not accept a reset token as a verification token (and vice versa)', async () => {
        await request(app).post('/api/auth/forgot-password').send({ email: other.email });
        const resetToken = tokenFromMail(lastMailTo(other.email));

        const res = await request(app).post('/api/auth/verify-email').send({ token: resetToken });
        expect(res.status).toBe(400);
    });

    it('rejects a too-short new password', async () => {
        await request(app).post('/api/auth/forgot-password').send({ email: other.email });
        const token = tokenFromMail(lastMailTo(other.email));

        const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: '123' });
        expect(res.status).toBe(400);
    });

    it('resets the password once, revokes old sessions and rejects reuse', async () => {
        const oldLogin = await request(app).post('/api/auth/login').send({ email: other.email, password: other.password });
        expect(oldLogin.status).toBe(200);
        const oldToken = oldLogin.body.token;

        await request(app).post('/api/auth/forgot-password').send({ email: other.email });
        const token = tokenFromMail(lastMailTo(other.email));

        const reset = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'BrandNewPass456!' });
        expect(reset.status).toBe(200);

        // Köhnə sessiya ləğv olunub
        const stale = await request(app).get('/api/auth/me').set(auth(oldToken));
        expect(stale.status).toBe(401);

        // Köhnə parol işləmir, yenisi işləyir
        const wrong = await request(app).post('/api/auth/login').send({ email: other.email, password: other.password });
        expect(wrong.status).toBe(401);

        const fresh = await request(app).post('/api/auth/login').send({ email: other.email, password: 'BrandNewPass456!' });
        expect(fresh.status).toBe(200);
        const freshMe = await request(app).get('/api/auth/me').set(auth(fresh.body.token));
        expect(freshMe.status).toBe(200);

        // Token birdəfəlikdir
        const reuse = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'AnotherPass789!' });
        expect(reuse.status).toBe(400);
    });

    it('marks the email as verified after a successful reset', async () => {
        const user = await prisma.user.findUnique({ where: { email: other.email }, select: { emailVerified: true } });
        expect(user.emailVerified).toBe(true);
    });

    it('rejects an expired reset token', async () => {
        await request(app).post('/api/auth/forgot-password').send({ email: other.email });
        const token = tokenFromMail(lastMailTo(other.email));

        await prisma.authToken.updateMany({
            where: { tokenHash: hashToken(token) },
            data: { expiresAt: new Date(Date.now() - 1000) },
        });

        const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'YetAnotherPass1!' });
        expect(res.status).toBe(400);
    });
});
