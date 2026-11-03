import express from 'express';
import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, registerUser } from './helpers/db.js';
import {
    createFailedLoginLimiter,
    loginLimiter,
    LOGIN_MAX_FAILED_ATTEMPTS,
    LOGIN_BLOCK_MS,
} from '../src/middlewares/rateLimiter.js';
import { validate } from '../src/middlewares/validate.js';
import { loginSchema } from '../src/validators/authValidator.js';
import { login } from '../src/controllers/authController.js';
import { globalErrorMiddleware } from '../src/middlewares/errorMiddleware.js';
import { resolveTrustProxy } from '../src/config/proxy.js';

const PASSWORD = 'Password123!';
const WRONG = 'WrongPassword!';
const MINUTE = 60 * 1000;

// Hər test öz saatı və limiter-i ilə: vaxtı irəli çəkmək və IP-ni dəyişmək üçün (X-Forwarded-For yalnız bu test tətbiqində etibarlıdır)
const makeLoginApp = () => {
    const clock = { now: Date.now() };
    const limiter = createFailedLoginLimiter({ now: () => clock.now, sweepIntervalMs: 0 });
    const testApp = express();
    testApp.set('trust proxy', true);
    testApp.use(express.json());
    testApp.post('/login', limiter, validate(loginSchema), login);
    testApp.use(globalErrorMiddleware);

    const attempt = (email, password, ip = '203.0.113.10') =>
        request(testApp).post('/login').set('X-Forwarded-For', ip).send({ email, password });

    return { clock, limiter, attempt };
};

describe('Failed-login rate limiter', () => {
    const emails = ['rl_victim@upra.com', 'rl_attacker@upra.com', 'rl_user@upra.com'];
    const [VICTIM, ATTACKER, USER] = emails;
    let user;

    beforeAll(async () => {
        await cleanUpUsers(emails);
        await registerUser({ email: VICTIM, password: PASSWORD, fullName: 'RL Victim', role: 'FREELANCER' });
        await registerUser({ email: ATTACKER, password: PASSWORD, fullName: 'RL Attacker', role: 'CLIENT' });
        user = await registerUser({ email: USER, password: PASSWORD, fullName: 'RL User', role: 'CLIENT' });
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    describe('threshold and restriction window', () => {
        it('counts the first incorrect attempt without blocking', async () => {
            const { attempt, limiter } = makeLoginApp();

            const res = await attempt(VICTIM, WRONG);
            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
            expect(limiter.store.check('203.0.113.10').blocked).toBe(false);
            expect(limiter.store.get('203.0.113.10').total).toBe(1);
        });

        it('allows 5 incorrect attempts, then answers the 6th with 429 and retry information', async () => {
            const { attempt } = makeLoginApp();

            for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
                const res = await attempt(VICTIM, WRONG);
                expect(res.status).toBe(401);
            }

            const sixth = await attempt(VICTIM, WRONG);
            expect(sixth.status).toBe(429);
            expect(sixth.body.success).toBe(false);
            expect(sixth.body.message).toMatch(/too many failed login attempts.*15 minutes/i);
            expect(sixth.body.retryAfter).toBe(LOGIN_BLOCK_MS / 1000);
            expect(sixth.headers['retry-after']).toBe(String(LOGIN_BLOCK_MS / 1000));
        });

        it('blocks even the correct password during the 15-minute restriction', async () => {
            const { attempt, clock } = makeLoginApp();
            for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) await attempt(VICTIM, WRONG);

            clock.now += 14 * MINUTE + 59 * 1000;
            const res = await attempt(VICTIM, PASSWORD);
            expect(res.status).toBe(429);
            expect(res.body.retryAfter).toBe(1);
        });

        it('allows logging in again once the 15 minutes have passed', async () => {
            const { attempt, clock } = makeLoginApp();
            for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) await attempt(VICTIM, WRONG);

            clock.now += LOGIN_BLOCK_MS;
            const ok = await attempt(VICTIM, PASSWORD);
            expect(ok.status).toBe(200);
            expect(ok.body.token).toBeDefined();

            // Sayğac təmizdir: bir səhv yenə 401-dir, 429 yox
            const wrong = await attempt(VICTIM, WRONG);
            expect(wrong.status).toBe(401);
        });

        it('forgets failures that are older than the 15-minute window', async () => {
            const { attempt, clock } = makeLoginApp();
            for (let i = 0; i < 4; i += 1) await attempt(VICTIM, WRONG);

            clock.now += 15 * MINUTE + 1000;
            for (let i = 0; i < 4; i += 1) {
                const res = await attempt(VICTIM, WRONG);
                expect(res.status).toBe(401);
            }
        });
    });

    describe('successful logins', () => {
        it('never counts successful logins', async () => {
            const { attempt, limiter } = makeLoginApp();

            for (let i = 0; i < 10; i += 1) {
                const res = await attempt(VICTIM, PASSWORD);
                expect(res.status).toBe(200);
            }
            expect(limiter.store.get('203.0.113.10')).toBeNull();
        });

        it('resets the failed-attempt counter after a successful login', async () => {
            const { attempt } = makeLoginApp();

            for (let i = 0; i < 4; i += 1) await attempt(VICTIM, WRONG);
            expect((await attempt(VICTIM, PASSWORD)).status).toBe(200);

            // 5 yeni səhv lazımdır: əvvəlki 4 silinib
            for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
                expect((await attempt(VICTIM, WRONG)).status).toBe(401);
            }
            expect((await attempt(VICTIM, WRONG)).status).toBe(429);
        });

        it('does not let an attacker reset failures against another account by logging into their own', async () => {
            const { attempt } = makeLoginApp();

            for (let i = 0; i < 4; i += 1) await attempt(VICTIM, WRONG);
            expect((await attempt(ATTACKER, PASSWORD)).status).toBe(200);

            expect((await attempt(VICTIM, WRONG)).status).toBe(401);
            expect((await attempt(VICTIM, WRONG)).status).toBe(429);
        });
    });

    describe('what counts as a failure', () => {
        it('counts unknown emails the same way and returns the same message (no account enumeration)', async () => {
            const { attempt } = makeLoginApp();

            const unknown = await attempt('rl_nobody@upra.com', WRONG);
            const wrong = await attempt(VICTIM, WRONG);
            expect(unknown.status).toBe(401);
            expect(unknown.body.message).toBe(wrong.body.message);

            for (let i = 0; i < 3; i += 1) await attempt('rl_nobody@upra.com', WRONG);
            expect((await attempt(VICTIM, PASSWORD)).status).toBe(429);
        });

        it('does not count malformed requests rejected by validation', async () => {
            const { attempt, limiter } = makeLoginApp();

            for (let i = 0; i < 10; i += 1) {
                const res = await attempt('not-an-email', '');
                expect(res.status).toBe(400);
            }
            expect(limiter.store.get('203.0.113.10')).toBeNull();
            expect((await attempt(VICTIM, PASSWORD)).status).toBe(200);
        });

        it('cannot be bypassed by firing many attempts in parallel', async () => {
            const { attempt } = makeLoginApp();

            const results = await Promise.all(Array.from({ length: 12 }, () => attempt(VICTIM, WRONG)));
            const statuses = results.map((r) => r.status);

            expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(LOGIN_MAX_FAILED_ATTEMPTS);
            expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(12 - LOGIN_MAX_FAILED_ATTEMPTS);
            expect((await attempt(VICTIM, PASSWORD)).status).toBe(429);
        });
    });

    describe('IP addresses and accounts', () => {
        it('tracks different IP addresses independently', async () => {
            const { attempt } = makeLoginApp();

            for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) await attempt(VICTIM, WRONG, '198.51.100.1');
            expect((await attempt(VICTIM, PASSWORD, '198.51.100.1')).status).toBe(429);

            expect((await attempt(VICTIM, WRONG, '198.51.100.2')).status).toBe(401);
            expect((await attempt(VICTIM, PASSWORD, '198.51.100.2')).status).toBe(200);
        });

        it('does not lock the account owner out when others fail against the same account', async () => {
            const { attempt } = makeLoginApp();

            for (const ip of ['192.0.2.1', '192.0.2.2', '192.0.2.3']) {
                for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
                    expect((await attempt(VICTIM, WRONG, ip)).status).toBe(401);
                }
                expect((await attempt(VICTIM, WRONG, ip)).status).toBe(429);
            }

            // Hesab bloklanmır: sahibi öz IP-sindən daxil ola bilir
            expect((await attempt(VICTIM, PASSWORD, '192.0.2.50')).status).toBe(200);
        });
    });

    describe('real /api/auth routes', () => {
        const ME = () => request(app).get('/api/auth/me').set(auth(user.token));

        beforeEach(() => loginLimiter.store.resetAll());
        afterAll(() => loginLimiter.store.resetAll());

        it('does not count normal API traffic, profile updates or registrations', async () => {
            for (let i = 0; i < 10; i += 1) {
                expect((await ME()).status).toBe(200);
                expect((await request(app).get('/api/jobs')).status).toBe(200);
            }
            const updated = await request(app).patch('/api/auth/update-me').set(auth(user.token)).send({ fullName: 'RL User Updated' });
            expect(updated.status).toBe(200);

            await cleanUpUsers(['rl_new@upra.com']);
            expect((await request(app).post('/api/auth/register').send({ email: 'rl_new@upra.com', password: PASSWORD, fullName: 'RL New' })).status).toBe(201);
            await cleanUpUsers(['rl_new@upra.com']);

            expect(loginLimiter.store.check('127.0.0.1').blocked).toBe(false);
            expect([...loginLimiter.store.entries.values()].every((e) => e.total === 0)).toBe(true);
        });

        it('blocks only the login endpoint after 5 failures; other endpoints and registration keep working', async () => {
            for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
                const res = await request(app).post('/api/auth/login').send({ email: USER, password: WRONG });
                expect(res.status).toBe(401);
            }

            const blocked = await request(app).post('/api/auth/login').send({ email: USER, password: PASSWORD });
            expect(blocked.status).toBe(429);
            expect(blocked.headers['retry-after']).toBeDefined();
            expect(blocked.body.retryAfter).toBeGreaterThan(0);

            expect((await ME()).status).toBe(200);
            expect((await request(app).get('/api/jobs')).status).toBe(200);

            await cleanUpUsers(['rl_new2@upra.com']);
            const reg = await request(app).post('/api/auth/register').send({ email: 'rl_new2@upra.com', password: PASSWORD, fullName: 'RL New Two' });
            expect(reg.status).toBe(201);
            await cleanUpUsers(['rl_new2@upra.com']);
        });

        it('ignores a spoofed X-Forwarded-For header (trust proxy is off outside production)', async () => {
            for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
                await request(app).post('/api/auth/login').send({ email: USER, password: WRONG });
            }

            const spoofed = await request(app)
                .post('/api/auth/login')
                .set('X-Forwarded-For', '198.51.100.99')
                .send({ email: USER, password: PASSWORD });
            expect(spoofed.status).toBe(429);
        });

        it('lets successful logins through repeatedly', async () => {
            for (let i = 0; i < 8; i += 1) {
                const res = await request(app).post('/api/auth/login').send({ email: USER, password: PASSWORD });
                expect(res.status).toBe(200);
            }
        });
    });
});

describe('resolveTrustProxy', () => {
    it('defaults to one hop in production and to no proxy elsewhere', () => {
        expect(resolveTrustProxy(undefined, 'production')).toBe(1);
        expect(resolveTrustProxy('', 'development')).toBe(false);
        expect(resolveTrustProxy(undefined, 'test')).toBe(false);
    });

    it('accepts hop counts, false and address lists', () => {
        expect(resolveTrustProxy('2', 'production')).toBe(2);
        expect(resolveTrustProxy('0', 'production')).toBe(false);
        expect(resolveTrustProxy('false', 'production')).toBe(false);
        expect(resolveTrustProxy('loopback, 10.0.0.0/8', 'production')).toEqual(['loopback', '10.0.0.0/8']);
    });

    it('refuses to trust every X-Forwarded-For header', () => {
        expect(() => resolveTrustProxy('true', 'production')).toThrow(/not allowed/);
    });
});
