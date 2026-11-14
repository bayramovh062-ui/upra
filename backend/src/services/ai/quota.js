import prisma from '../../config/db.js';

// =====================================================================================
// AI gündəlik kvota (UTC günü). Bir istifadəçi mesajı = bir vahid.
// reserve() atomikdir: tək INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit.
// Paralel sorğular limiti keçə bilmir. Provayder uğursuz olarsa refund() çağırılır.
// =====================================================================================

const dayString = (now) => now.toISOString().slice(0, 10); // UTC YYYY-MM-DD
const dayDate = (now) => new Date(`${dayString(now)}T00:00:00.000Z`);

export const reserve = async (userId, kind, limit, now = new Date()) => {
    if (!Number.isInteger(limit) || limit <= 0) return { ok: false, used: 0 };

    const day = dayString(now);
    const rows = await prisma.$queryRaw`
        INSERT INTO "AiUsage" ("userId", "day", "kind", "count")
        VALUES (${userId}, ${day}::date, ${kind}::"AiUsageKind", 1)
        ON CONFLICT ("userId", "day", "kind")
        DO UPDATE SET "count" = "AiUsage"."count" + 1
        WHERE "AiUsage"."count" < ${limit}
        RETURNING "count"`;

    if (rows.length === 0) {
        return { ok: false, used: await getUsed(userId, kind, now) };
    }
    return { ok: true, used: Number(rows[0].count) };
};

export const refund = async (userId, kind, now = new Date()) => {
    await prisma.aiUsage.updateMany({
        where: { userId, kind, day: dayDate(now), count: { gt: 0 } },
        data: { count: { decrement: 1 } },
    });
};

export const getUsed = async (userId, kind, now = new Date()) => {
    const row = await prisma.aiUsage.findUnique({
        where: { userId_day_kind: { userId, day: dayDate(now), kind } },
        select: { count: true },
    });
    return row?.count ?? 0;
};

// Növbəti UTC gecə yarısı (kvota sıfırlanma vaxtı)
export const nextResetAt = (now = new Date()) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
