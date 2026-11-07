import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const parseLimit = (value) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
};

// @route   GET /api/notifications?limit=30&unread=true
// @access  Private. Ən yenilər əvvəldə. unreadCount həmişə bütün oxunmamışların sayıdır (limitdən asılı deyil).
export const getNotifications = asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit);
    const onlyUnread = req.query.unread === 'true';

    const where = { userId: req.user.id, ...(onlyUnread && { readAt: null }) };

    const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: limit,
        }),
        prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
    ]);

    res.status(200).json({ success: true, count: notifications.length, unreadCount, notifications });
});

// @route   GET /api/notifications/unread-count
// @access  Private. Zəng nişanı üçün yüngül sorğu
export const getUnreadCount = asyncHandler(async (req, res) => {
    const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
    res.status(200).json({ success: true, unreadCount });
});

// @route   PATCH /api/notifications/:id/read
// @access  Private. Yalnız öz bildirişi; başqasınınkı və ya olmayan 404 (varlığı sızdırmır). Təkrar çağırış zərərsizdir.
export const markRead = asyncHandler(async (req, res) => {
    const existing = await prisma.notification.findFirst({
        where: { id: req.params.id, userId: req.user.id },
        select: { id: true },
    });
    if (!existing) {
        throw new AppError('Notification not found', 404);
    }

    await prisma.notification.updateMany({
        where: { id: existing.id, userId: req.user.id, readAt: null },
        data: { readAt: new Date() },
    });

    const notification = await prisma.notification.findUnique({ where: { id: existing.id } });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });

    res.status(200).json({ success: true, notification, unreadCount });
});

// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllRead = asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
        where: { userId: req.user.id, readAt: null },
        data: { readAt: new Date() },
    });

    res.status(200).json({ success: true, updated: result.count, unreadCount: 0 });
});
