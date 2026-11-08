import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
    verifyContractAccess,
    assertAssigneeInContract,
    assertContractActive, // Import olundu
} from '../utils/contractAccess.js';
import { emitToContract } from '../socket.js';
import { assertWorkFunded } from '../services/financialService.js';
import { notify, otherParty, NOTIFICATION_TYPES as N } from '../services/notificationService.js';

const ATTACHMENT_SELECT = { id: true, url: true, filename: true, mimeType: true, size: true, purpose: true, uploadedById: true, createdAt: true };

const MIN_POSITION_GAP = 0.001;

const excerpt = (text, max = 120) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

// Təyinat bildirişi: özünü təyin edənə göndərilmir
const notifyAssigned = (contract, issue, assigneeId, actor) => {
    if (!assigneeId || assigneeId === actor.id) return null;
    return notify(assigneeId, {
        type: N.ISSUE_ASSIGNED,
        title: 'Task assigned to you',
        body: `${actor.fullName} assigned you "${issue.title}".`,
        link: `/contracts/${contract.id}`,
        data: { contractId: contract.id, issueId: issue.id },
    });
};

// @route   GET /api/contracts/:contractId/issues
// @access  Private (Contract Client & Freelancer)
export const getContractIssues = asyncHandler(async (req, res) => {
    const { contractId } = req.params;
    const contract = await verifyContractAccess(contractId, req.user.id);

    if (!contract.board) {
        throw new AppError('Board not found for this contract', 404);
    }

    const issues = await prisma.issue.findMany({
        where: { boardId: contract.board.id },
        include: {
            createdBy: { select: { id: true, fullName: true } },
            assignee: { select: { id: true, fullName: true } },
            attachments: { select: ATTACHMENT_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
            comments: {
                include: {
                    author: { select: { id: true, fullName: true } },
                    attachments: { select: ATTACHMENT_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
    });

    res.status(200).json({ success: true, count: issues.length, issues });
});

// @route   POST /api/contracts/:contractId/issues
// @access  Private (Contract Client & Freelancer)
export const createIssue = asyncHandler(async (req, res) => {
    const { contractId } = req.params;
    const { title, description, priority, assigneeId } = req.body;

    const contract = await verifyContractAccess(contractId, req.user.id);

    if (!contract.board) {
        throw new AppError('Board not found for this contract', 404);
    }

    // Yoxlama 1: Müqavilə ACTIVE-dirmi?
    assertContractActive(contract);

    // Yoxlama 2: Assignee müqavilənin tərəfidirmi?
    assertAssigneeInContract(contract, assigneeId);

    const lastIssue = await prisma.issue.findFirst({
        where: { boardId: contract.board.id, status: 'TODO' },
        orderBy: { position: 'desc' },
    });

    const position = lastIssue ? lastIssue.position + 1000 : 1000;

    const issue = await prisma.issue.create({
        data: {
            boardId: contract.board.id,
            title,
            description,
            priority: priority || 'MEDIUM',
            status: 'TODO',
            position,
            createdById: req.user.id,
            assigneeId: assigneeId || null,
        },
        include: {
            createdBy: { select: { id: true, fullName: true } },
            assignee: { select: { id: true, fullName: true } },
        },
    });

    emitToContract(contractId, 'issue:created', issue);

    await notifyAssigned(contract, issue, issue.assigneeId, req.user);

    res.status(201).json({ success: true, issue });
});

// @route   PATCH /api/issues/:id
// @access  Private (Contract Client & Freelancer)
export const updateIssue = asyncHandler(async (req, res) => {
    const issue = await prisma.issue.findUnique({
        where: { id: req.params.id },
        include: { board: { include: { contract: true } } },
    });

    if (!issue) {
        throw new AppError('Issue not found', 404);
    }

    const contract = await verifyContractAccess(issue.board.contract.id, req.user.id);

    // Yoxlama 1: Müqavilə ACTIVE-dirmi?
    assertContractActive(contract);

    // Yoxlama 2: Əgər assigneeId göndərilibsə
    if (req.body.assigneeId) {
        assertAssigneeInContract(contract, req.body.assigneeId);
    }

    const updatedIssue = await prisma.issue.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
            createdBy: { select: { id: true, fullName: true } },
            assignee: { select: { id: true, fullName: true } },
        },
    });

    emitToContract(contract.id, 'issue:updated', updatedIssue);

    // Yalnız təyinat dəyişəndə: eyni kişiyə təkrar bildiriş gəlmir
    if (req.body.assigneeId && req.body.assigneeId !== issue.assigneeId) {
        await notifyAssigned(contract, updatedIssue, req.body.assigneeId, req.user);
    }

    res.status(200).json({ success: true, issue: updatedIssue });
});

// @route   PATCH /api/issues/:id/move
// @access  Private (Contract Client & Freelancer)
export const moveIssue = asyncHandler(async (req, res) => {
    const { status, position } = req.body;

    const issue = await prisma.issue.findUnique({
        where: { id: req.params.id },
        include: { board: { include: { contract: true } } },
    });

    if (!issue) {
        throw new AppError('Issue not found', 404);
    }

    const contract = await verifyContractAccess(issue.board.contract.id, req.user.id);

    // Yoxlama: Müqavilə ACTIVE-dirmi?
    assertContractActive(contract);

    // Pul qapısı: escrow-da pul olmadan iş başlaya bilməz (TODO-ya qaytarmaq hər zaman mümkündür)
    if (status !== 'TODO') {
        await assertWorkFunded(contract.id, issue.milestoneId);
    }

    let movedIssue = await prisma.issue.update({
        where: { id: req.params.id },
        data: {
            status,
            position,
        },
        // updateIssue ilə eyni format (socket hadisələri və frontend cache üçün)
        include: {
            createdBy: { select: { id: true, fullName: true } },
            assignee: { select: { id: true, fullName: true } },
        },
    });

    // Float mövqe: iki kartın arasına dayanıq bölünmə dəqiqliyi itirir. Qonşular çox yaxınlaşıbsa
    // sütun 1000, 2000, 3000... şəklində yenidən nömrələnir (sıra dəyişmir, yalnız ədədlər).
    const column = await prisma.issue.findMany({
        where: { boardId: movedIssue.boardId, status: movedIssue.status },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
    });

    const tooClose = column.some((c, i) => i > 0 && c.position - column[i - 1].position < MIN_POSITION_GAP);

    if (tooClose) {
        await prisma.$transaction(
            column.map((c, i) =>
                prisma.issue.update({ where: { id: c.id }, data: { position: (i + 1) * 1000 } })
            )
        );

        movedIssue = await prisma.issue.findUnique({
            where: { id: movedIssue.id },
            include: {
                createdBy: { select: { id: true, fullName: true } },
                assignee: { select: { id: true, fullName: true } },
            },
        });
    }

    emitToContract(contract.id, 'issue:moved', movedIssue);

    if (tooClose) {
        // Digər kartların mövqeyi dəyişib: bütün müştərilər siyahını yenidən çəkir
        emitToContract(contract.id, 'board:reordered', { status: movedIssue.status });
    }

    res.status(200).json({ success: true, issue: movedIssue, rebalanced: tooClose });
});

// @route   POST /api/issues/:id/comments
// @access  Private (Contract Client & Freelancer)
export const addIssueComment = asyncHandler(async (req, res) => {
    const { body } = req.body;

    const issue = await prisma.issue.findUnique({
        where: { id: req.params.id },
        include: { board: { include: { contract: true } } },
    });

    if (!issue) {
        throw new AppError('Issue not found', 404);
    }

    const contract = await verifyContractAccess(issue.board.contract.id, req.user.id);

    assertContractActive(contract);

    const comment = await prisma.issueComment.create({
        data: {
            issueId: issue.id,
            authorId: req.user.id,
            body,
        },
        include: {
            author: { select: { id: true, fullName: true } },
        },
    });

    emitToContract(contract.id, 'comment:created', comment);

    await notify(otherParty(contract, req.user.id), {
        type: N.COMMENT_ADDED,
        title: 'New comment on a task',
        body: `${req.user.fullName} commented on "${issue.title}": ${excerpt(body)}`,
        link: `/contracts/${contract.id}`,
        data: { contractId: contract.id, issueId: issue.id, commentId: comment.id },
    });

    res.status(201).json({ success: true, comment });
});

// @route   DELETE /api/issues/:id
// @access  Private (Contract Client & Freelancer)
export const deleteIssue = asyncHandler(async (req, res) => {
    const issue = await prisma.issue.findUnique({
        where: { id: req.params.id },
        include: { board: { include: { contract: true } } },
    });

    if (!issue) {
        throw new AppError('Issue not found', 404);
    }

    const contract = await verifyContractAccess(issue.board.contract.id, req.user.id);

    assertContractActive(contract);

    // Şərhlər schema-da onDelete: Cascade ilə birlikdə silinir
    await prisma.issue.delete({ where: { id: issue.id } });

    emitToContract(contract.id, 'issue:deleted', { id: issue.id });

    res.status(200).json({ success: true, message: 'Issue deleted successfully' });
});