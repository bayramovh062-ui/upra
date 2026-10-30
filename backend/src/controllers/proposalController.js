import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

// @route   POST /api/proposals
// @access  Private (FREELANCER)
export const createProposal = asyncHandler(async (req, res) => {
    const { jobPostId, coverLetter, bidAmount } = req.body;

    const jobPost = await prisma.jobPost.findUnique({
        where: { id: jobPostId },
    });

    if (!jobPost) {
        throw new AppError('Job post not found', 404);
    }

    if (jobPost.status !== 'OPEN') {
        throw new AppError('You can only submit proposals to OPEN job posts', 400);
    }

    const existingProposal = await prisma.proposal.findUnique({
        where: {
            jobPostId_freelancerId: {
                jobPostId,
                freelancerId: req.user.id,
            },
        },
    });

    if (existingProposal) {
        throw new AppError('You have already submitted a proposal for this job post', 409);
    }

    const proposal = await prisma.proposal.create({
        data: {
            jobPostId,
            coverLetter,
            bidAmount,
            freelancerId: req.user.id,
        },
    });

    res.status(201).json({ success: true, proposal });
});

// @route   GET /api/proposals/my
// @access  Private (FREELANCER)
export const getMyProposals = asyncHandler(async (req, res) => {
    const proposals = await prisma.proposal.findMany({
        where: { freelancerId: req.user.id },
        include: {
            jobPost: {
                select: { id: true, title: true, status: true, budget: true },
            },
            // Qəbul olunan təklif üçün: frilanser "Open workspace" linkini bundan qurur
            contract: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, count: proposals.length, proposals });
});

// @route   GET /api/proposals/job/:jobId
// @access  Private (CLIENT)
export const getProposalsForJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const jobPost = await prisma.jobPost.findUnique({
        where: { id: jobId },
    });

    if (!jobPost) {
        throw new AppError('Job post not found', 404);
    }

    if (jobPost.clientId !== req.user.id) {
        throw new AppError('You do not have permission to view proposals for this job', 403);
    }

    const proposals = await prisma.proposal.findMany({
        where: { jobPostId: jobId },
        include: {
            freelancer: {
                select: { id: true, fullName: true, headline: true, hourlyRate: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, count: proposals.length, proposals });
});

// @route   PATCH /api/proposals/:id
// @access  Private (FREELANCER)
export const updateProposal = asyncHandler(async (req, res) => {
    const proposal = await prisma.proposal.findUnique({
        where: { id: req.params.id },
        include: { jobPost: true },
    });

    if (!proposal) {
        throw new AppError('Proposal not found', 404);
    }

    if (proposal.freelancerId !== req.user.id) {
        throw new AppError('You can only update your own proposals', 403);
    }

    if (proposal.status !== 'PENDING' || proposal.jobPost.status !== 'OPEN') {
        throw new AppError('Cannot update proposal for jobs that are no longer OPEN or non-PENDING proposals', 400);
    }

    const updatedProposal = await prisma.proposal.update({
        where: { id: req.params.id },
        data: req.body,
    });

    res.status(200).json({ success: true, proposal: updatedProposal });
});

// @route   DELETE /api/proposals/:id
// @access  Private (FREELANCER)
export const deleteProposal = asyncHandler(async (req, res) => {
    const proposal = await prisma.proposal.findUnique({
        where: { id: req.params.id },
    });

    if (!proposal) {
        throw new AppError('Proposal not found', 404);
    }

    if (proposal.freelancerId !== req.user.id) {
        throw new AppError('You can only delete your own proposals', 403);
    }

    if (proposal.status !== 'PENDING') {
        throw new AppError('You can only delete PENDING proposals', 400);
    }

    await prisma.proposal.delete({
        where: { id: req.params.id },
    });

    res.status(200).json({ success: true, message: 'Proposal withdrawn successfully' });
});

// @route   GET /api/proposals/:id
// @access  Private (Yalnız frilanser öz təklifinə VƏ YA müştəri öz işinə gələn təklifə baxa bilər)
export const getProposalById = asyncHandler(async (req, res) => {
    const proposal = await prisma.proposal.findUnique({
        where: { id: req.params.id },
        include: {
            jobPost: {
                select: { id: true, title: true, status: true, clientId: true },
            },
            freelancer: {
                select: { id: true, fullName: true, headline: true, hourlyRate: true },
            },
        },
    });

    if (!proposal) {
        throw new AppError('Proposal not found', 404);
    }

    const isFreelancerOwner = proposal.freelancerId === req.user.id;
    const isClientOwner = proposal.jobPost.clientId === req.user.id;

    if (!isFreelancerOwner && !isClientOwner) {
        throw new AppError('You do not have permission to view this proposal', 403);
    }

    res.status(200).json({ success: true, proposal });
});