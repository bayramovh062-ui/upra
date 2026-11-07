import prisma from '../config/db.js';
import { emitToUser } from '../socket.js';
import { logger } from '../utils/logger.js';

// =====================================================================================
// Bildiriş servisi. Bildiriş əsas əməliyyatı HEÇ VAXT pozmamalıdır: xəta olsa yalnız loglanır.
// Əməliyyat uğurla bitəndən SONRA çağırılır (tranzaksiyanın daxilində yox).
// =====================================================================================

export const NOTIFICATION_TYPES = {
    PROPOSAL_RECEIVED: 'PROPOSAL_RECEIVED',
    CONTRACT_OFFERED: 'CONTRACT_OFFERED',
    CONTRACT_ACCEPTED: 'CONTRACT_ACCEPTED',
    CONTRACT_DECLINED: 'CONTRACT_DECLINED',
    CONTRACT_COMPLETED: 'CONTRACT_COMPLETED',
    CONTRACT_CANCELLED: 'CONTRACT_CANCELLED',
    CANCEL_REQUESTED: 'CANCEL_REQUESTED',
    CANCEL_DECLINED: 'CANCEL_DECLINED',
    CANCEL_WITHDRAWN: 'CANCEL_WITHDRAWN',
    MILESTONE_FUNDED: 'MILESTONE_FUNDED',
    MILESTONE_SUBMITTED: 'MILESTONE_SUBMITTED',
    CHANGES_REQUESTED: 'CHANGES_REQUESTED',
    MILESTONE_PAID: 'MILESTONE_PAID',
    MILESTONE_AUTO_APPROVED: 'MILESTONE_AUTO_APPROVED',
    ISSUE_ASSIGNED: 'ISSUE_ASSIGNED',
    COMMENT_ADDED: 'COMMENT_ADDED',
    DISPUTE_OPENED: 'DISPUTE_OPENED',
    DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',
};

export const formatUsd = (cents) => `$${(cents / 100).toFixed(2)}`;

// Bir istifadəçiyə bildiriş yazır və açıq tab/cihazlarına socket ilə göndərir.
// input: { type, title, body?, link?, data? }
export const notify = async (userId, input) => {
    if (!userId) return null;

    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                type: input.type,
                title: input.title,
                body: input.body ?? null,
                link: input.link ?? null,
                data: input.data ?? undefined,
            },
        });

        emitToUser(userId, 'notification:new', notification);
        return notification;
    } catch (err) {
        logger.error(`Notification failed (${input?.type} -> ${userId}): ${err.message}`, { stack: err.stack });
        return null;
    }
};

// Bir neçə alıcıya eyni bildiriş (məs. hər iki tərəfə)
export const notifyMany = (userIds, input) => Promise.all([...new Set(userIds)].map((id) => notify(id, input)));

// Müqavilənin qarşı tərəfi
export const otherParty = (contract, userId) => (contract.clientId === userId ? contract.freelancerId : contract.clientId);
