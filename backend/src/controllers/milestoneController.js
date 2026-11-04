import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyContractAccess } from '../utils/contractAccess.js';
import {
    fundMilestone,
    submitMilestone,
    approveMilestone,
    requestChanges,
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
    const milestone = await requestChanges(req.params.id, req.user.id);
    res.status(200).json({ success: true, milestone });
});
