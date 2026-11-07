import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { resolveDispute } from '../services/financialService.js';
import { notify, NOTIFICATION_TYPES as N } from '../services/notificationService.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseLimit = (value) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
};

const parseOffset = (value) => {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
};

const disputeWhere = (query) => {
    const status = String(query.status || '').toUpperCase();
    const where = {};
    if (status === 'OPEN' || status === 'RESOLVED') where.status = status;
    return where;
};

// @route   GET /api/admin/disputes?status=OPEN|RESOLVED|ALL&limit&offset
// @access  Private (ADMIN)
export const listDisputes = asyncHandler(async (req, res) => {
    const where = disputeWhere(req.query);
    const take = parseLimit(req.query.limit);
    const skip = parseOffset(req.query.offset);

    const [disputes, total] = await Promise.all([
        prisma.dispute.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take,
            skip,
            include: {
                milestone: { select: { id: true, sequence: true, title: true, status: true, amountCents: true } },
                contract: {
                    select: {
                        id: true,
                        status: true,
                        jobPost: { select: { id: true, title: true } },
                        client: { select: { id: true, fullName: true } },
                        freelancer: { select: { id: true, fullName: true } },
                    },
                },
                openedBy: { select: { id: true, fullName: true, role: true } },
            },
        }),
        prisma.dispute.count({ where }),
    ]);

    res.status(200).json({ success: true, total, count: disputes.length, disputes });
});

// @route   GET /api/admin/disputes/:id
// @access  Private (ADMIN)
export const getDispute = asyncHandler(async (req, res) => {
    const dispute = await prisma.dispute.findUnique({
        where: { id: req.params.id },
        include: {
            milestone: true,
            contract: {
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    jobPost: { select: { id: true, title: true, budget: true } },
                    client: { select: { id: true, fullName: true, email: true } },
                    freelancer: { select: { id: true, fullName: true, email: true } },
                },
            },
            openedBy: { select: { id: true, fullName: true, role: true, email: true } },
            admin: { select: { id: true, fullName: true } },
        },
    });

    if (!dispute) throw new AppError('Dispute not found', 404);

    const submissions = await prisma.milestoneSubmission.findMany({
        where: { milestoneId: dispute.milestoneId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { actor: { select: { id: true, fullName: true, role: true } } },
    });

    res.status(200).json({ success: true, dispute, submissions });
});

// @route   PATCH /api/admin/disputes/:id/resolve
// @access  Private (ADMIN). Body: { resolution, releaseCents?, refundCents?, adminNote? }
export const resolveDisputeHandler = asyncHandler(async (req, res) => {
    const result = await resolveDispute(req.params.id, req.user.id, req.body);
    res.status(200).json({ success: true, ...result });
});

// @route   GET /api/admin/reports?status=OPEN|REVIEWED|CLOSED|ALL&targetType&limit&offset
// @access  Private (ADMIN)
export const listReports = asyncHandler(async (req, res) => {
    const status = String(req.query.status || '').toUpperCase();
    const targetType = String(req.query.targetType || '').toUpperCase();
    const statuses = ['OPEN', 'REVIEWED', 'CLOSED'];
    const targetTypes = ['USER', 'CONTRACT', 'MILESTONE', 'JOB', 'MESSAGE'];

    const where = {
        ...(statuses.includes(status) && { status }),
        ...(targetTypes.includes(targetType) && { targetType }),
    };

    const take = parseLimit(req.query.limit);
    const skip = parseOffset(req.query.offset);

    const [reports, total] = await Promise.all([
        prisma.report.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take,
            skip,
            include: {
                reporter: { select: { id: true, fullName: true, email: true, role: true } },
                admin: { select: { id: true, fullName: true } },
            },
        }),
        prisma.report.count({ where }),
    ]);

    res.status(200).json({ success: true, total, count: reports.length, reports });
});

// @route   GET /api/admin/reports/:id
// @access  Private (ADMIN)
export const getReport = asyncHandler(async (req, res) => {
    const report = await prisma.report.findUnique({
        where: { id: req.params.id },
        include: {
            reporter: { select: { id: true, fullName: true, email: true, role: true } },
            admin: { select: { id: true, fullName: true, email: true } },
        },
    });

    if (!report) throw new AppError('Report not found', 404);

    res.status(200).json({ success: true, report });
});

// İcazə verilən status keçidləri. CLOSED terminaldır; OPEN-a qaytarmaq mümkün deyil.
const REPORT_TRANSITIONS = {
    OPEN: ['REVIEWED', 'CLOSED'],
    REVIEWED: ['REVIEWED', 'CLOSED'],
    CLOSED: [],
};

// @route   PATCH /api/admin/reports/:id
// @access  Private (ADMIN). Body: { status: REVIEWED|CLOSED, adminNote? }
export const reviewReport = asyncHandler(async (req, res) => {
    const existing = await prisma.report.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true, reporterId: true },
    });
    if (!existing) throw new AppError('Report not found', 404);

    const nextStatus = req.body.status;
    if (!REPORT_TRANSITIONS[existing.status].includes(nextStatus)) {
        throw new AppError(`Report status cannot change from ${existing.status} to ${nextStatus}`, 400);
    }

    const report = await prisma.report.update({
        where: { id: req.params.id },
        data: {
            status: nextStatus,
            adminId: req.user.id,
            adminNote: req.body.adminNote?.trim() || null,
            reviewedAt: new Date(),
        },
        include: { reporter: { select: { id: true, fullName: true, email: true } } },
    });

    // Yalnız faktiki keçiddə bildiriş göndərilir (eyni statusun təkrar yazılışı spam yaratmır).
    if (existing.status !== nextStatus) {
        await notify(existing.reporterId, {
            type: nextStatus === 'CLOSED' ? N.REPORT_CLOSED : N.REPORT_REVIEWED,
            title: nextStatus === 'CLOSED' ? 'Your report was closed' : 'Your report was reviewed',
            body:
                nextStatus === 'CLOSED'
                    ? 'An administrator closed your report. Thank you for helping keep the marketplace safe.'
                    : 'An administrator reviewed your report. It may be updated again if more action is needed.',
            data: { reportId: report.id, status: nextStatus },
        });
    }

    res.status(200).json({ success: true, report });
});

// ================= P3: ADMIN İSTİFADƏÇİ MODERASİYASI =================

const adminUserSelect = {
    id: true,
    email: true,
    fullName: true,
    role: true,
    isSuspended: true,
    suspendedAt: true,
    suspensionReason: true,
    createdAt: true,
    suspendedByAdmin: { select: { id: true, fullName: true } },
};

const ROLES = ['CLIENT', 'FREELANCER', 'ADMIN'];

// @route   GET /api/admin/users?q&role&suspended=true|false&limit&offset
// @access  Private (ADMIN)
export const listUsers = asyncHandler(async (req, res) => {
    const role = String(req.query.role || '').toUpperCase();
    const suspended = String(req.query.suspended || '').toLowerCase();
    const q = String(req.query.q || '').trim();

    const where = {
        deletedAt: null,
        ...(ROLES.includes(role) && { role }),
        ...(suspended === 'true' && { isSuspended: true }),
        ...(suspended === 'false' && { isSuspended: false }),
        ...(q && {
            OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { fullName: { contains: q, mode: 'insensitive' } },
            ],
        }),
    };

    const take = parseLimit(req.query.limit);
    const skip = parseOffset(req.query.offset);

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take,
            skip,
            select: adminUserSelect,
        }),
        prisma.user.count({ where }),
    ]);

    res.status(200).json({ success: true, total, count: users.length, users });
});

// @route   PATCH /api/admin/users/:id/suspension
// @access  Private (ADMIN). Body: { suspended: boolean, reason? }
// Qaydalar: admin özünü suspend edə bilməz; ADMIN rolu olan hesab bu endpoint ilə moderasiya olunmur.
export const updateUserSuspension = asyncHandler(async (req, res) => {
    const target = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: true, isSuspended: true, deletedAt: true },
    });

    if (!target || target.deletedAt !== null) {
        throw new AppError('User not found', 404);
    }

    if (target.id === req.user.id) {
        throw new AppError('You cannot change your own suspension status', 400);
    }

    if (target.role === 'ADMIN') {
        throw new AppError('Admin accounts cannot be suspended through this endpoint', 403);
    }

    const { suspended } = req.body;
    const reason = req.body.reason?.trim() || null;
    const stateChanged = target.isSuspended !== suspended;

    const user = await prisma.user.update({
        where: { id: target.id },
        data: suspended
            ? {
                  isSuspended: true,
                  suspendedAt: new Date(),
                  suspensionReason: reason,
                  suspendedByAdminId: req.user.id,
              }
            : {
                  isSuspended: false,
                  suspendedAt: null,
                  suspensionReason: null,
                  suspendedByAdminId: null,
              },
        select: adminUserSelect,
    });

    if (stateChanged) {
        await notify(target.id, {
            type: suspended ? N.ACCOUNT_SUSPENDED : N.ACCOUNT_REINSTATED,
            title: suspended ? 'Your account has been suspended' : 'Your account has been reinstated',
            body: suspended
                ? `An administrator suspended your account${reason ? `: ${reason}` : '.'} Contact support if you believe this is a mistake.`
                : 'Your account is active again. You can sign in and continue using the marketplace.',
            data: { suspended },
        });
    }

    res.status(200).json({ success: true, user });
});
