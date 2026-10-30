import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

// @route   POST /api/jobs
export const createJob = asyncHandler(async (req, res) => {
    const { title, description, budget } = req.body;

    const job = await prisma.jobPost.create({
        data: {
            title,
            description,
            budget,
            clientId: req.user.id,
        },
    });

    res.status(201).json({ success: true, job });
});

// @route   GET /api/jobs
export const getAllJobs = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const search = req.query.search?.trim() || '';

    const skip = (page - 1) * limit;

    // Büdcə filtri: yalnız müsbət rəqəm qəbul olunur
    const minBudget = Number(req.query.minBudget);
    const maxBudget = Number(req.query.maxBudget);
    const budgetFilter = {
        ...(Number.isFinite(minBudget) && minBudget > 0 && { gte: minBudget }),
        ...(Number.isFinite(maxBudget) && maxBudget > 0 && { lte: maxBudget }),
    };

    const SORT_OPTIONS = {
        newest: { createdAt: 'desc' },
        budget_desc: { budget: 'desc' },
        budget_asc: { budget: 'asc' },
    };
    const orderBy = SORT_OPTIONS[req.query.sort] || SORT_OPTIONS.newest;

    const where = {
        status: 'OPEN',
        ...(Object.keys(budgetFilter).length > 0 && { budget: budgetFilter }),
        ...(search && {
            OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ],
        }),
    };

    const [jobs, total] = await Promise.all([
        prisma.jobPost.findMany({
            where,
            include: {
                client: {
                    select: { id: true, fullName: true },
                },
                _count: { select: { proposals: true } },
            },
            orderBy,
            skip,
            take: limit,
        }),
        prisma.jobPost.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
        success: true,
        count: jobs.length,
        pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
        jobs,
    });
});

// @route   GET /api/jobs/:id
export const getJob = asyncHandler(async (req, res) => {
    const job = await prisma.jobPost.findUnique({
        where: { id: req.params.id },
        include: {
            client: { select: { id: true, fullName: true, createdAt: true } },
            _count: { select: { proposals: true } },
        },
    });

    if (!job) {
        throw new AppError('Job not found', 404);
    }

    // Frilanser üçün: bu işə artıq təklif göndərib-göndərmədiyi
    let myProposal = null;
    if (req.user.role === 'FREELANCER') {
        myProposal = await prisma.proposal.findUnique({
            where: {
                jobPostId_freelancerId: { jobPostId: job.id, freelancerId: req.user.id },
            },
            select: { id: true, coverLetter: true, bidAmount: true, status: true, createdAt: true },
        });
    }

    res.status(200).json({ success: true, job, myProposal });
});

// @route   PATCH /api/jobs/:id
export const updateJob = asyncHandler(async (req, res) => {
    const job = await prisma.jobPost.findUnique({ where: { id: req.params.id } });

    if (!job) {
        throw new AppError('Job not found', 404);
    }

    if (job.clientId !== req.user.id) {
        throw new AppError('You can only update your own job posts', 403);
    }

    if (job.status !== 'OPEN') {
        throw new AppError('You can only update with open status job', 400)
    }

    const updatedJob = await prisma.jobPost.update({
        where: { id: req.params.id },
        data: req.body,
    });

    res.status(200).json({ success: true, job: updatedJob });
});

// @route   DELETE /api/jobs/:id
export const deleteJob = asyncHandler(async (req, res) => {
    const job = await prisma.jobPost.findUnique({ where: { id: req.params.id } });

    if (!job) {
        throw new AppError('Job not found', 404);
    }

    if (job.clientId !== req.user.id) {
        throw new AppError('You can only delete your own job posts', 403);
    }

    if (job.status !== 'OPEN') {
        throw new AppError('You can only delete with open status job', 400)
    }

    await prisma.jobPost.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
    });

    res.status(200).json({ success: true, message: 'Job cancelled successfully' });
});

// @route   GET /api/jobs/my
export const getMyJobs = asyncHandler(async (req, res) => {
    const jobs = await prisma.jobPost.findMany({
        where: { clientId: req.user.id },
        include: { _count: { select: { proposals: true } } },
        orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, count: jobs.length, jobs });
});