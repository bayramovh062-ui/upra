import { prisma, cleanUpUsers, registerUser } from './helpers/db.js';
import {
    PASSWORD,
    api,
    pairEmails,
    registerAdmin,
    registerPair,
    createContractWithMilestones,
    fundAndSubmit,
} from './helpers/p2.js';
import { createFakeProvider } from './helpers/fakeAiProvider.js';
import { AiProviderError, __setProviderForTests } from '../src/services/ai/provider.js';
import { getUsed } from '../src/services/ai/quota.js';
import {
    MAX_TOOL_STEPS,
    getAssistantStatus,
    runAssistantChat,
    runDisputeChat,
} from '../src/services/ai/chatService.js';

const PREFIX = 'aich';
const THIRD_EMAIL = `${PREFIX}_third@upra.com`;
const ADMIN_EMAIL = `${PREFIX}_admin@upra.com`;
const ALL_EMAILS = [...Object.values(pairEmails(PREFIX, 1)), THIRD_EMAIL, ADMIN_EMAIL];

const ask = (text = 'hello') => [{ role: 'user', content: text }];
const walletCall = () => ({ toolCalls: [{ name: 'getMyWallet', args: {} }], raw: [{ functionCall: { name: 'getMyWallet', args: {} } }] });

describe('AI chat service', () => {
    let pair;
    let third;
    let admin;
    let contract;
    let disputeId;

    beforeAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        pair = await registerPair(PREFIX, 1);
        third = await registerUser({ email: THIRD_EMAIL, password: PASSWORD, fullName: 'Third User', role: 'CLIENT' });
        admin = await registerAdmin(ADMIN_EMAIL);

        contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Chat milestone', amount: 50 }],
            title: 'AI chat job',
        });
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, contract.milestones[0]);
        const opened = await api.post(pair.c.token, `/api/milestones/${contract.milestones[0].id}/dispute`, {
            reason: 'Not what we agreed on',
        });
        if (opened.status !== 201) throw new Error(`dispute failed: ${JSON.stringify(opened.body)}`);
        disputeId = opened.body.dispute.id;
    });

    beforeEach(async () => {
        await prisma.aiUsage.deleteMany({
            where: { userId: { in: [pair.c.user.id, pair.f.user.id, third.user.id, admin.user.id] } },
        });
    });

    afterEach(() => {
        __setProviderForTests(null);
        delete process.env.AI_DAILY_LIMIT;
        delete process.env.AI_ADMIN_DAILY_LIMIT;
    });

    afterAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        await prisma.$disconnect();
    });

    it('answers a plain question and reports the remaining quota', async () => {
        const fake = createFakeProvider([{ text: 'Escrow holds the money until you approve.' }]);
        __setProviderForTests(fake);

        const res = await runAssistantChat({ user: pair.c.user, messages: ask('What is escrow?'), locale: 'en' });

        expect(res).toEqual({ reply: 'Escrow holds the money until you approve.', remainingToday: 19 });
        expect(fake.calls).toHaveLength(1);
        expect(fake.calls[0].messages).toEqual([{ role: 'user', text: 'What is escrow?' }]);
        expect(fake.calls[0].tools.map((t) => t.name)).toEqual([
            'getMyContracts',
            'getContract',
            'getMyProposals',
            'getMyWallet',
        ]);
        expect(await getUsed(pair.c.user.id, 'ASSISTANT')).toBe(1);
    });

    it('runs a tool and feeds the result back to the model', async () => {
        const fake = createFakeProvider([walletCall(), { text: 'Your wallet is empty.' }]);
        __setProviderForTests(fake);

        const res = await runAssistantChat({ user: third.user, messages: ask('How much money do I have?'), locale: 'en' });

        expect(res.reply).toBe('Your wallet is empty.');
        expect(fake.calls).toHaveLength(2);
        const secondCallMessages = fake.calls[1].messages;
        expect(secondCallMessages.at(-2)).toMatchObject({ role: 'model', toolCalls: [{ name: 'getMyWallet' }] });
        expect(secondCallMessages.at(-2).raw).toEqual([{ functionCall: { name: 'getMyWallet', args: {} } }]);
        expect(secondCallMessages.at(-1)).toEqual({
            role: 'tool',
            name: 'getMyWallet',
            result: { availableCents: 0, lockedCents: 0, currency: 'USD' },
        });
        // Bir istifadəçi mesajı = bir kvota vahidi, neçə alət çağırılsa da
        expect(await getUsed(third.user.id, 'ASSISTANT')).toBe(1);
    });

    it('survives a model that calls an unknown tool', async () => {
        const fake = createFakeProvider([
            { toolCalls: [{ name: 'dropEverything', args: { really: true } }] },
            { text: 'I could not do that.' },
        ]);
        __setProviderForTests(fake);

        const res = await runAssistantChat({ user: pair.c.user, messages: ask('delete my data'), locale: 'en' });

        expect(res.reply).toBe('I could not do that.');
        expect(fake.calls[1].messages.at(-1)).toEqual({ role: 'tool', name: 'dropEverything', result: { error: 'unknown_tool' } });
    });

    it(`gives up after ${MAX_TOOL_STEPS} provider steps with AI_BUSY and refunds the quota`, async () => {
        const fake = createFakeProvider(Array.from({ length: MAX_TOOL_STEPS + 1 }, walletCall));
        __setProviderForTests(fake);

        await expect(runAssistantChat({ user: pair.c.user, messages: ask(), locale: 'en' })).rejects.toMatchObject({
            statusCode: 503,
            errorCode: 'AI_BUSY',
        });
        expect(fake.calls).toHaveLength(MAX_TOOL_STEPS);
        expect(await getUsed(pair.c.user.id, 'ASSISTANT')).toBe(0);
    });

    it.each([
        ['busy', 'AI_BUSY'],
        ['blocked', 'AI_BUSY'],
        ['config', 'AI_NOT_CONFIGURED'],
    ])('maps a %s provider failure to %s and refunds the quota', async (kind, code) => {
        __setProviderForTests(createFakeProvider([new AiProviderError('provider said no', kind)]));

        await expect(runAssistantChat({ user: pair.c.user, messages: ask(), locale: 'en' })).rejects.toMatchObject({
            statusCode: 503,
            errorCode: code,
        });
        expect(await getUsed(pair.c.user.id, 'ASSISTANT')).toBe(0);
    });

    it('treats an empty answer as AI_BUSY and refunds', async () => {
        __setProviderForTests(createFakeProvider([{ text: '   ' }]));

        await expect(runAssistantChat({ user: pair.c.user, messages: ask(), locale: 'en' })).rejects.toMatchObject({
            errorCode: 'AI_BUSY',
        });
        expect(await getUsed(pair.c.user.id, 'ASSISTANT')).toBe(0);
    });

    it('rejects with AI_DAILY_LIMIT before calling the provider once the limit is reached', async () => {
        process.env.AI_DAILY_LIMIT = '2';
        const fake = createFakeProvider([{ text: 'one' }, { text: 'two' }, { text: 'three' }]);
        __setProviderForTests(fake);

        expect((await runAssistantChat({ user: pair.c.user, messages: ask(), locale: 'en' })).remainingToday).toBe(1);
        expect((await runAssistantChat({ user: pair.c.user, messages: ask(), locale: 'en' })).remainingToday).toBe(0);

        const blocked = runAssistantChat({ user: pair.c.user, messages: ask(), locale: 'en' });
        await expect(blocked).rejects.toMatchObject({ statusCode: 429, errorCode: 'AI_DAILY_LIMIT' });
        await expect(blocked).rejects.toHaveProperty('resetAt');
        expect(fake.calls).toHaveLength(2);
    });

    it('only mentions a viewed contract when the user is a party to it', async () => {
        const fake = createFakeProvider([{ text: 'a' }, { text: 'b' }, { text: 'c' }]);
        __setProviderForTests(fake);

        await runAssistantChat({ user: third.user, messages: ask(), locale: 'en', contractId: contract.id });
        await runAssistantChat({ user: pair.c.user, messages: ask(), locale: 'en', contractId: contract.id });
        await runAssistantChat({
            user: pair.c.user,
            messages: ask(),
            locale: 'en',
            contractId: '00000000-0000-4000-8000-000000000000',
        });

        expect(fake.calls[0].system).not.toContain(contract.id);
        expect(fake.calls[1].system).toContain(contract.id);
        expect(fake.calls[2].system).not.toContain('currently viewing');
    });

    it('is not available without a provider and does not touch the quota', async () => {
        const savedKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        try {
            await expect(runAssistantChat({ user: pair.c.user, messages: ask(), locale: 'en' })).rejects.toMatchObject({
                statusCode: 503,
                errorCode: 'AI_NOT_CONFIGURED',
            });
            expect(await getUsed(pair.c.user.id, 'ASSISTANT')).toBe(0);
            expect((await getAssistantStatus(pair.c.user)).enabled).toBe(false);
        } finally {
            if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
        }
    });

    it('reports status with a provider', async () => {
        __setProviderForTests(createFakeProvider([]));
        expect(await getAssistantStatus(pair.c.user)).toEqual({ enabled: true, dailyLimit: 20, remainingToday: 20 });
    });

    describe('dispute chat', () => {
        it('puts the dispute context in the prompt, uses no tools and counts on the DISPUTE counter', async () => {
            const fake = createFakeProvider([{ text: 'Consider a split.' }]);
            __setProviderForTests(fake);

            const res = await runDisputeChat({ admin: admin.user, disputeId, messages: ask('What do you think?'), locale: 'en' });

            expect(res).toEqual({ reply: 'Consider a split.', remainingToday: 49 });
            expect(fake.calls[0].system).toContain('DISPUTE UNDER REVIEW');
            expect(fake.calls[0].system).toContain('Chat milestone');
            expect(fake.calls[0].system).toContain('The admin makes the final decision');
            expect(fake.calls[0].tools).toEqual([]);
            expect(await getUsed(admin.user.id, 'DISPUTE')).toBe(1);
            expect(await getUsed(admin.user.id, 'ASSISTANT')).toBe(0);
        });

        it('returns 404 for an unknown dispute without reserving quota or calling the provider', async () => {
            const fake = createFakeProvider([{ text: 'never used' }]);
            __setProviderForTests(fake);

            await expect(
                runDisputeChat({ admin: admin.user, disputeId: '00000000-0000-4000-8000-000000000000', messages: ask(), locale: 'en' })
            ).rejects.toMatchObject({ statusCode: 404 });
            expect(fake.calls).toHaveLength(0);
            expect(await getUsed(admin.user.id, 'DISPUTE')).toBe(0);
        });

        it('enforces the admin daily limit', async () => {
            process.env.AI_ADMIN_DAILY_LIMIT = '1';
            __setProviderForTests(createFakeProvider([{ text: 'one' }, { text: 'two' }]));

            await runDisputeChat({ admin: admin.user, disputeId, messages: ask(), locale: 'en' });
            await expect(runDisputeChat({ admin: admin.user, disputeId, messages: ask(), locale: 'en' })).rejects.toMatchObject({
                errorCode: 'AI_DAILY_LIMIT',
            });
        });
    });
});
