import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

// @route   DELETE /api/auth/me
// @access  Private (parol tələb olunur)
// Soft delete: sətir bazadan silinmir (müqavilə tarixçəsi qalır), amma kişi məlumatı təmizlənir
// və e-poçt boşaltılır ki, aynı adı yenidən qeydiyyat etmək olsun.
export const deleteAccount = asyncHandler(async (req, res) => {
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new AppError('Password is incorrect.', 400); // 400, 401 yox: frontend 401-də sessiyadan çıxarır
    }

    const activeContracts = await prisma.contract.count({
        where: {
            status: { in: ['ACTIVE', 'DELIVERED'] },
            OR: [{ clientId: user.id }, { freelancerId: user.id }],
        },
    });

    if (activeContracts > 0) {
        throw new AppError(
            'You have active contracts. Complete or cancel them before deleting your account.',
            400
        );
    }

    await prisma.$transaction([
        // Client: açıq elanlar ləğv olunur, gözləyən təkliflər rədd edilir
        prisma.proposal.updateMany({
            where: { status: 'PENDING', jobPost: { clientId: user.id, status: 'OPEN' } },
            data: { status: 'REJECTED' },
        }),
        prisma.jobPost.updateMany({
            where: { clientId: user.id, status: 'OPEN' },
            data: { status: 'CANCELLED' },
        }),
        // Freelancer: gözləyən təkliflər geri çəkilir
        prisma.proposal.deleteMany({ where: { freelancerId: user.id, status: 'PENDING' } }),
        prisma.user.update({
            where: { id: user.id },
            data: {
                deletedAt: new Date(),
                email: `deleted-${user.id}@deleted.upra.local`,
                fullName: 'Deleted user',
                headline: null,
                bio: null,
                hourlyRate: null,
                passwordHash: '!',
            },
        }),
    ]);

    res.status(200).json({ success: true, message: 'Account deleted successfully.' });
});

// @route   GET /api/users/:id
// @access  Private: ictimai profil (email və həssas sahələr yoxdur)
export const getUserProfile = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            id: true,
            fullName: true,
            role: true,
            headline: true,
            bio: true,
            hourlyRate: true,
            createdAt: true,
            deletedAt: true,
        },
    });

    if (!user || user.deletedAt !== null) {
        throw new AppError('User not found', 404);
    }

    const isClient = user.role === 'CLIENT';

    const [completedContracts, jobsPosted] = await Promise.all([
        prisma.contract.count({
            where: { status: 'COMPLETED', ...(isClient ? { clientId: user.id } : { freelancerId: user.id }) },
        }),
        isClient ? prisma.jobPost.count({ where: { clientId: user.id } }) : Promise.resolve(null),
    ]);

    const { deletedAt, ...publicUser } = user;

    res.status(200).json({
        success: true,
        user: publicUser,
        stats: { completedContracts, jobsPosted },
    });
});

// @route   GET /api/dashboard/stats
// @access  Private (CLIENT & FREELANCER): rola görə ümumi rəqəmlər
export const getDashboardStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const isClient = req.user.role === 'CLIENT';

    const contractOwner = isClient ? { clientId: userId } : { freelancerId: userId };

    const [activeContracts, completedContracts] = await Promise.all([
        prisma.contract.count({ where: { ...contractOwner, status: { in: ['ACTIVE', 'DELIVERED'] } } }),
        prisma.contract.count({ where: { ...contractOwner, status: 'COMPLETED' } }),
    ]);

    if (isClient) {
        const [openJobs, proposalsToReview] = await Promise.all([
            prisma.jobPost.count({ where: { clientId: userId, status: 'OPEN' } }),
            prisma.proposal.count({
                where: { status: 'PENDING', jobPost: { clientId: userId, status: 'OPEN' } },
            }),
        ]);

        return res.status(200).json({
            success: true,
            stats: { openJobs, proposalsToReview, activeContracts, completedContracts },
        });
    }

    const [pendingProposals, acceptedProposals] = await Promise.all([
        prisma.proposal.count({ where: { freelancerId: userId, status: 'PENDING' } }),
        prisma.proposal.count({ where: { freelancerId: userId, status: 'ACCEPTED' } }),
    ]);

    res.status(200).json({
        success: true,
        stats: { activeContracts, pendingProposals, acceptedProposals, completedContracts },
    });
});
