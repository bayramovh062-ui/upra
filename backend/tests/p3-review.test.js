import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, registerUser, payAllMilestones } from './helpers/db.js';
import {
    PASSWORD,
    api,
    pairEmails,
    registerPair,
    registerAdmin,
    createContractWithMilestones,
    fundAndSubmit,
} from './helpers/p2.js';

// P3: post-contract rəylər, reputasiya və completion semantikası. E-poçtlar "p3rev_" ilə başlayır.
const PREFIX = 'p3rev';
const ADMIN_EMAIL = `${PREFIX}_admin@upra.com`;
const OUTSIDER_EMAIL = `${PREFIX}_outsider@upra.com`;
const PAIR = pairEmails(PREFIX, 1);
const ALL_EMAILS = [ADMIN_EMAIL, OUTSIDER_EMAIL, PAIR.client, PAIR.freelancer];

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Phase 3 reviews, reputation and completion', () => {
    let admin;
    let outsider;
    let pair;
    let completedContract;

    const createCompletedContract = async (title) => {
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Final delivery', amount: 100 }],
            title,
        });
        await payAllMilestones(pair.c.user.id, pair.f.user.id, contract.id);
        const completed = await api.patch(pair.c.token, `/api/contracts/${contract.id}/complete`);
        expect(completed.status).toBe(200);
        expect(completed.body.contract.status).toBe('COMPLETED');
        return completed.body.contract;
    };

    beforeAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        admin = await registerAdmin(ADMIN_EMAIL);
        pair = await registerPair(PREFIX, 1);
        outsider = await registerUser({
            email: OUTSIDER_EMAIL,
            password: PASSWORD,
            fullName: 'Review Outsider',
            role: 'CLIENT',
        });
    });

    afterAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
    });

    it('reveals reviews only to contract parties and blocks reviews before completion', async () => {
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            title: 'Not completed yet',
        });

        // Tərəf olmayan şəxs rəyləri görə və yaza bilməz
        expect((await api.get(outsider.token, `/api/contracts/${contract.id}/reviews`)).status).toBe(403);
        expect(
            (
                await api.post(outsider.token, `/api/contracts/${contract.id}/reviews`, { rating: 1 })
            ).status
        ).toBe(403);

        // COMPLETED olmayan müqavilə üçün rəy yazıla bilməz (hər iki tərəf üçün)
        expect((await api.post(pair.c.token, `/api/contracts/${contract.id}/reviews`, { rating: 5 })).status).toBe(400);
        expect((await api.post(pair.f.token, `/api/contracts/${contract.id}/reviews`, { rating: 5 })).status).toBe(400);

        const listed = await api.get(pair.c.token, `/api/contracts/${contract.id}/reviews`);
        expect(listed.status).toBe(200);
        expect(listed.body.reviews).toEqual([]);
        expect(listed.body.eligibility).toMatchObject({
            canReview: false,
            alreadyReviewed: false,
            revieweeId: pair.f.user.id,
        });
    });

    it('lets each party create exactly one immutable review after completion', async () => {
        completedContract = await createCompletedContract('Completed review contract');

        const clientReview = await api.post(pair.c.token, `/api/contracts/${completedContract.id}/reviews`, {
            rating: 5,
            comment: 'Excellent communication and fast delivery.',
        });
        expect(clientReview.status).toBe(201);
        expect(clientReview.body.review).toMatchObject({
            contractId: completedContract.id,
            rating: 5,
            comment: 'Excellent communication and fast delivery.',
            reviewer: { id: pair.c.user.id },
            reviewee: { id: pair.f.user.id },
        });

        // Təkrar cəhd 409 (duplicate yaranmır)
        const duplicate = await api.post(pair.c.token, `/api/contracts/${completedContract.id}/reviews`, {
            rating: 1,
            comment: 'Changed my mind',
        });
        expect(duplicate.status).toBe(409);

        const freelancerReview = await api.post(pair.f.token, `/api/contracts/${completedContract.id}/reviews`, {
            rating: 4,
            comment: 'Clear requirements and prompt funding.',
        });
        expect(freelancerReview.status).toBe(201);
        expect(freelancerReview.body.review.reviewee.id).toBe(pair.c.user.id);

        const count = await prisma.review.count({ where: { contractId: completedContract.id } });
        expect(count).toBe(2);

        const clientView = await api.get(pair.c.token, `/api/contracts/${completedContract.id}/reviews`);
        expect(clientView.status).toBe(200);
        expect(clientView.body.reviews).toHaveLength(2);
        expect(clientView.body.eligibility).toMatchObject({
            canReview: false,
            alreadyReviewed: true,
            revieweeId: pair.f.user.id,
        });
        expect(clientView.body.eligibility.reason).toMatch(/already reviewed/i);

        // Rəy immutabledır: redaktə/silmə endpointi yoxdur
        const reviewId = clientView.body.reviews.find((r) => r.reviewer.id === pair.c.user.id).id;
        const immutable = await api.patch(pair.c.token, `/api/contracts/${completedContract.id}/reviews/${reviewId}`, {});
        expect([404, 405]).toContain(immutable.status);
    });

    it('validates rating and comment length', async () => {
        const body = (overrides) => ({ rating: 5, ...overrides });
        const token = pair.f.token;
        const url = `/api/contracts/${completedContract.id}/reviews`;

        // Frilanser artıq rəy yazıb, amma validasiya controller-dən əvvəl işləyir
        expect((await api.post(token, url, body({ rating: 0 }))).status).toBe(400);
        expect((await api.post(token, url, body({ rating: 6 }))).status).toBe(400);
        expect((await api.post(token, url, body({ rating: 1.5 }))).status).toBe(400);
        expect((await api.post(token, url, {})).status).toBe(400);
        expect((await api.post(token, url, body({ comment: 'x'.repeat(1001) }))).status).toBe(400);
    });

    it('exposes derived reputation to public profile viewers and respects profile visibility', async () => {
        const profile = await api.get(pair.c.token, `/api/users/${pair.f.user.id}`);
        expect(profile.status).toBe(200);
        expect(profile.body.stats).toMatchObject({ avgRating: 5, reviewCount: 1, completedContracts: 1 });

        // Bildiriş: rəy alan tərəf (frilanser) REVIEW_RECEIVED alır
        const notifications = await api.get(pair.f.token, '/api/notifications?limit=100');
        expect(notifications.status).toBe(200);
        expect(
            notifications.body.notifications.some(
                (n) => n.type === 'REVIEW_RECEIVED' && n.data?.contractId === completedContract.id
            )
        ).toBe(true);

        // Gizli profil: reputasiya da göstərilmir
        const hidden = await api.patch(pair.f.token, '/api/auth/update-me', { profilePublic: false });
        expect(hidden.status).toBe(200);
        const hiddenProfile = await api.get(pair.c.token, `/api/users/${pair.f.user.id}`);
        expect(hiddenProfile.status).toBe(200);
        expect(hiddenProfile.body.user).toMatchObject({ id: pair.f.user.id, profilePublic: false });
        expect(hiddenProfile.body.stats).toBeNull();

        await api.patch(pair.f.token, '/api/auth/update-me', { profilePublic: true });
    });

    it('keeps completion authorized and idempotent, and refuses to complete disputed escrow', async () => {
        // Təkrar complete: 200, yan təsir yoxdur
        const repeated = await api.patch(pair.c.token, `/api/contracts/${completedContract.id}/complete`);
        expect(repeated.status).toBe(200);
        expect(repeated.body.contract.status).toBe('COMPLETED');

        // Yalnız client complete edə bilər
        expect((await api.patch(pair.f.token, `/api/contracts/${completedContract.id}/complete`)).status).toBe(403);
        expect((await api.patch(outsider.token, `/api/contracts/${completedContract.id}/complete`)).status).toBe(403);

        // Açıq dispute/escrow olan müqavilə complete oluna bilməz
        const disputedContract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Disputed delivery', amount: 50 }],
            title: 'Disputed completion',
        });
        const milestone = disputedContract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);
        const opened = await api.post(pair.f.token, `/api/milestones/${milestone.id}/dispute`, {
            reason: 'The delivered work does not match the agreed scope',
        });
        expect(opened.status).toBe(201);

        const blocked = await api.patch(pair.c.token, `/api/contracts/${disputedContract.id}/complete`);
        expect(blocked.status).toBe(400);

        const fresh = await prisma.contract.findUnique({ where: { id: disputedContract.id } });
        expect(fresh.status).toBe('ACTIVE');
        const freshMilestone = await prisma.milestone.findUnique({ where: { id: milestone.id } });
        expect(freshMilestone.status).toBe('DISPUTED');

        // Admin review endpointi də yoxdur (rəylər yalnız tərəflər üçün)
        expect((await api.get(admin.token, `/api/contracts/${completedContract.id}/reviews`)).status).toBe(403);
    });

    it('returns 404 for reviews of a missing contract', async () => {
        expect((await api.get(pair.c.token, `/api/contracts/${MISSING_ID}/reviews`)).status).toBe(404);
        expect((await api.post(pair.c.token, `/api/contracts/${MISSING_ID}/reviews`, { rating: 5 })).status).toBe(404);
    });
});
