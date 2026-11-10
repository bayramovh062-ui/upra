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
    isSuspended: true, // P3: suspend olunmuş hesab qorunan əməliyyat edə bilməz
    emailVerified: true, // Phase B: təsdiqlənməmiş hesab iş/təklif yarada bilməz (requireVerifiedEmail)
    tokenVersion: true, // Phase B: parol sıfırlanandan sonra köhnə JWT-lər etibarsız olur
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

    // P3: suspend olunmuş istifadəçi mövcud tokenlə də qorunan əməliyyatları yerinə yetirə bilməz.
    if (user.isSuspended) {
        throw new AppError('Your account is suspended. Contact support for help.', 403);
    }

    // Phase B: parol sıfırlanandan sonra köhnə sessiyalar. `ver` olmayan köhnə tokenlər 0 sayılır.
    if ((decoded.ver ?? 0) !== user.tokenVersion) {
        throw new AppError('Your session is no longer valid. Please log in again.', 401);
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
        if (user && user.deletedAt === null && !user.isSuspended && (decoded.ver ?? 0) === user.tokenVersion) req.user = user;
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

// Phase B: e-poçt təsdiqlənməmiş hesab iş yarada/dərc edə və təklif göndərə bilməz.
// Qapı REQUIRE_EMAIL_VERIFICATION=true/false ilə idarə olunur; təyin olunmayıbsa yalnız production-da aktivdir
// (lokal inkişaf və mövcud testlər təsdiq tələb olunmadan işləyir).
export const emailVerificationRequired = () => {
    const flag = String(process.env.REQUIRE_EMAIL_VERIFICATION ?? '').trim().toLowerCase();
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return process.env.NODE_ENV === 'production';
};

export const requireVerifiedEmail = (req, res, next) => {
    if (!emailVerificationRequired() || req.user?.emailVerified) return next();
    next(new AppError('Please verify your email address before doing this.', 403, 'EMAIL_NOT_VERIFIED'));
};
