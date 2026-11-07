import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { resolveDispute } from '../services/financialService.js';

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

// @route   PATCH /api/admin/reports/:id
// @access  Private (ADMIN). Body: { status: REVIEWED|CLOSED, adminNote? }
export const reviewReport = asyncHandler(async (req, res) => {
    const existing = await prisma.report.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new AppError('Report not found', 404);

    const report = await prisma.report.update({
        where: { id: req.params.id },
        data: {
            status: req.body.status,
            adminId: req.user.id,
            adminNote: req.body.adminNote?.trim() || null,
            reviewedAt: new Date(),
        },
        include: { reporter: { select: { id: true, fullName: true, email: true } } },
    });

    res.status(200).json({ success: true, report });
});
