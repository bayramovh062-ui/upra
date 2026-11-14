import { prisma, cleanUpUsers, registerUser } from './helpers/db.js';
import { PASSWORD } from './helpers/p2.js';
import { reserve, refund, getUsed, nextResetAt } from '../src/services/ai/quota.js';

const EMAIL = 'aiq_user@upra.com';

describe('AI daily quota', () => {
    let userId;

    beforeAll(async () => {
        await cleanUpUsers([EMAIL]);
        const { user } = await registerUser({
            email: EMAIL,
            password: PASSWORD,
            fullName: 'AI Quota User',
            role: 'CLIENT',
        });
        userId = user.id;
    });

    beforeEach(async () => {
        await prisma.aiUsage.deleteMany({ where: { userId } });
    });

    afterAll(async () => {
        await cleanUpUsers([EMAIL]);
        await prisma.$disconnect();
    });

    it('counts up to the limit and then refuses without changing the counter', async () => {
        expect(await reserve(userId, 'ASSISTANT', 2)).toEqual({ ok: true, used: 1 });
        expect(await reserve(userId, 'ASSISTANT', 2)).toEqual({ ok: true, used: 2 });
        const third = await reserve(userId, 'ASSISTANT', 2);
        expect(third.ok).toBe(false);
        expect(await getUsed(userId, 'ASSISTANT')).toBe(2);
    });

    it('refuses a zero limit before touching the database', async () => {
        expect((await reserve(userId, 'ASSISTANT', 0)).ok).toBe(false);
        expect(await getUsed(userId, 'ASSISTANT')).toBe(0);
    });

    it('refund lowers the counter and never goes below zero', async () => {
        await reserve(userId, 'ASSISTANT', 5);
        await reserve(userId, 'ASSISTANT', 5);
        await refund(userId, 'ASSISTANT');
        expect(await getUsed(userId, 'ASSISTANT')).toBe(1);
        await refund(userId, 'ASSISTANT');
        await refund(userId, 'ASSISTANT');
        expect(await getUsed(userId, 'ASSISTANT')).toBe(0);
    });

    it('keeps ASSISTANT and DISPUTE counters independent', async () => {
        await reserve(userId, 'ASSISTANT', 5);
        await reserve(userId, 'DISPUTE', 5);
        await reserve(userId, 'DISPUTE', 5);
        expect(await getUsed(userId, 'ASSISTANT')).toBe(1);
        expect(await getUsed(userId, 'DISPUTE')).toBe(2);
    });

    it('starts a new UTC day at zero', async () => {
        const today = new Date('2026-11-14T10:00:00Z');
        const tomorrow = new Date('2026-11-15T00:00:01Z');
        await reserve(userId, 'ASSISTANT', 1, today);
        expect((await reserve(userId, 'ASSISTANT', 1, today)).ok).toBe(false);
        expect(await reserve(userId, 'ASSISTANT', 1, tomorrow)).toEqual({ ok: true, used: 1 });
        expect(await getUsed(userId, 'ASSISTANT', today)).toBe(1);
    });

    it('lets exactly 20 of 30 parallel reservations through', async () => {
        const results = await Promise.all(Array.from({ length: 30 }, () => reserve(userId, 'ASSISTANT', 20)));
        expect(results.filter((r) => r.ok)).toHaveLength(20);
        expect(await getUsed(userId, 'ASSISTANT')).toBe(20);
    });

    it('computes the next UTC midnight', () => {
        expect(nextResetAt(new Date('2026-11-14T10:00:00Z')).toISOString()).toBe('2026-11-15T00:00:00.000Z');
        expect(nextResetAt(new Date('2026-12-31T23:59:59Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
});
