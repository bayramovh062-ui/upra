import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

const isParty = (row, userId) => !!row && [row.clientId, row.freelancerId].includes(userId);

// Target mövcuddursa və istifadəçi onu görə bilirsə true. Görünməyən target üçün də false qaytarır:
// beləliklə cavab "yoxdur" və "icazən yoxdur" arasında fərq yaratmır.
const canReportTarget = async (user, targetType, targetId) => {
    switch (targetType) {
        case 'USER': {
            if (targetId === user.id) return { ok: false, status: 400, message: 'You cannot report yourself' };
            const target = await prisma.user.findFirst({
                where: { id: targetId, deletedAt: null },
                select: { id: true },
            });
            return { ok: !!target };
        }
        case 'JOB': {
            const job = await prisma.jobPost.findUnique({
                where: { id: targetId },
                select: { id: true, status: true, clientId: true },
            });
            // DRAFT iş yalnız sahibinə görünür
            return { ok: !!job && (job.status !== 'DRAFT' || job.clientId === user.id) };
        }
        case 'CONTRACT': {
            const contract = await prisma.contract.findUnique({
                where: { id: targetId },
                select: { clientId: true, freelancerId: true },
            });
            return { ok: isParty(contract, user.id) };
        }
        case 'MILESTONE': {
            const milestone = await prisma.milestone.findUnique({
                where: { id: targetId },
                select: { contract: { select: { clientId: true, freelancerId: true } } },
            });
            return { ok: isParty(milestone?.contract, user.id) };
        }
        case 'MESSAGE': {
            const message = await prisma.message.findUnique({
                where: { id: targetId },
                select: { conversation: { select: { clientId: true, freelancerId: true } } },
            });
            return { ok: isParty(message?.conversation, user.id) };
        }
        default:
            return { ok: false };
    }
};

// @route   POST /api/reports
// @access  Private. Body: { targetType, targetId, reason, details? }
export const createReport = asyncHandler(async (req, res) => {
    const { targetType, targetId, reason, details } = req.body;

    const access = await canReportTarget(req.user, targetType, targetId);
    if (!access.ok) {
        if (access.status === 400) throw new AppError(access.message, 400);
        throw new AppError('Report target not found', 404);
    }

    const report = await prisma.report.create({
        data: {
            reporterId: req.user.id,
            targetType,
            targetId,
            reason: reason.trim(),
            details: details?.trim() || null,
        },
        include: { attachments: { select: { id: true, url: true, filename: true, mimeType: true, size: true, purpose: true, uploadedById: true, createdAt: true } } },
    });

    res.status(201).json({ success: true, report });
});
