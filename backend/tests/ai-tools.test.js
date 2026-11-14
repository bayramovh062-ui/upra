import { prisma, cleanUpUsers, registerUser } from './helpers/db.js';
import { PASSWORD, pairEmails, registerPair, createContractWithMilestones } from './helpers/p2.js';
import { topUp } from '../src/services/financialService.js';
import { redactText, truncate } from '../src/services/ai/redact.js';
import { TOOL_DEFINITIONS, runTool } from '../src/services/ai/tools.js';

const PREFIX = 'aitl';
const THIRD_EMAIL = `${PREFIX}_third@upra.com`;
const ALL_EMAILS = [...Object.values(pairEmails(PREFIX, 1)), THIRD_EMAIL];

describe('AI redaction helpers', () => {
    it('hides emails and phone numbers', () => {
        const out = redactText('mail me at a.b@x.com or +994 50 123 45 67 please');
        expect(out).not.toContain('a.b@x.com');
        expect(out).not.toContain('123 45 67');
        expect(out).toContain('[gizlədilib]');
    });

    it('keeps short numbers such as amounts', () => {
        expect(redactText('Milestone 2 costs 15000 cents')).toBe('Milestone 2 costs 15000 cents');
    });

    it('truncates with an ellipsis only when needed', () => {
        expect(truncate('abcdef', 3)).toBe('abc…');
        expect(truncate('abc', 3)).toBe('abc');
    });
});

describe('AI read-only tools', () => {
    let pair;
    let third;
    let contract;

    beforeAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        pair = await registerPair(PREFIX, 1);
        third = await registerUser({
            email: THIRD_EMAIL,
            password: PASSWORD,
            fullName: 'Third User',
            role: 'CLIENT',
        });
        contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [
                { title: 'Design', amount: 40 },
                { title: 'Build', amount: 60 },
            ],
        });
    });

    afterAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        await prisma.$disconnect();
    });

    it('exposes exactly the four read-only tools', () => {
        expect(TOOL_DEFINITIONS.map((d) => d.name)).toEqual([
            'getMyContracts',
            'getContract',
            'getMyProposals',
            'getMyWallet',
        ]);
    });

    it('getMyContracts lists my contracts with my role', async () => {
        const asClient = await runTool('getMyContracts', {}, pair.c.user);
        expect(asClient.contracts).toHaveLength(1);
        expect(asClient.contracts[0]).toMatchObject({ id: contract.id, myRole: 'client', milestoneCount: 2 });

        const asFreelancer = await runTool('getMyContracts', {}, pair.f.user);
        expect(asFreelancer.contracts[0]).toMatchObject({ id: contract.id, myRole: 'freelancer' });

        expect((await runTool('getMyContracts', {}, third.user)).contracts).toEqual([]);
    });

    it('getContract returns milestones with exact amounts', async () => {
        const res = await runTool('getContract', { contractId: contract.id }, pair.f.user);
        expect(res.id).toBe(contract.id);
        expect(res.myRole).toBe('freelancer');
        expect(res.milestones.map((m) => [m.title, m.amountCents, m.status])).toEqual([
            ['Design', 4000, 'PENDING'],
            ['Build', 6000, 'PENDING'],
        ]);
        expect(res.cancelRequest).toBeNull();
    });

    it('getContract answers identically for another user, a missing id and invalid ids', async () => {
        const other = await runTool('getContract', { contractId: contract.id }, third.user);
        const missing = await runTool(
            'getContract',
            { contractId: '00000000-0000-4000-8000-000000000000' },
            pair.c.user
        );
        expect(other).toEqual({ error: 'not_found' });
        expect(missing).toEqual({ error: 'not_found' });
        expect(await runTool('getContract', { contractId: 'not-a-uuid' }, pair.c.user)).toEqual({
            error: 'invalid_args',
        });
        expect(await runTool('getContract', {}, pair.c.user)).toEqual({ error: 'invalid_args' });
    });

    it('getMyProposals returns the freelancer bid and nothing for a client', async () => {
        const res = await runTool('getMyProposals', {}, pair.f.user);
        expect(res.proposals).toHaveLength(1);
        expect(res.proposals[0]).toMatchObject({ bidAmount: 100, status: 'ACCEPTED' });
        expect((await runTool('getMyProposals', {}, pair.c.user)).proposals).toEqual([]);
    });

    it('getMyWallet matches the database and defaults to zero', async () => {
        expect(await runTool('getMyWallet', {}, third.user)).toEqual({
            availableCents: 0,
            lockedCents: 0,
            currency: 'USD',
        });

        await topUp(pair.c.user.id, 2500);
        const wallet = await prisma.wallet.findUnique({ where: { userId: pair.c.user.id } });
        expect(await runTool('getMyWallet', {}, pair.c.user)).toEqual({
            availableCents: wallet.availableCents,
            lockedCents: wallet.lockedCents,
            currency: 'USD',
        });
    });

    it('never leaks email, password hash or tokens in any result', async () => {
        const results = [
            await runTool('getMyContracts', {}, pair.c.user),
            await runTool('getContract', { contractId: contract.id }, pair.c.user),
            await runTool('getMyProposals', {}, pair.f.user),
            await runTool('getMyWallet', {}, pair.c.user),
        ];
        const json = JSON.stringify(results).toLowerCase();
        for (const secret of [
            pair.c.user.email,
            pair.f.user.email,
            'passwordhash',
            'token',
            pair.c.token,
            pair.c.user.fullName,
            pair.f.user.fullName,
        ]) {
            expect(json).not.toContain(String(secret).toLowerCase());
        }
    });

    it('rejects unknown tools without throwing', async () => {
        expect(await runTool('deleteEverything', {}, pair.c.user)).toEqual({ error: 'unknown_tool' });
    });
});
