import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { verifyContractAccess } from '../utils/contractAccess.js';
import { notify, NOTIFICATION_TYPES as N } from '../services/notificationService.js';

const REVIEW_USER_SELECT = { id: true, fullName: true, role: true, avatarUrl: true };

const reviewInclude = {
    reviewer: { select: REVIEW_USER_SELECT },
    reviewee: { select: REVIEW_USER_SELECT },
};

const revieweeOf = (contract, userId) =>
    contract.clientId === userId ? contract.freelancerId : contract.clientId;

// @route   GET /api/contracts/:id/reviews
// @access  Private (müqavilənin tərəfləri)
// Rəy siyahısı + cari istifadəçi üçün uyğunluq məlumatı (frontend düyməni buna görə göstərir).
export const getContractReviews = asyncHandler(async (req, res) => {
    const contract = await verifyContractAccess(req.params.id, req.user.id);
    const revieweeId = revieweeOf(contract, req.user.id);

    const reviews = await prisma.review.findMany({
        where: { contractId: contract.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: reviewInclude,
    });

    const myReview = reviews.find((review) => review.reviewerId === req.user.id) ?? null;
    const isCompleted = contract.status === 'COMPLETED';

    let reason = null;
    if (!isCompleted) {
        reason = 'You can review this contract only after it is completed.';
    } else if (myReview) {
        reason = 'You have already reviewed this contract.';
    }

    res.status(200).json({
        success: true,
        reviews,
        eligibility: {
            canReview: isCompleted && !myReview,
            alreadyReviewed: Boolean(myReview),
            revieweeId,
            reason,
        },
    });
});

// @route   POST /api/contracts/:id/reviews
// @access  Private (müqavilənin tərəfləri). Body: { rating: 1..5, comment? }
// Qaydalar: yalnız COMPLETED müqavilə, yalnız qarşı tərəf, hər tərəf bir dəfə, yaradıldıqdan sonra dəyişməz.
export const createContractReview = asyncHandler(async (req, res) => {
    const contract = await verifyContractAccess(req.params.id, req.user.id);

    if (contract.status !== 'COMPLETED') {
        throw new AppError('You can review this contract only after it is completed.', 400);
    }

    const revieweeId = revieweeOf(contract, req.user.id);
    if (!revieweeId || revieweeId === req.user.id) {
        throw new AppError('You cannot review yourself.', 400);
    }

    const existing = await prisma.review.findUnique({
        where: { contractId_reviewerId: { contractId: contract.id, reviewerId: req.user.id } },
        select: { id: true },
    });
    if (existing) {
        throw new AppError('You have already reviewed this contract.', 409);
    }

    const review = await prisma.review.create({
        data: {
            contractId: contract.id,
            reviewerId: req.user.id,
            revieweeId,
            rating: req.body.rating,
            comment: req.body.comment?.trim() || null,
        },
        include: reviewInclude,
    });

    const jobTitle = contract.jobPost?.title || 'the contract';
    await notify(revieweeId, {
        type: N.REVIEW_RECEIVED,
        title: 'You received a new review',
        body: `${req.user.fullName} left you a ${review.rating}-star review for "${jobTitle}".`,
        link: `/contracts/${contract.id}`,
        data: { contractId: contract.id, reviewId: review.id, rating: review.rating },
    });

    res.status(201).json({ success: true, review });
});
