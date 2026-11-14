import prisma from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { redactText, truncate } from './redact.js';

// =====================================================================================
// Admin mübahisə söhbəti üçün kontekst. Xarici AI-yə gedən mətn minimuma endirilir:
//  - tərəflər yalnız "client" / "freelancer" kimi görünür (ad, e-poçt, telefon yoxdur);
//  - istifadəçi mətni redactText-dən keçir, kəsilir və <user_data> blokuna alınır (əmr yox, məlumat);
//  - fayllardan yalnız ad/növ/ölçü gedir, məzmun getmir.
// =====================================================================================

export const MAX_FIELD_CHARS = 500;
export const MAX_MESSAGES = 30;
export const MAX_CONTEXT_CHARS = 12000;
const MAX_FILENAME_CHARS = 100;
const TRUNCATED_MARKER = '\n[truncated]';

// İstifadəçi mətni <user_data> blokunu özü bağlaya bilməsin
const stripTags = (text) => text.replace(/<\/?user_data>/gi, '[tag removed]');

const clean = (value, max = MAX_FIELD_CHARS) =>
    truncate(
        redactText(stripTags(String(value ?? '')))
            .replace(/\s+/g, ' ')
            .trim(),
        max
    );

const userData = (value, max) => `<user_data>${clean(value, max)}</user_data>`;

const dollars = (cents) => `$${(Number(cents) / 100).toFixed(2)}`;

const iso = (value) => (value instanceof Date ? value.toISOString() : String(value ?? ''));

const fileLine = (f) => `${clean(f.filename, MAX_FILENAME_CHARS)} (${clean(f.mimeType, 60)}, ${Number(f.size) || 0} bytes)`;

// Təmiz funksiya: DisputeData -> mətn. Verilənlər bazasına toxunmur (test üçün rahatdır).
// DisputeData: {
//   status, reason, details, openedByRole: 'client'|'freelancer',
//   milestone: { title, amountCents, status, revisionCount, maxRevisions },
//   submissions: [{ type, actorRole, revisionNumber, note, createdAt, attachments: [{ filename, mimeType, size }] }],
//   evidence: [{ uploaderRole, filename, mimeType, size }],
//   messages: [{ role, createdAt, body }]   // köhnədən yeniyə
// }
export const formatDisputeContext = (data) => {
    const lines = [];

    lines.push('DISPUTE');
    lines.push(`Status: ${data.status}`);
    lines.push(`Opened by: ${data.openedByRole}`);
    lines.push(`Reason: ${userData(data.reason)}`);
    if (data.details) lines.push(`Details: ${userData(data.details)}`);

    const m = data.milestone;
    lines.push('');
    lines.push('MILESTONE');
    lines.push(`Title: ${userData(m.title, 120)}`);
    lines.push(`Amount held in escrow: ${dollars(m.amountCents)} (${m.amountCents} cents)`);
    lines.push(`Status: ${m.status}`);
    lines.push(`Revision requests used: ${m.revisionCount} of ${m.maxRevisions}`);

    lines.push('');
    lines.push('SUBMISSION AND REVISION HISTORY (oldest first)');
    if (!data.submissions?.length) {
        lines.push('(none)');
    } else {
        data.submissions.forEach((s, i) => {
            lines.push(`${i + 1}. [${iso(s.createdAt)}] ${s.actorRole} ${s.type} (revision ${s.revisionNumber})`);
            if (s.note) lines.push(`   Note: ${userData(s.note)}`);
            if (s.attachments?.length) lines.push(`   Files: ${s.attachments.map(fileLine).join('; ')}`);
        });
    }

    lines.push('');
    lines.push('EVIDENCE FILES (names only; the admin can open them in the dispute screen)');
    if (!data.evidence?.length) {
        lines.push('(none)');
    } else {
        data.evidence.forEach((f) => lines.push(`- ${f.uploaderRole}: ${fileLine(f)}`));
    }

    const messages = (data.messages ?? []).slice(-MAX_MESSAGES);
    lines.push('');
    lines.push(`CONVERSATION BETWEEN CLIENT AND FREELANCER (last ${messages.length} messages, oldest first)`);
    if (messages.length === 0) {
        lines.push('(no messages)');
    } else {
        messages.forEach((msg) => lines.push(`[${iso(msg.createdAt)}] ${msg.role}: ${userData(msg.body)}`));
    }

    const text = lines.join('\n');
    if (text.length <= MAX_CONTEXT_CHARS) return text;
    return text.slice(0, MAX_CONTEXT_CHARS - TRUNCATED_MARKER.length) + TRUNCATED_MARKER;
};

export const buildDisputeContext = async (disputeId) => {
    const dispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        select: {
            status: true,
            reason: true,
            details: true,
            openedById: true,
            contract: { select: { clientId: true, freelancerId: true } },
            milestone: {
                select: { id: true, title: true, amountCents: true, status: true, revisionCount: true, maxRevisions: true },
            },
            attachments: {
                orderBy: { createdAt: 'asc' },
                take: 20,
                select: { filename: true, mimeType: true, size: true, uploadedById: true },
            },
        },
    });

    if (!dispute) throw new AppError('Dispute not found', 404);

    const { clientId, freelancerId } = dispute.contract;
    const roleOf = (userId) => (userId === clientId ? 'client' : 'freelancer');

    const [submissions, conversation] = await Promise.all([
        prisma.milestoneSubmission.findMany({
            where: { milestoneId: dispute.milestone.id },
            orderBy: { createdAt: 'asc' },
            take: 20,
            select: {
                type: true,
                actorId: true,
                revisionNumber: true,
                note: true,
                createdAt: true,
                attachments: { select: { filename: true, mimeType: true, size: true } },
            },
        }),
        prisma.conversation.findUnique({
            where: { clientId_freelancerId: { clientId, freelancerId } },
            select: { id: true },
        }),
    ]);

    let messages = [];
    if (conversation) {
        const rows = await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'desc' },
            take: MAX_MESSAGES,
            select: { senderId: true, body: true, createdAt: true },
        });
        messages = rows.reverse().map((r) => ({ role: roleOf(r.senderId), createdAt: r.createdAt, body: r.body }));
    }

    return formatDisputeContext({
        status: dispute.status,
        reason: dispute.reason,
        details: dispute.details,
        openedByRole: roleOf(dispute.openedById),
        milestone: dispute.milestone,
        submissions: submissions.map((s) => ({
            type: s.type,
            actorRole: roleOf(s.actorId),
            revisionNumber: s.revisionNumber,
            note: s.note,
            createdAt: s.createdAt,
            attachments: s.attachments,
        })),
        evidence: dispute.attachments.map((a) => ({
            uploaderRole: roleOf(a.uploadedById),
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
        })),
        messages,
    });
};
