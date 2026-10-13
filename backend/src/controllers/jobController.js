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

    // Axtarış və status süzgəci
    const where = {
        status: 'OPEN',
        ...(search && {
            OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ],
        }),
    };

    // Məlumatları və ümumi sayını paralelləşdirərək bazadan çəkirik
    const [jobs, total] = await Promise.all([
        prisma.jobPost.findMany({
            where,
            include: {
                client: {
                    select: { id: true, fullName: true },
                },
            },
            orderBy: { createdAt: 'desc' },
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
        },
    });

    if (!job) {
        throw new AppError('Job not found', 404);
    }

    res.status(200).json({ success: true, job });
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
        orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, count: jobs.length, jobs });
});