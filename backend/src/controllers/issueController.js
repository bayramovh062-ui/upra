import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { verifyContractAccess } from '../utils/contractAccess.js';

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
            createdBy: { select: { id: true, fullName: true, email: true } },
            assignee: { select: { id: true, fullName: true, email: true } },
            comments: {
                include: {
                    author: { select: { id: true, fullName: true } },
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

    await verifyContractAccess(issue.board.contract.id, req.user.id);

    const updatedIssue = await prisma.issue.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
            createdBy: { select: { id: true, fullName: true } },
            assignee: { select: { id: true, fullName: true } },
        },
    });

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

    await verifyContractAccess(issue.board.contract.id, req.user.id);

    const movedIssue = await prisma.issue.update({
        where: { id: req.params.id },
        data: {
            status,
            position,
        },
    });

    res.status(200).json({ success: true, issue: movedIssue });
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

    await verifyContractAccess(issue.board.contract.id, req.user.id);

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

    res.status(201).json({ success: true, comment });
});