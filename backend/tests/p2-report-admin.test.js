import request from 'supertest';
import { app, prisma, auth, cleanUpUsers, createJob, registerUser } from './helpers/db.js';
import {
    PASSWORD,
    api,
    pairEmails,
    registerPair,
    registerAdmin,
    createContractWithMilestones,
    fundAndSubmit,
} from './helpers/p2.js';

// P2: şikayət (Report) sistemi + admin moderasiyası və admin mübahisə siyahısı. E-poçtlar "p2rep_" ilə başlayır.
const PREFIX = 'p2rep';
const MAX_PAIRS = 5;
const ADMIN_EMAIL = `${PREFIX}_admin@upra.com`;
const OUTSIDER_EMAIL = `${PREFIX}_outsider@upra.com`;
const ALL_EMAILS = [
    ADMIN_EMAIL,
    OUTSIDER_EMAIL,
    ...Array.from({ length: MAX_PAIRS }, (_, i) => Object.values(pairEmails(PREFIX, i + 1))).flat(),
];

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Phase 2 reports and admin moderation', () => {
    let counter = 0;
    let admin;
    let outsider;

    const newPair = async () => {
        counter += 1;
        if (counter > MAX_PAIRS) throw new Error('Increase MAX_PAIRS in p2-report-admin.test.js');
        return registerPair(PREFIX, counter);
    };

    const report = (token, body) => api.post(token, '/api/reports', body);

    beforeAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        admin = await registerAdmin(ADMIN_EMAIL);
        outsider = await registerUser({
            email: OUTSIDER_EMAIL,
            password: PASSWORD,
            fullName: 'Report Outsider',
            role: 'CLIENT',
        });
    });

    afterAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        await prisma.$disconnect();
    });

    it('never lets a public registration create an ADMIN account', async () => {
        const email = `${PREFIX}_selfadmin@upra.com`;
        const res = await request(app).post('/api/auth/register').send({
            email,
            password: PASSWORD,
            fullName: 'Sneaky Admin',
            role: 'ADMIN',
        });

        expect(res.status).toBe(400);
        expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it('creates reports for visible targets and hides inaccessible or missing targets', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Reportable work', amount: 100 }],
        });
        const milestone = contract.milestones[0];

        // Tərəf müqaviləni və mərhələni şikayət edə bilər
        const contractReport = await report(pair.c.token, {
            targetType: 'CONTRACT',
            targetId: contract.id,
            reason: 'The contract terms were changed outside the app',
            details: 'Extra work was requested in chat.',
        });
        expect(contractReport.status).toBe(201);
        expect(contractReport.body.report).toMatchObject({
            reporterId: pair.c.user.id,
            targetType: 'CONTRACT',
            targetId: contract.id,
            reason: 'The contract terms were changed outside the app',
            details: 'Extra work was requested in chat.',
            status: 'OPEN',
            adminId: null,
        });

        const milestoneReport = await report(pair.f.token, {
            targetType: 'MILESTONE',
            targetId: milestone.id,
            reason: 'The milestone amount does not match the agreement',
        });
        expect(milestoneReport.status).toBe(201);

        // Tərəf olmayan üçün hədəf "mövcud deyil" kimi görünür (403 yox, ümumi 404)
        expect(
            (
                await report(outsider.token, {
                    targetType: 'CONTRACT',
                    targetId: contract.id,
                    reason: 'I want to report this contract',
                })
            ).status
        ).toBe(404);
        expect(
            (
                await report(outsider.token, {
                    targetType: 'MILESTONE',
                    targetId: milestone.id,
                    reason: 'I want to report this milestone',
                })
            ).status
        ).toBe(404);

        // İctimai (OPEN) işi hər kəs, DRAFT işi yalnız sahibi şikayət edə bilər
        const openJob = await createJob(pair.c.token, { title: 'Public report job', status: 'OPEN' });
        const openJobReport = await report(outsider.token, {
            targetType: 'JOB',
            targetId: openJob.id,
            reason: 'This job asks for unpaid trial work',
        });
        expect(openJobReport.status).toBe(201);

        const draftJob = await createJob(pair.c.token, { title: 'Private draft job', status: 'DRAFT' });
        expect(
            (
                await report(outsider.token, {
                    targetType: 'JOB',
                    targetId: draftJob.id,
                    reason: 'I should not even see this draft',
                })
            ).status
        ).toBe(404);
        expect(
            (
                await report(pair.c.token, {
                    targetType: 'JOB',
                    targetId: draftJob.id,
                    reason: 'My own draft has a problem',
                })
            ).status
        ).toBe(201);

        // İstifadəçi özünü şikayət edə bilməz; mövcud başqa istifadəçini və yox olanı fərqli cavablandırır
        expect(
            (
                await report(pair.c.token, {
                    targetType: 'USER',
                    targetId: pair.c.user.id,
                    reason: 'I am reporting myself for testing',
                })
            ).status
        ).toBe(400);
        expect(
            (
                await report(outsider.token, {
                    targetType: 'USER',
                    targetId: pair.f.user.id,
                    reason: 'This user behaved abusively in chat',
                })
            ).status
        ).toBe(201);
        expect(
            (
                await report(outsider.token, {
                    targetType: 'USER',
                    targetId: MISSING_ID,
                    reason: 'This user does not exist at all',
                })
            ).status
        ).toBe(404);
        expect(
            (
                await report(outsider.token, {
                    targetType: 'CONTRACT',
                    targetId: MISSING_ID,
                    reason: 'This contract does not exist',
                })
            ).status
        ).toBe(404);

        // Validasiya: qısa səbəb, yanlış tip, yanlış UUID
        expect(
            (await report(outsider.token, { targetType: 'JOB', targetId: openJob.id, reason: 'bad' })).status
        ).toBe(400);
        expect(
            (await report(outsider.token, { targetType: 'BOARD', targetId: openJob.id, reason: 'Not a real target' }))
                .status
        ).toBe(400);
        expect(
            (await report(outsider.token, { targetType: 'JOB', targetId: 'not-a-uuid', reason: 'Invalid id format' }))
                .status
        ).toBe(400);
    });

    it('lets only ADMIN list and review reports, and records the review metadata', async () => {
        const pair = await newPair();
        const job = await createJob(pair.c.token, { title: 'Moderated job', status: 'OPEN' });
        const created = await report(outsider.token, {
            targetType: 'JOB',
            targetId: job.id,
            reason: 'This listing looks like a scam',
            details: 'They ask for a deposit before work starts.',
        });
        expect(created.status).toBe(201);
        const reportId = created.body.report.id;

        // Adi istifadəçi admin endpoint-lərinə çıxış əldə etmir
        expect((await api.get(pair.c.token, '/api/admin/reports')).status).toBe(403);
        expect(
            (await api.patch(pair.c.token, `/api/admin/reports/${reportId}`, { status: 'REVIEWED' })).status
        ).toBe(403);

        const openList = await api.get(admin.token, `/api/admin/reports?status=OPEN&targetType=JOB&limit=50`);
        expect(openList.status).toBe(200);
        expect(openList.body.reports.some((r) => r.id === reportId)).toBe(true);
        const listed = openList.body.reports.find((r) => r.id === reportId);
        expect(listed).toMatchObject({
            status: 'OPEN',
            targetType: 'JOB',
            targetId: job.id,
            reporter: { id: outsider.user.id, fullName: 'Report Outsider' },
            admin: null,
        });

        // Yanlış status qəbul edilmir
        expect(
            (await api.patch(admin.token, `/api/admin/reports/${reportId}`, { status: 'OPEN' })).status
        ).toBe(400);
        expect(
            (await api.patch(admin.token, `/api/admin/reports/${MISSING_ID}`, { status: 'REVIEWED' })).status
        ).toBe(404);

        const reviewed = await api.patch(admin.token, `/api/admin/reports/${reportId}`, {
            status: 'REVIEWED',
            adminNote: 'Listing checked; no action needed.',
        });
        expect(reviewed.status).toBe(200);
        expect(reviewed.body.report).toMatchObject({
            id: reportId,
            status: 'REVIEWED',
            adminId: admin.user.id,
            adminNote: 'Listing checked; no action needed.',
        });
        expect(reviewed.body.report.reviewedAt).toBeTruthy();

        const row = await prisma.report.findUnique({ where: { id: reportId } });
        expect(row).toMatchObject({ status: 'REVIEWED', adminId: admin.user.id });

        // OPEN filtrində artıq yoxdur, REVIEWED filtrində var
        const stillOpen = await api.get(admin.token, `/api/admin/reports?status=OPEN&targetType=JOB&limit=100`);
        expect(stillOpen.body.reports.some((r) => r.id === reportId)).toBe(false);
        const reviewedList = await api.get(admin.token, `/api/admin/reports?status=REVIEWED&targetType=JOB&limit=100`);
        expect(reviewedList.body.reports.some((r) => r.id === reportId)).toBe(true);

        // Bağlanmış şikayəti CLOSED-a keçirmək olar (yenidən OPEN edilə bilməz)
        const closed = await api.patch(admin.token, `/api/admin/reports/${reportId}`, { status: 'CLOSED' });
        expect(closed.status).toBe(200);
        expect(closed.body.report.status).toBe('CLOSED');
    });

    it('exposes admin dispute lists and details with the party submission history', async () => {
        const pair = await newPair();
        const contract = await createContractWithMilestones({
            clientToken: pair.c.token,
            freelancerToken: pair.f.token,
            milestones: [{ title: 'Admin visibility', amount: 60 }],
        });
        const milestone = contract.milestones[0];
        await fundAndSubmit(pair.c.user.id, pair.f.user.id, milestone);

        const opened = await api.post(pair.f.token, `/api/milestones/${milestone.id}/dispute`, {
            reason: 'The client keeps asking for free extra work',
            details: 'Three extra pages were requested after delivery.',
        });
        expect(opened.status).toBe(201);
        const disputeId = opened.body.dispute.id;

        const openList = await api.get(admin.token, '/api/admin/disputes?status=OPEN&limit=100');
        expect(openList.status).toBe(200);
        expect(openList.body.disputes.some((d) => d.id === disputeId)).toBe(true);
        const listed = openList.body.disputes.find((d) => d.id === disputeId);
        expect(listed).toMatchObject({
            status: 'OPEN',
            reason: 'The client keeps asking for free extra work',
            milestone: { id: milestone.id, sequence: 1, title: 'Admin visibility', status: 'DISPUTED', amountCents: 6000 },
            contract: { id: contract.id, client: { id: pair.c.user.id }, freelancer: { id: pair.f.user.id } },
            openedBy: { id: pair.f.user.id, role: 'FREELANCER' },
        });

        const resolvedList = await api.get(admin.token, '/api/admin/disputes?status=RESOLVED&limit=100');
        expect(resolvedList.status).toBe(200);
        expect(resolvedList.body.disputes.some((d) => d.id === disputeId)).toBe(false);

        const detail = await api.get(admin.token, `/api/admin/disputes/${disputeId}`);
        expect(detail.status).toBe(200);
        expect(detail.body.dispute).toMatchObject({
            id: disputeId,
            status: 'OPEN',
            details: 'Three extra pages were requested after delivery.',
            contract: { id: contract.id, jobPost: { title: 'P2 contract' } },
        });
        expect(detail.body.submissions.map((s) => [s.type, s.revisionNumber, s.actor.id])).toEqual([
            ['SUBMITTED', 0, pair.f.user.id],
        ]);

        // Siyahı limiti tətbiq olunur
        const limited = await api.get(admin.token, '/api/admin/disputes?status=OPEN&limit=1');
        expect(limited.status).toBe(200);
        expect(limited.body.count).toBe(1);
        expect(limited.body.disputes).toHaveLength(1);
    });
});
