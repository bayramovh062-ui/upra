import crypto from 'node:crypto';
import prisma from '../config/db.js';

// Açıq token yalnız e-poçt linkindədir; bazada SHA-256 hash-i saxlanılır (DB sızsa belə token oğurlana bilməz).
export const TOKEN_TTL_MS = {
    EMAIL_VERIFY: 24 * 60 * 60 * 1000,
    PASSWORD_RESET: 60 * 60 * 1000,
};

export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Yeni token yaradır (eyni istifadəçi + tip üçün köhnə istifadə olunmamışlar silinir) və AÇIQ token qaytarır.
export const issueAuthToken = async (userId, type, db = prisma) => {
    const token = crypto.randomBytes(32).toString('hex');

    await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
    await db.authToken.create({
        data: {
            userId,
            type,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
        },
    });

    return token;
};

// Tokeni atomik "istifadə olunmuş" edir (şərti updateMany: eyni anda iki sorğu eyni tokeni işlədə bilməz).
// Uğurlu olarsa userId, əks halda null qaytarır. Tranzaksiya müştərisi (tx) ilə çağırılmalıdır.
export const consumeAuthToken = async (tx, token, type) => {
    const tokenHash = hashToken(token);

    const claimed = await tx.authToken.updateMany({
        where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;

    const row = await tx.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
    return row?.userId ?? null;
};

// İstifadə olunmuş (amma vaxtı keçməmiş) tokenin sahibi: təsdiq linkinə ikinci dəfə (məs. e-poçt skaneri) klikləməni
// "xəta" saymamaq üçün istifadə olunur.
export const findUsedAuthTokenOwner = async (token, type) => {
    const row = await prisma.authToken.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { userId: true, type: true, usedAt: true },
    });
    if (!row || row.type !== type || !row.usedAt) return null;
    return row.userId;
};

// Köhnə tokenləri təmizləyir (cron və ya istənilən vaxt çağırıla bilər)
export const purgeExpiredAuthTokens = () =>
    prisma.authToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }] },
    });
