import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, createJob, createProposal, registerUser } from './helpers/db.js';
import {
    PASSWORD,
    api,
    pairEmails,
    registerPair,
    createContractWithMilestones,
    fundAndSubmit,
    walletOf,
} from './helpers/p2.js';

// P2: dəyişiklik limiti + təhvil tarixçəsi (MilestoneSubmission). E-poçtlar "p2rev_" ilə başlayır.
const PREFIX = 'p2rev';
const MAX_PAIRS = 8;
const ALL_EMAILS = [
    `${PREFIX}_outsider@upra.com`,
    ...Array.from({ length: MAX_PAIRS }, (_, i) => Object.values(pairEmails(PREFIX, i + 1))).flat(),
];

describe('Phase 2 revision limit and submission history', () => {
    let counter = 0;
    let outsider;

    const newPair = async () => {
        counter += 1;
        if (counter > MAX_PAIRS) throw new Error('Increase MAX_PAIRS in p2-revision.test.js');
        return registerPair(PREFIX, counter);
    };

    const history = (token, contractId) => api.get(token, `/api/contracts/${contractId}/history`);

    beforeAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        outsider = await registerUser({
            email: `${PREFIX}_outsider@upra.com`,
            password: PASSWORD,
            fullName: 'Revision Outsider',
            role: 'CLIENT',
        });
    });

    afterAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        await prisma.$disconnect();
    });

    it('records the submission and each accepted change request with revision numbers', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Design', amount: 100, maxRevisions: 2 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);

        let res = await history(pair.c.token, contract.id);
        expect(res.status).toBe(200);
        expect(res.body.submissions).toHaveLength(1);
        expect(res.body.submissions[0]).toMatchObject({
            type: 'SUBMITTED',
            revisionNumber: 0,
            milestoneId: milestone.id,
        });
        expect(res.body.submissions[0].actor.id).toBe(pair.f.user.id);
        expect(res.body.submissions[0].milestone).toMatchObject({ id: milestone.id, sequence: 1 });

        const changes = await api.post(pair.c.token, `/api/milestones/${milestone.id}/request-changes`, {
            note: 'Please fix the spacing',
        });
        expect(changes.status).toBe(200);
        expect(changes.body.milestone).toMatchObject({
            status: 'FUNDED',
            revisionCount: 1,
            submittedAt: null,
        });

        res = await history(pair.c.token, contract.id);
        expect(res.body.submissions.map((s) => [s.type, s.revisionNumber])).toEqual([
            ['SUBMITTED', 0],
            ['CHANGES_REQUESTED', 1],
        ]);
        expect(res.body.submissions[1].note).toBe('Please fix the spacing');
        expect(res.body.submissions[1].actor.id).toBe(pair.c.user.id);

        // Pul escrow-da qalır, dəyişiklik tələbi pul hərəkəti etmir
        expect(await walletOf(pair.c.user.id)).toMatchObject({ availableCents: 0, lockedCents: 10000 });
    });

    it('stops at maxRevisions, keeps the last submission in review and still allows approval', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Two revisions', amount: 40, maxRevisions: 2 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);

        expect((await api.post(pair.c.token, `/api/milestones/${milestone.id}/request-changes`)).status).toBe(200);
        expect((await api.post(pair.f.token, `/api/milestones/${milestone.id}/submit`)).status).toBe(200);
        expect((await api.post(pair.c.token, `/api/milestones/${milestone.id}/request-changes`)).status).toBe(200);
        expect((await api.post(pair.f.token, `/api/milestones/${milestone.id}/submit`)).status).toBe(200);

        const blocked = await api.post(pair.c.token, `/api/milestones/${milestone.id}/request-changes`, {
            note: 'One more please',
        });
        expect(blocked.status).toBe(409);
        expect(blocked.body.message).toMatch(/Revision limit reached \(2\/2\)/);

        const row = await prisma.milestone.findUnique({ where: { id: milestone.id } });
        expect(row).toMatchObject({ status: 'IN_REVIEW', revisionCount: 2, maxRevisions: 2 });

        const res = await history(pair.c.token, contract.id);
        expect(res.body.submissions.map((s) => [s.type, s.revisionNumber])).toEqual([
            ['SUBMITTED', 0],
            ['CHANGES_REQUESTED', 1],
            ['SUBMITTED', 1],
            ['CHANGES_REQUESTED', 2],
            ['SUBMITTED', 2],
        ]);

        const approved = await api.post(pair.c.token, `/api/milestones/${milestone.id}/approve`);
        expect(approved.status).toBe(200);
        expect(approved.body.milestone.status).toBe('PAID');
    });

    it('supports maxRevisions = 0 (no revisions allowed)', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'No revisions', amount: 30, maxRevisions: 0 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);

        const changes = await api.post(pair.c.token, `/api/milestones/${milestone.id}/request-changes`);
        expect(changes.status).toBe(409);
        expect(changes.body.message).toMatch(/Revision limit reached \(0\/0\)/);

        const row = await prisma.milestone.findUnique({ where: { id: milestone.id } });
        expect(row).toMatchObject({ status: 'IN_REVIEW', revisionCount: 0 });

        const res = await history(pair.c.token, contract.id);
        expect(res.body.submissions.map((s) => s.type)).toEqual(['SUBMITTED']);
    });

    it('does not count rejected change requests as revisions', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Guarded', amount: 20, maxRevisions: 2 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);

        // IN_REVIEW-da ikinci dəfə submit etmək olmur; rədd olunan sorğu sayğacı artırmır
        expect((await api.post(pair.f.token, `/api/milestones/${milestone.id}/submit`)).status).toBe(409);
        expect((await prisma.milestone.findUnique({ where: { id: milestone.id } })).revisionCount).toBe(0);

        // Yanlış statusda (FUNDED) dəyişiklik tələbi 409 qaytarır və sayğac dəyişmir
        expect((await api.post(pair.c.token, `/api/milestones/${milestone.id}/request-changes`)).status).toBe(200);
        expect((await api.post(pair.c.token, `/api/milestones/${milestone.id}/request-changes`)).status).toBe(409);
        expect((await prisma.milestone.findUnique({ where: { id: milestone.id } })).revisionCount).toBe(1);

        const res = await history(pair.c.token, contract.id);
        expect(res.body.submissions.map((s) => s.type)).toEqual(['SUBMITTED', 'CHANGES_REQUESTED']);
    });

    it('only contract parties can read the history', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Private', amount: 10 }],
        });

        expect((await history(outsider.token, contract.id)).status).toBe(403);
        expect((await history(pair.c.token, contract.id)).body).toMatchObject({ submissions: [], disputes: [] });
    });

    it('validates maxRevisions (0..10) when creating a contract', async () => {
        const pair = await newPair();
        const job = await createJob(pair.c.token, { title: 'Bad revision plan', budget: 100 });
        const proposal = await createProposal(pair.f.token, job.id, { bidAmount: 100 });

        const tooMany = await api.post(pair.c.token, '/api/contracts', {
            proposalId: proposal.id,
            milestones: [{ title: 'Nope', amount: 100, maxRevisions: 11 }],
        });
        expect(tooMany.status).toBe(400);

        const negative = await api.post(pair.c.token, '/api/contracts', {
            proposalId: proposal.id,
            milestones: [{ title: 'Nope', amount: 100, maxRevisions: -1 }],
        });
        expect(negative.status).toBe(400);

        const fractional = await api.post(pair.c.token, '/api/contracts', {
            proposalId: proposal.id,
            milestones: [{ title: 'Nope', amount: 100, maxRevisions: 1.5 }],
        });
        expect(fractional.status).toBe(400);

        // Heç bir müqavilə yaradılmadı
        expect(await prisma.contract.count({ where: { jobPostId: job.id } })).toBe(0);
    });
});
