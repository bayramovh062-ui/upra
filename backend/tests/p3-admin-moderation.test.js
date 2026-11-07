import request from 'supertest';
import { app, prisma, cleanUpUsers, registerUser, createJob } from './helpers/db.js';
import { PASSWORD, api, pairEmails, registerPair, registerAdmin } from './helpers/p2.js';

// P3: admin şikayət keçidləri + istifadəçi suspension moderasiyası. E-poçtlar "p3adm_" ilə başlayır.
const PREFIX = 'p3adm';
const ADMIN_EMAIL = `${PREFIX}_admin@upra.com`;
const ADMIN2_EMAIL = `${PREFIX}_admin2@upra.com`;
const OUTSIDER_EMAIL = `${PREFIX}_outsider@upra.com`;
const PAIR = pairEmails(PREFIX, 1);
const ALL_EMAILS = [ADMIN_EMAIL, ADMIN2_EMAIL, OUTSIDER_EMAIL, PAIR.client, PAIR.freelancer];

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Phase 3 admin reports and user moderation', () => {
    let admin;
    let admin2;
    let pair;
    let outsider;
    let job;
    let reportId;

    beforeAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
        admin = await registerAdmin(ADMIN_EMAIL);
        admin2 = await registerAdmin(ADMIN2_EMAIL);
        pair = await registerPair(PREFIX, 1);
        outsider = await registerUser({
            email: OUTSIDER_EMAIL,
            password: PASSWORD,
            fullName: 'Moderation Outsider',
            role: 'CLIENT',
        });
        job = await createJob(pair.c.token, { title: 'Moderation target job', status: 'OPEN' });
    });

    afterAll(async () => {
        await cleanUpUsers(ALL_EMAILS);
    });

    it('exposes report details and enforces valid status transitions with notifications', async () => {
        const created = await api.post(pair.c.token, '/api/reports', {
            targetType: 'JOB',
            targetId: job.id,
            reason: 'This job looks suspicious and asks for a deposit',
        });
        expect(created.status).toBe(201);
        reportId = created.body.report.id;

        // Yalnız admin detail görə bilər
        expect((await api.get(pair.c.token, `/api/admin/reports/${reportId}`)).status).toBe(403);
        expect((await api.get(outsider.token, `/api/admin/reports/${reportId}`)).status).toBe(403);
        expect((await api.get(admin.token, `/api/admin/reports/${MISSING_ID}`)).status).toBe(404);

        const detail = await api.get(admin.token, `/api/admin/reports/${reportId}`);
        expect(detail.status).toBe(200);
        expect(detail.body.report).toMatchObject({
            id: reportId,
            status: 'OPEN',
            targetType: 'JOB',
            targetId: job.id,
            reporter: { id: pair.c.user.id },
            admin: null,
        });

        // OPEN -> REVIEWED -> CLOSED; CLOSED terminaldır
        const reviewed = await api.patch(admin.token, `/api/admin/reports/${reportId}`, {
            status: 'REVIEWED',
            adminNote: 'Checked the listing and requested changes.',
        });
        expect(reviewed.status).toBe(200);
        expect(reviewed.body.report).toMatchObject({ status: 'REVIEWED', adminId: admin.user.id });
        expect(reviewed.body.report.reviewedAt).toBeTruthy();

        const closed = await api.patch(admin.token, `/api/admin/reports/${reportId}`, { status: 'CLOSED' });
        expect(closed.status).toBe(200);
        expect(closed.body.report.status).toBe('CLOSED');

        expect((await api.patch(admin.token, `/api/admin/reports/${reportId}`, { status: 'REVIEWED' })).status).toBe(400);

        // Reporter hər keçid üçün bildiriş alır
        const reviewedNotice = await prisma.notification.findFirst({
            where: { userId: pair.c.user.id, type: 'REPORT_REVIEWED' },
        });
        const closedNotice = await prisma.notification.findFirst({
            where: { userId: pair.c.user.id, type: 'REPORT_CLOSED' },
        });
        expect(reviewedNotice).toBeTruthy();
        expect(closedNotice).toBeTruthy();
    });

    it('lists users for admins with filters and pagination', async () => {
        expect((await api.get(pair.c.token, '/api/admin/users')).status).toBe(403);

        const list = await api.get(admin.token, `/api/admin/users?q=${PREFIX}&limit=100`);
        expect(list.status).toBe(200);
        expect(list.body.total).toBeGreaterThanOrEqual(4);
        const emails = list.body.users.map((u) => u.email);
        expect(emails).toEqual(
            expect.arrayContaining([PAIR.client, PAIR.freelancer, ADMIN_EMAIL, ADMIN2_EMAIL])
        );
        expect(list.body.users.every((u) => u.isSuspended === false)).toBe(true);

        const clients = await api.get(admin.token, `/api/admin/users?q=${PREFIX}&role=CLIENT&limit=100`);
        expect(clients.body.users.every((u) => u.role === 'CLIENT')).toBe(true);

        const limited = await api.get(admin.token, `/api/admin/users?q=${PREFIX}&limit=1`);
        expect(limited.status).toBe(200);
        expect(limited.body.users).toHaveLength(1);
        expect(limited.body.count).toBe(1);
    });

    it('suspends and reinstates a user, enforcing auth restrictions and safe admin rules', async () => {
        // Özünü suspend edə bilməz; digər admini də suspend edə bilməz
        expect(
            (
                await api.patch(admin.token, `/api/admin/users/${admin.user.id}/suspension`, {
                    suspended: true,
                    reason: 'Trying to suspend myself',
                })
            ).status
        ).toBe(400);
        expect(
            (
                await api.patch(admin.token, `/api/admin/users/${admin2.user.id}/suspension`, {
                    suspended: true,
                    reason: 'Trying to suspend another admin',
                })
            ).status
        ).toBe(403);

        // Validasiya
        expect((await api.patch(admin.token, `/api/admin/users/${pair.f.user.id}/suspension`, {})).status).toBe(400);
        expect(
            (
                await api.patch(admin.token, `/api/admin/users/${pair.f.user.id}/suspension`, {
                    suspended: true,
                    reason: 'x'.repeat(501),
                })
            ).status
        ).toBe(400);
        expect(
            (
                await api.patch(admin.token, `/api/admin/users/${MISSING_ID}/suspension`, { suspended: true })
            ).status
        ).toBe(404);

        const suspended = await api.patch(admin.token, `/api/admin/users/${pair.f.user.id}/suspension`, {
            suspended: true,
            reason: 'Repeated abusive messages',
        });
        expect(suspended.status).toBe(200);
        expect(suspended.body.user).toMatchObject({
            id: pair.f.user.id,
            email: PAIR.freelancer,
            isSuspended: true,
            suspensionReason: 'Repeated abusive messages',
            suspendedByAdmin: { id: admin.user.id },
        });
        expect(suspended.body.user.suspendedAt).toBeTruthy();

        const suspendedRow = await prisma.user.findUnique({ where: { id: pair.f.user.id } });
        expect(suspendedRow.isSuspended).toBe(true);
        expect(suspendedRow.suspendedByAdminId).toBe(admin.user.id);

        // Suspend olunmuş istifadəçi login edə və mövcud tokenlə qorunan əməliyyat edə bilməz
        const login = await request(app).post('/api/auth/login').send({
            email: PAIR.freelancer,
            password: PASSWORD,
        });
        expect(login.status).toBe(403);
        expect((await api.get(pair.f.token, '/api/auth/me')).status).toBe(403);

        // Siyahıda suspend filteri işləyir
        const suspendedList = await api.get(admin.token, `/api/admin/users?q=${PREFIX}&suspended=true&limit=100`);
        expect(suspendedList.body.users.map((u) => u.id)).toContain(pair.f.user.id);
        const activeList = await api.get(admin.token, `/api/admin/users?q=${PREFIX}&suspended=false&limit=100`);
        expect(activeList.body.users.map((u) => u.id)).not.toContain(pair.f.user.id);

        expect(
            await prisma.notification.findFirst({
                where: { userId: pair.f.user.id, type: 'ACCOUNT_SUSPENDED' },
            })
        ).toBeTruthy();

        // Reinstatement: yenidən login mümkündür
        const reinstated = await api.patch(admin.token, `/api/admin/users/${pair.f.user.id}/suspension`, {
            suspended: false,
        });
        expect(reinstated.status).toBe(200);
        expect(reinstated.body.user).toMatchObject({ id: pair.f.user.id, isSuspended: false });
        expect(reinstated.body.user.suspendedAt).toBeNull();
        expect(reinstated.body.user.suspensionReason).toBeNull();

        expect(
            await prisma.notification.findFirst({
                where: { userId: pair.f.user.id, type: 'ACCOUNT_REINSTATED' },
            })
        ).toBeTruthy();

        const relogin = await request(app).post('/api/auth/login').send({
            email: PAIR.freelancer,
            password: PASSWORD,
        });
        expect(relogin.status).toBe(200);
        expect((await api.get(pair.f.token, '/api/auth/me')).status).toBe(200);
    });
});
