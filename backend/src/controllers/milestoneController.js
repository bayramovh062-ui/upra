import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyContractAccess } from '../utils/contractAccess.js';
import {
    fundMilestone,
    submitMilestone,
    approveMilestone,
    requestChanges,
    openDispute,
} from '../services/financialService.js';

const publicWallet = (wallet) => ({
    id: wallet.id,
    availableCents: wallet.availableCents,
    lockedCents: wallet.lockedCents,
    currency: wallet.currency,
});

// @route   GET /api/contracts/:id/milestones
// @access  Private (müqavilənin tərəfləri)
export const getContractMilestones = asyncHandler(async (req, res) => {
    await verifyContractAccess(req.params.id, req.user.id);

    const milestones = await prisma.milestone.findMany({
        where: { contractId: req.params.id },
        orderBy: { sequence: 'asc' },
    });

    res.status(200).json({ success: true, count: milestones.length, milestones });
});

// @route   GET /api/contracts/:id/history
// @access  Private (müqavilənin tərəfləri)
// P2: təhvil/dəyişiklik tarixçəsi + mübahisələr. Escrow UI bunu bir sorğu ilə oxuyur.
export const getContractHistory = asyncHandler(async (req, res) => {
    await verifyContractAccess(req.params.id, req.user.id);

    const [submissions, disputes] = await Promise.all([
        prisma.milestoneSubmission.findMany({
            where: { contractId: req.params.id },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: {
                actor: { select: { id: true, fullName: true, role: true } },
                milestone: { select: { id: true, sequence: true, title: true } },
                attachments: { select: { id: true, url: true, filename: true, mimeType: true, size: true, purpose: true, uploadedById: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
            },
        }),
        prisma.dispute.findMany({
            where: { contractId: req.params.id },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: {
                openedBy: { select: { id: true, fullName: true, role: true } },
                admin: { select: { id: true, fullName: true } },
                milestone: { select: { id: true, sequence: true, title: true } },
                attachments: { select: { id: true, url: true, filename: true, mimeType: true, size: true, purpose: true, uploadedById: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
            },
        }),
    ]);

    res.status(200).json({ success: true, submissions, disputes });
});

// @route   POST /api/milestones/:id/fund        (CLIENT) PENDING -> FUNDED, pul escrow-a keçir
export const fund = asyncHandler(async (req, res) => {
    const { milestone, wallet } = await fundMilestone(req.params.id, req.user.id);
    res.status(200).json({ success: true, milestone, wallet: publicWallet(wallet) });
});

// @route   POST /api/milestones/:id/submit      (FREELANCER) FUNDED -> IN_REVIEW
export const submit = asyncHandler(async (req, res) => {
    const milestone = await submitMilestone(req.params.id, req.user.id);
    res.status(200).json({ success: true, milestone });
});

// @route   POST /api/milestones/:id/approve     (CLIENT) IN_REVIEW -> PAID, komissiya çıxılır
export const approve = asyncHandler(async (req, res) => {
    const { milestone, payout } = await approveMilestone(req.params.id, { actorId: req.user.id });
    res.status(200).json({ success: true, milestone, payout });
});

// @route   POST /api/milestones/:id/request-changes   (CLIENT) IN_REVIEW -> FUNDED
export const changes = asyncHandler(async (req, res) => {
    const milestone = await requestChanges(req.params.id, req.user.id, { note: req.body?.note });
    res.status(200).json({ success: true, milestone });
});

// @route   POST /api/milestones/:id/dispute     (tərəflər) FUNDED/IN_REVIEW -> DISPUTED
export const dispute = asyncHandler(async (req, res) => {
    const created = await openDispute(req.params.id, req.user.id, req.body);
    res.status(201).json({ success: true, dispute: created });
});
