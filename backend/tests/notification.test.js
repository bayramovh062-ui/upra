import request from 'supertest';
import {
    app,
    prisma,
    auth,
    cleanUpUsers,
    registerUser,
    createJob,
    createProposal,
    fundContract,
} from './helpers/db.js';
import { topUp, fundMilestone, submitMilestone, autoApproveDue } from '../src/services/financialService.js';
import { notify } from '../src/services/notificationService.js';

const PASSWORD = 'Password123!';
const emails = ['ntf_client@upra.com', 'ntf_free@upra.com', 'ntf_other@upra.com'];
const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const DAY_MS = 24 * 60 * 60 * 1000;

// P1: tətbiqdaxili bildirişlər. Hər hadisə doğru şəxsə, doğru mətnlə və linklə yazılır.
describe('Notifications', () => {
    let client;
    let freelancer;
    let other;

    const list = (user, query = '') => request(app).get(`/api/notifications${query}`).set(auth(user.token));
    const types = async (user) => (await list(user, '?limit=100')).body.notifications.map((n) => n.type);
    const clearAll = () => prisma.notification.deleteMany({ where: { userId: { in: [client.user.id, freelancer.user.id, other.user.id] } } });

    // Təklif göndərilir, client müqavilə təklifi göndərir, frilanser qəbul edir (hamısı HTTP ilə)
    const offerAndAccept = async (milestones) => {
        const total = milestones.reduce((sum, m) => sum + m.amount, 0);
        const job = await createJob(client.token, { title: 'Notification test job', budget: total + 100 });
        const proposal = await createProposal(freelancer.token, job.id, { bidAmount: total });
        const created = await request(app)
            .post('/api/contracts')
            .set(auth(client.token))
            .send({ proposalId: proposal.id, milestones });
        expect(created.status).toBe(201);
        const accepted = await request(app)
            .patch(`/api/contracts/${created.body.contract.id}/accept`)
            .set(auth(freelancer.token));
        expect(accepted.status).toBe(200);
        return { job, contract: accepted.body.contract };
    };

    beforeAll(async () => {
        await cleanUpUsers(emails);
        client = await registerUser({ email: emails[0], password: PASSWORD, fullName: 'Ntf Client', role: 'CLIENT' });
        freelancer = await registerUser({ email: emails[1], password: PASSWORD, fullName: 'Ntf Freelancer', role: 'FREELANCER' });
        other = await registerUser({ email: emails[2], password: PASSWORD, fullName: 'Ntf Other', role: 'FREELANCER' });
    });

    afterAll(async () => {
        await cleanUpUsers(emails);
        await prisma.$disconnect();
    });

    describe('API', () => {
        beforeEach(clearAll);

        it('requires authentication', async () => {
            expect((await request(app).get('/api/notifications')).status).toBe(401);
            expect((await request(app).get('/api/notifications/unread-count')).status).toBe(401);
            expect((await request(app).patch('/api/notifications/read-all')).status).toBe(401);
        });

        it('returns an empty list with a zero unread count for a new user', async () => {
            const res = await list(client);
            expect(res.status).toBe(200);
            expect(res.body.notifications).toEqual([]);
            expect(res.body.unreadCount).toBe(0);
        });

        it('lists newest first, filters unread, limits, and reports the full unread count', async () => {
            // Açıq vaxt: eyni millisaniyədə yaranan yazılar sıranı qeyri-müəyyən edər
            const base = Date.now() - 60_000;
            for (let i = 1; i <= 5; i += 1) {
                await prisma.notification.create({
                    data: {
                        userId: client.user.id,
                        type: 'TEST',
                        title: `Note ${i}`,
                        body: `Body ${i}`,
                        createdAt: new Date(base + i * 1000),
                    },
                });
            }
            const all = await list(client);
            expect(all.body.notifications.map((n) => n.title)).toEqual(['Note 5', 'Note 4', 'Note 3', 'Note 2', 'Note 1']);

            const limited = await list(client, '?limit=2');
            expect(limited.body.notifications).toHaveLength(2);
            expect(limited.body.unreadCount).toBe(5); // limitdən asılı deyil

            await request(app).patch(`/api/notifications/${all.body.notifications[0].id}/read`).set(auth(client.token));
            const unread = await list(client, '?unread=true');
            expect(unread.body.notifications).toHaveLength(4);
            expect(unread.body.unreadCount).toBe(4);

            // Yanlış limit dəyəri susmaya düşür, 500 olmur
            expect((await list(client, '?limit=abc')).status).toBe(200);
            expect((await list(client, '?limit=-3')).status).toBe(200);
        });

        it('marks one notification read, idempotently, and returns the new unread count', async () => {
            const n = await notify(client.user.id, { type: 'TEST', title: 'One' });
            await notify(client.user.id, { type: 'TEST', title: 'Two' });

            const first = await request(app).patch(`/api/notifications/${n.id}/read`).set(auth(client.token));
            expect(first.status).toBe(200);
            expect(first.body.notification.readAt).toBeTruthy();
            expect(first.body.unreadCount).toBe(1);

            const readAt = first.body.notification.readAt;
            const again = await request(app).patch(`/api/notifications/${n.id}/read`).set(auth(client.token));
            expect(again.status).toBe(200);
            expect(again.body.notification.readAt).toBe(readAt); // vaxt dəyişmir
            expect(again.body.unreadCount).toBe(1);
        });

        it("does not let a user read someone else's notification, and hides its existence", async () => {
            const n = await notify(client.user.id, { type: 'TEST', title: 'Private' });

            const res = await request(app).patch(`/api/notifications/${n.id}/read`).set(auth(freelancer.token));
            expect(res.status).toBe(404);
            expect((await prisma.notification.findUnique({ where: { id: n.id } })).readAt).toBeNull();

            expect((await request(app).patch(`/api/notifications/${MISSING_ID}/read`).set(auth(client.token))).status).toBe(404);
            expect((await list(freelancer)).body.notifications).toHaveLength(0);
        });

        it('marks everything read for the caller only', async () => {
            await notify(client.user.id, { type: 'TEST', title: 'A' });
            await notify(client.user.id, { type: 'TEST', title: 'B' });
            await notify(freelancer.user.id, { type: 'TEST', title: 'Not yours' });

            const res = await request(app).patch('/api/notifications/read-all').set(auth(client.token));
            expect(res.status).toBe(200);
            expect(res.body.updated).toBe(2);
            expect(res.body.unreadCount).toBe(0);

            const count = await request(app).get('/api/notifications/unread-count').set(auth(client.token));
            expect(count.body.unreadCount).toBe(0);
            expect((await request(app).get('/api/notifications/unread-count').set(auth(freelancer.token))).body.unreadCount).toBe(1);
        });
    });

    describe('events', () => {
        beforeEach(clearAll);

        it('tells the client about a new proposal, with a link to the proposals page', async () => {
            const job = await createJob(client.token, { title: 'Proposal notification job' });
            await createProposal(freelancer.token, job.id);

            const res = await list(client);
            expect(res.body.unreadCount).toBe(1);
            const n = res.body.notifications[0];
            expect(n.type).toBe('PROPOSAL_RECEIVED');
            expect(n.body).toContain('Ntf Freelancer');
            expect(n.body).toContain('Proposal notification job');
            expect(n.link).toBe(`/client/jobs/${job.id}/proposals`);

            // Göndərənə bildiriş getmir
            expect(await types(freelancer)).toEqual([]);
        });

        it('covers the offer, acceptance and decline flow', async () => {
            const job = await createJob(client.token, { title: 'Offer notification job' });
            const proposal = await createProposal(freelancer.token, job.id, { bidAmount: 100 });
            await clearAll();

            const offer = await request(app).post('/api/contracts').set(auth(client.token)).send({ proposalId: proposal.id });
            const contractId = offer.body.contract.id;

            const offered = (await list(freelancer)).body.notifications;
            expect(offered.map((n) => n.type)).toEqual(['CONTRACT_OFFERED']);
            // Frilanser təklifi workspace-dən əvvəl "My proposals" səhifəsində qəbul/rədd edir
            expect(offered[0].link).toBe('/freelancer/proposals');
            expect(offered[0].data).toMatchObject({ contractId });
            expect(await types(client)).toEqual([]);

            await request(app).patch(`/api/contracts/${contractId}/accept`).set(auth(freelancer.token));
            const accepted = (await list(client)).body.notifications;
            expect(accepted.map((n) => n.type)).toEqual(['CONTRACT_ACCEPTED']);
            expect(accepted[0].link).toBe(`/contracts/${contractId}?tab=escrow`);

            // Rədd: başqa iş və təklif
            const job2 = await createJob(client.token, { title: 'Declined notification job' });
            const proposal2 = await createProposal(freelancer.token, job2.id, { bidAmount: 50 });
            await clearAll();
            const offer2 = await request(app).post('/api/contracts').set(auth(client.token)).send({ proposalId: proposal2.id });
            await request(app).patch(`/api/contracts/${offer2.body.contract.id}/decline`).set(auth(freelancer.token));

            expect(await types(client)).toEqual(['CONTRACT_DECLINED']);
        });

        it('follows a milestone from funding to payment, each step to the right person', async () => {
            const { contract } = await offerAndAccept([{ title: 'Design', amount: 100 }]);
            const m = contract.milestones[0];
            await clearAll();

            await topUp(client.user.id, m.amountCents);
            await fundMilestone(m.id, client.user.id);
            let notes = (await list(freelancer)).body.notifications;
            expect(notes.map((n) => n.type)).toEqual(['MILESTONE_FUNDED']);
            expect(notes[0].body).toContain('$100.00');
            expect(notes[0].link).toBe(`/contracts/${contract.id}?tab=escrow`);
            expect(await types(client)).toEqual([]);

            await request(app).post(`/api/milestones/${m.id}/submit`).set(auth(freelancer.token));
            expect(await types(client)).toEqual(['MILESTONE_SUBMITTED']);

            await request(app).post(`/api/milestones/${m.id}/request-changes`).set(auth(client.token));
            expect(await types(freelancer)).toEqual(['CHANGES_REQUESTED', 'MILESTONE_FUNDED']);

            await request(app).post(`/api/milestones/${m.id}/submit`).set(auth(freelancer.token));
            const approve = await request(app).post(`/api/milestones/${m.id}/approve`).set(auth(client.token));
            expect(approve.status).toBe(200);

            notes = (await list(freelancer, '?limit=100')).body.notifications;
            const paid = notes.find((n) => n.type === 'MILESTONE_PAID');
            expect(paid.body).toContain('$90.00'); // 100 - 10% komissiya
            expect(paid.body).toContain('$10.00');
        });

        it('does not notify anyone when a milestone action is rejected', async () => {
            const { contract } = await offerAndAccept([{ title: 'Guarded', amount: 20 }]);
            const m = contract.milestones[0];
            await clearAll();

            // PENDING mərhələni təhvil vermək olmur (409): bildiriş də yaranmır
            const res = await request(app).post(`/api/milestones/${m.id}/submit`).set(auth(freelancer.token));
            expect(res.status).toBe(409);
            expect(await types(client)).toEqual([]);

            // Frilanser maliyyələşdirə bilməz (403)
            expect((await request(app).post(`/api/milestones/${m.id}/fund`).set(auth(freelancer.token))).status).toBe(403);
            expect(await types(freelancer)).toEqual([]);
        });

        it('tells both parties about an automatic approval', async () => {
            const { contract } = await offerAndAccept([{ title: 'Auto', amount: 100 }]);
            const m = contract.milestones[0];
            await topUp(client.user.id, m.amountCents);
            await fundMilestone(m.id, client.user.id);
            await submitMilestone(m.id, freelancer.user.id);
            await prisma.milestone.update({ where: { id: m.id }, data: { submittedAt: new Date(Date.now() - 8 * DAY_MS) } });
            await clearAll();

            await autoApproveDue();

            expect(await types(freelancer)).toEqual(
                expect.arrayContaining(['MILESTONE_AUTO_APPROVED', 'CONTRACT_COMPLETED'])
            );
            expect(await types(client)).toEqual(
                expect.arrayContaining(['MILESTONE_AUTO_APPROVED', 'CONTRACT_COMPLETED'])
            );
        });

        it('covers the cancellation request, decline, withdraw, acceptance and direct cancel', async () => {
            const { contract } = await offerAndAccept([{ title: 'Cancelled', amount: 100 }]);
            await fundContract(client.user.id, contract.id);
            const card = await request(app)
                .post(`/api/contracts/${contract.id}/issues`)
                .set(auth(client.token))
                .send({ title: 'Started work' });
            await request(app)
                .patch(`/api/issues/${card.body.issue.id}/move`)
                .set(auth(freelancer.token))
                .send({ status: 'IN_PROGRESS', position: 1000 });
            await clearAll();

            const patch = (user, action, body) =>
                request(app).patch(`/api/contracts/${contract.id}/${action}`).set(auth(user.token)).send(body ?? {});

            await patch(client, 'cancel-request', { reason: 'Changed plans' });
            const asked = (await list(freelancer)).body.notifications;
            expect(asked.map((n) => n.type)).toEqual(['CANCEL_REQUESTED']);
            expect(asked[0].body).toContain('Changed plans');

            await patch(freelancer, 'cancel-request/decline');
            expect(await types(client)).toEqual(['CANCEL_DECLINED']);

            await patch(client, 'cancel-request');
            await patch(client, 'cancel-request/withdraw');
            expect((await types(freelancer)).slice(0, 2)).toEqual(['CANCEL_WITHDRAWN', 'CANCEL_REQUESTED']);

            await patch(freelancer, 'cancel-request');
            await patch(client, 'cancel-request/accept');
            expect((await types(freelancer))[0]).toBe('CONTRACT_CANCELLED');

            // Başlamamış müqavilənin birbaşa ləğvi qarşı tərəfə bildirilir
            const second = await offerAndAccept([{ title: 'Direct', amount: 40 }]);
            await clearAll();
            await request(app).patch(`/api/contracts/${second.contract.id}/cancel`).set(auth(freelancer.token));
            expect(await types(client)).toEqual(['CONTRACT_CANCELLED']);
        });

        it('tells both parties when the final milestone completes the contract automatically', async () => {
            const { contract } = await offerAndAccept([{ title: 'Whole job', amount: 30 }]);
            const m = contract.milestones[0];
            await topUp(client.user.id, m.amountCents);
            await fundMilestone(m.id, client.user.id);
            await submitMilestone(m.id, freelancer.user.id);
            await clearAll();

            const approved = await request(app).post(`/api/milestones/${m.id}/approve`).set(auth(client.token));
            expect(approved.status).toBe(200);

            const freelancerTypes = await types(freelancer);
            expect(freelancerTypes).toEqual(
                expect.arrayContaining(['MILESTONE_PAID', 'CONTRACT_COMPLETED'])
            );
            expect(await types(client)).toContain('CONTRACT_COMPLETED');

            const notes = (await list(freelancer, '?limit=100')).body.notifications;
            const completed = notes.find((n) => n.type === 'CONTRACT_COMPLETED');
            expect(completed.body).toMatch(/automatically/i);
            expect(completed.data).toMatchObject({ contractId: contract.id, automatic: true });
            expect((await prisma.contract.findUnique({ where: { id: contract.id } })).status).toBe('COMPLETED');
        });
    });

    describe('robustness', () => {
        it('never throws when the notification cannot be written (unknown user)', async () => {
            await expect(notify(MISSING_ID, { type: 'TEST', title: 'Nobody' })).resolves.toBeNull();
            await expect(notify(null, { type: 'TEST', title: 'Nobody' })).resolves.toBeNull();
        });

        it('deletes notifications together with the user', async () => {
            // Əvvəlki qırıq buraxlışdan qalan istifadəçi qeydiyyatı poza bilməsin
            await cleanUpUsers(['ntf_temp@upra.com']);
            const temp = await registerUser({
                email: 'ntf_temp@upra.com',
                password: PASSWORD,
                fullName: 'Ntf Temp',
                role: 'FREELANCER',
            });
            await notify(temp.user.id, { type: 'TEST', title: 'Gone soon' });
            expect(await prisma.notification.count({ where: { userId: temp.user.id } })).toBe(1);

            await cleanUpUsers(['ntf_temp@upra.com']);
            expect(await prisma.notification.count({ where: { userId: temp.user.id } })).toBe(0);
        });
    });
});
