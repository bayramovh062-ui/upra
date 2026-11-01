import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

const userSelect = {
    id: true,
    email: true,
    role: true,
    fullName: true,
    headline: true,
    bio: true,
    hourlyRate: true,
    location: true,
    timezone: true,
    availability: true,
    avatarUrl: true,
    deletedAt: true, // Soft delete yoxlaması üçün
    createdAt: true,
};

const extractToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return req.headers.authorization.split(' ')[1];
    }
    return null;
};

export const protect = asyncHandler(async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
        throw new AppError('Unauthorized, please log in (Token not found)', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: userSelect,
    });

    if (!user || user.deletedAt !== null) {
        throw new AppError('The user associated with the token was not found, or their account has been deleted.', 401);
    }

    req.user = user;
    next();
});

// İctimai route-lar üçün: token varsa və düzgündürsə req.user doldurulur, yoxdursa (və ya səhvdirsə) sorğu anonim davam edir.
// Məs. Find Work siyahısı hamıya açıqdır, amma giriş edənə "saxlanmış" və "uyğun" məlumatı da qaytarır.
export const optionalAuth = asyncHandler(async (req, res, next) => {
    const token = extractToken(req);
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: userSelect });
        if (user && user.deletedAt === null) req.user = user;
    } catch {
        // Etibarsız və ya vaxtı keçmiş token: anonim kimi davam
    }
    next();
});

export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this operation.', 403));
        }
        next();
    };
};
