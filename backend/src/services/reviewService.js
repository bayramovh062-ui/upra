import prisma from '../config/db.js';

// P3: reputasiya yalnız Review cədvəlindən törədir (counter saxlanmır).
// reviewCount 0 olduqda avgRating null qaytarır ki, frontend "No reviews yet" göstərsin.
export const getReputation = async (userId) => {
    const aggregate = await prisma.review.aggregate({
        where: { revieweeId: userId },
        _avg: { rating: true },
        _count: { _all: true },
    });

    const reviewCount = aggregate._count._all;
    const avgRating = reviewCount === 0 ? null : Number(aggregate._avg.rating.toFixed(2));

    return { avgRating, reviewCount };
};
