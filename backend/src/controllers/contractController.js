import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { verifyContractAccess } from '../utils/contractAccess.js';

// @route   POST /api/contracts
// @access  Private (CLIENT)
export const createContract = asyncHandler(async (req, res) => {
    const { proposalId } = req.body;

    const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
            jobPost: true,
        },
    });

    if (!proposal) {
        throw new AppError('Proposal not found', 404);
    }

    if (proposal.jobPost.clientId !== req.user.id) {
        throw new AppError('You are not authorized to create a contract for this job', 403);
    }

    if (proposal.jobPost.status !== 'OPEN') {
        throw new AppError('Contract can only be created for OPEN job posts', 400);
    }

    if (proposal.status !== 'PENDING') {
        throw new AppError('Contract can only be created from a PENDING proposal', 400);
    }

    const contract = await prisma.$transaction(async (tx) => {
        const newContract = await tx.contract.create({
            data: {
                jobPostId: proposal.jobPostId,
                proposalId: proposal.id,
                clientId: req.user.id,
                freelancerId: proposal.freelancerId,
                status: 'ACTIVE',
                board: {
                    create: {}, // Contract yarandığı an avtomatik 1 ədəd Board yaradılır
                },
            },
        });

        await tx.proposal.update({
            where: { id: proposal.id },
            data: { status: 'ACCEPTED' },
        });

        await tx.proposal.updateMany({
            where: {
                jobPostId: proposal.jobPostId,
                id: { not: proposal.id },
                status: 'PENDING',
            },
            data: { status: 'REJECTED' },
        });

        await tx.jobPost.update({
            where: { id: proposal.jobPostId },
            data: { status: 'IN_PROGRESS' },
        });

        return newContract;
    });

    res.status(201).json({ success: true, contract });
});

// @route   GET /api/contracts/my
// @access  Private (CLIENT & FREELANCER)
export const getMyContracts = asyncHandler(async (req, res) => {
    const whereClause =
        req.user.role === 'CLIENT'
            ? { clientId: req.user.id }
            : { freelancerId: req.user.id };

    const contracts = await prisma.contract.findMany({
        where: whereClause,
        include: {
            jobPost: {
                select: { id: true, title: true, status: true },
            },
            proposal: {
                select: { id: true, bidAmount: true, coverLetter: true },
            },
            client: {
                select: { id: true, fullName: true, email: true },
            },
            freelancer: {
                select: { id: true, fullName: true, email: true },
            },
            board: {
                select: { id: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, count: contracts.length, contracts });
});

// @route   GET /api/contracts/:id
// @access  Private (Müqavilənin iştirakçısı olan CLIENT və ya FREELANCER)
export const getContractById = asyncHandler(async (req, res) => {
    const contract = await verifyContractAccess(req.params.id, req.user.id);
    res.status(200).json({ success: true, contract });
});

// @route   PATCH /api/contracts/:id/complete
// @access  Private (CLIENT)
export const completeContract = asyncHandler(async (req, res) => {
    const contract = await prisma.contract.findUnique({
        where: { id: req.params.id },
    });

    if (!contract) {
        throw new AppError('Contract not found', 404);
    }

    if (contract.clientId !== req.user.id) {
        throw new AppError('Only the client can complete this contract', 403);
    }

    if (contract.status !== 'ACTIVE') {
        throw new AppError('Only ACTIVE contracts can be completed', 400);
    }

    const updatedContract = await prisma.$transaction(async (tx) => {
        const updated = await tx.contract.update({
            where: { id: req.params.id },
            data: { status: 'COMPLETED' },
        });

        await tx.jobPost.update({
            where: { id: contract.jobPostId },
            data: { status: 'COMPLETED' },
        });

        return updated;
    });

    res.status(200).json({ success: true, contract: updatedContract });
});

// @route   PATCH /api/contracts/:id/cancel
// @access  Private (CLIENT)
export const cancelContract = asyncHandler(async (req, res) => {
    const contract = await prisma.contract.findUnique({
        where: { id: req.params.id },
    });

    if (!contract) {
        throw new AppError('Contract not found', 404);
    }

    if (contract.clientId !== req.user.id) {
        throw new AppError('Only the client can cancel this contract', 403);
    }

    if (contract.status !== 'ACTIVE') {
        throw new AppError('Only ACTIVE contracts can be cancelled', 400);
    }

    const cancelledContract = await prisma.$transaction(async (tx) => {
        const updated = await tx.contract.update({
            where: { id: req.params.id },
            data: { status: 'CANCELLED' },
        });

        await tx.jobPost.update({
            where: { id: contract.jobPostId },
            data: { status: 'CANCELLED' },
        });

        return updated;
    });

    res.status(200).json({ success: true, contract: cancelledContract });
});