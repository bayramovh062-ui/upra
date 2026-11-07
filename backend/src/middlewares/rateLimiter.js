import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { logger } from '../utils/logger.js';

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

// Testdə limit praktiki olaraq söndürülür, lokal inkişafda geniş, canlıda sərtdir (yalnız register üçün)
const pick = (prod, dev) => (isTest ? 10_000 : isProd ? prod : dev);

const tooMany = (text, retryAfter) => ({ success: false, message: text, retryAfter });

// ================= LOGIN: yalnız uğursuz cəhdlər =================
// 5 uğursuz cəhd (15 dəqiqə ərzində) -> həmin IP 15 dəqiqəlik bloklanır.
// Uğurlu giriş həmin IP-dən HƏMİN hesaba edilmiş uğursuz cəhdləri silir. Başqa hesablara edilən cəhdlər qalır,
// yoxsa hücumçu öz hesabına girib sayğacı sıfırlaya və sonsuz parol təxmin edə bilərdi.
// Hesab səviyyəsində bloklama yoxdur: əks halda hər kəs başqasının e-poçtunu yazıb onu bloklaya bilərdi.
export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;

// Bir proses daxilində yaddaşda saxlanır. Bir neçə instansiya işlədilsə, ortaq store (məs. Redis) lazımdır.
export class FailedLoginStore {
    constructor({ maxAttempts, windowMs, blockMs, now = Date.now, sweepIntervalMs = 60 * 1000 }) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.blockMs = blockMs;
        this.now = now;
        this.entries = new Map();

        if (sweepIntervalMs > 0) {
            this.sweeper = setInterval(() => this.sweep(), sweepIntervalMs);
            this.sweeper.unref?.();
        }
    }

    sweep() {
        const now = this.now();
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now && entry.pending === 0) this.entries.delete(key);
        }
    }

    get(key) {
        const entry = this.entries.get(key);
        if (!entry) return null;
        const now = this.now();
        const expired = entry.expiresAt <= now || (entry.blockedUntil > 0 && entry.blockedUntil <= now);
        if (expired && entry.pending === 0) {
            this.entries.delete(key);
            return null;
        }
        return entry;
    }

    getOrCreate(key) {
        let entry = this.get(key);
        if (!entry) {
            entry = { failures: new Map(), total: 0, pending: 0, blockedUntil: 0, expiresAt: this.now() + this.windowMs };
            this.entries.set(key, entry);
        }
        return entry;
    }

    // { blocked, retryAfterMs }. Davam edən (cavabı gözlənilən) cəhdlər də sayılır ki,
    // eyni anda göndərilən çoxlu sorğu limiti keçə bilməsin.
    check(key) {
        const entry = this.get(key);
        if (!entry) return { blocked: false, retryAfterMs: 0 };

        const now = this.now();
        if (entry.blockedUntil > now) return { blocked: true, retryAfterMs: entry.blockedUntil - now };
        if (entry.total + entry.pending >= this.maxAttempts) {
            return { blocked: true, retryAfterMs: Math.max(1000, entry.expiresAt - now) };
        }
        return { blocked: false, retryAfterMs: 0 };
    }

    begin(key) {
        this.getOrCreate(key).pending += 1;
    }

    // Cavabı gəlmiş cəhdin rezervini götürür
    settle(key) {
        const entry = this.getOrCreate(key);
        entry.pending = Math.max(0, entry.pending - 1);
        return entry;
    }

    recordFailure(key, account) {
        const entry = this.settle(key);
        entry.failures.set(account, (entry.failures.get(account) || 0) + 1);
        entry.total += 1;

        if (entry.total >= this.maxAttempts) {
            entry.blockedUntil = this.now() + this.blockMs;
            entry.expiresAt = Math.max(entry.expiresAt, entry.blockedUntil);
        }
        return entry;
    }

    recordSuccess(key, account) {
        const entry = this.settle(key);
        entry.total -= entry.failures.get(account) || 0;
        entry.failures.delete(account);
        this.cleanup(key, entry);
    }

    // Etimadnamə yoxlanmayıb (məs. validasiya xətası): cəhd sayılmır
    release(key) {
        this.cleanup(key, this.settle(key));
    }

    cleanup(key, entry) {
        if (entry.total === 0 && entry.pending === 0 && entry.blockedUntil <= this.now()) {
            this.entries.delete(key);
        }
    }

    resetKey(key) {
        this.entries.delete(key);
    }

    resetAll() {
        this.entries.clear();
    }
}

// IPv6 ünvanları /56 alt şəbəkəyə qədər qruplaşdırılır (express-rate-limit-in tövsiyəsi)
const ipKey = (req) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || 'unknown');

// Login validasiyadan ƏVVƏL işləyir, ona görə e-poçt burada özümüz normallaşdırırıq
const accountKey = (req) => (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '');

const minutesText = (ms) => {
    const minutes = Math.max(1, Math.ceil(ms / 60000));
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
};

// Nəticə cavabın status kodundan oxunur: 401 = səhv email/parol, 2xx = uğurlu giriş, qalanları sayılmır.
// Bağlantı cavabdan əvvəl qopsa cəhd uğursuz sayılır (hücumçu sorğunu kəsib sayğacdan yayına bilməsin).
export const createFailedLoginLimiter = ({
    maxAttempts = LOGIN_MAX_FAILED_ATTEMPTS,
    windowMs = LOGIN_FAILURE_WINDOW_MS,
    blockMs = LOGIN_BLOCK_MS,
    now,
    sweepIntervalMs,
} = {}) => {
    const store = new FailedLoginStore({ maxAttempts, windowMs, blockMs, now, sweepIntervalMs });

    const middleware = (req, res, next) => {
        const key = ipKey(req);
        const { blocked, retryAfterMs } = store.check(key);

        if (blocked) {
            const retryAfter = Math.ceil(retryAfterMs / 1000);
            logger.warn(`Login blocked after repeated failures - ${req.originalUrl} - ${req.ip}`);
            res.set('Retry-After', String(retryAfter));
            return res
                .status(429)
                .json(
                    tooMany(
                        `Too many failed login attempts. Please try again in ${minutesText(retryAfterMs)}.`,
                        retryAfter
                    )
                );
        }

        const account = accountKey(req);
        store.begin(key);

        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;

            if (!res.writableFinished || res.statusCode === 401) {
                const entry = store.recordFailure(key, account);
                if (entry.blockedUntil > 0 && entry.total === maxAttempts) {
                    logger.warn(`Login temporarily blocked for IP ${req.ip} after ${maxAttempts} failed attempts`);
                }
            } else if (res.statusCode >= 200 && res.statusCode < 300) {
                store.recordSuccess(key, account);
            } else {
                store.release(key);
            }
        };

        res.on('finish', settle);
        res.on('close', settle);
        next();
    };

    middleware.store = store;
    middleware.resetKey = (key) => store.resetKey(key);
    return middleware;
};

export const loginLimiter = createFailedLoginLimiter();

// ================= REGISTER =================
// Uğurlu qeydiyyat da sayılır, çünki məqsəd kütləvi hesab yaratmağın qarşısını almaqdır. Login sayğacından asılı deyil.
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: pick(20, 200),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        const retryAfterMs = Math.max(0, (req.rateLimit?.resetTime?.getTime() ?? Date.now()) - Date.now());
        res.status(options.statusCode).json(
            tooMany(
                `Too many accounts created from this IP. Please try again in ${minutesText(retryAfterMs)}.`,
                Math.ceil(retryAfterMs / 1000)
            )
        );
    },
});

// Köhnə ad: başqa yerdə import olunubsa sınmasın
export const authLimiter = loginLimiter;

// ================= WALLET TOP-UP (demo) =================
// İstifadəçi başına saatda 30 sorğu. Bir sorğunun özünün də limiti var ($5000), amma
// limitsiz çoxlu sorğu göndərib demo balansını sınırsız artırmaq olmasın. Açar: giriş etmiş istifadəçi (protect-dən sonra işləyir).
export const topUpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: pick(30, 300),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKey(req)),
    handler: (req, res, next, options) => {
        const retryAfterMs = Math.max(0, (req.rateLimit?.resetTime?.getTime() ?? Date.now()) - Date.now());
        res.status(options.statusCode).json(
            tooMany(
                `Too many top-up requests. Please try again in ${minutesText(retryAfterMs)}.`,
                Math.ceil(retryAfterMs / 1000)
            )
        );
    },
});

// ================= ÇAT MESAJLARI =================
// İstifadəçi başına dəqiqədə 30 mesaj: normal yazışmayı pozmur, spam axınının qarşısını alır. Açar: protect-dən sonra istifadəçi.
export const messageLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: pick(30, 300),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKey(req)),
    handler: (req, res, next, options) => {
        const retryAfterMs = Math.max(0, (req.rateLimit?.resetTime?.getTime() ?? Date.now()) - Date.now());
        res.status(options.statusCode).json(
            tooMany(
                `You are sending messages too fast. Please try again in ${minutesText(retryAfterMs)}.`,
                Math.ceil(retryAfterMs / 1000)
            )
        );
    },
});
