import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

// Testdə limit praktiki olaraq söndürülür, lokal inkişafda geniş, canlıda sərtdir
const pick = (prod, dev) => (isTest ? 10_000 : isProd ? prod : dev);

const tooMany = (text) => ({ success: false, message: text });

// Login: yalnız UĞURSUZ cəhdlər sayılır (skipSuccessfulRequests).
// Düzgün parolla girən istifadəçi heç vaxt bloklanmır, parol təxmin edənlər isə 15 dəqiqədə 10 cəhdlə məhdudlaşır.
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: pick(10, 100),
    skipSuccessfulRequests: true,
    message: tooMany('Too many failed login attempts. Please try again in 15 minutes.'),
    standardHeaders: true,
    legacyHeaders: false,
});

// Register: uğurlu qeydiyyat da sayılır, çünki məqsəd kütləvi hesab yaratmağın qarşısını almaqdır
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: pick(20, 200),
    message: tooMany('Too many accounts created from this IP. Please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
});

// Köhnə ad: başqa yerdə import olunubsa sınmasın
export const authLimiter = loginLimiter;
