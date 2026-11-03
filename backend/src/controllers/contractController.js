import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { verifyContractAccess } from '../utils/contractAccess.js';
import { emitToContract } from '../socket.js';

const OPEN_STATUSES = ['ACTIVE', 'DELIVERED'];

// Gözləyən ləğv təklifini təmizləyən sahələr (təklif rədd/geri çəkiləndə və müqavilə bitəndə)
const CLEAR_CANCEL_REQUEST = { cancelRequestedById: null, cancelRequestedAt: null, cancelReason: null };

// İş "başlayıb": təhvil verilib və ya lövhədə TODO-dan kənarda (IN_PROGRESS/DONE) tapşırıq var.
// Başlamamış müqaviləni hər iki tərəf tək ləğv edə bilər, başlamışı yalnız qarşılıqlı razılıqla.
const hasWorkStarted = async (contract) => {
    if (contract.status === 'DELIVERED') return true;
    const moved = await prisma.issue.count({
        where: { board: { contractId: contract.id }, status: { not: 'TODO' } },
    });
    return moved > 0;
};

// Müqaviləni tapır və yalnız tərəflərin girişinə icazə verir
const loadPartyContract = async (contractId, userId) => {
    const contract = await prisma.contract.findUnique({ where: { id: contractId } });

    if (!contract) {
        throw new AppError('Contract not found', 404);
    }
    if (![contract.clientId, contract.freelancerId].includes(userId)) {
        throw new AppError('You are not a party to this contract', 403);
    }
    return contract;
};

const assertOpen = (contract, message = 'Only ACTIVE or DELIVERED contracts can be cancelled') => {
    if (!OPEN_STATUSES.includes(contract.status)) {
        throw new AppError(message, 400);
    }
};

const emitUpdated = (contract) =>
    emitToContract(contract.id, 'contract:updated', {
        id: contract.id,
        status: contract.status,
        cancelRequestedById: contract.cancelRequestedById ?? null,
    });

// Ləğvi tətbiq edir: müqavilə və iş CANCELLED olur. Atomikdir: yalnız hələ açıq olan müqavilə ləğv olunur
const applyCancellation = async (contract, extraData = {}) =>
    prisma.$transaction(async (tx) => {
        const result = await tx.contract.updateMany({
            where: { id: contract.id, status: { in: OPEN_STATUSES } },
            data: { status: 'CANCELLED', ...extraData },
        });

        if (result.count === 0) {
            throw new AppError('This contract is no longer open', 400);
        }

        await tx.jobPost.update({
            where: { id: contract.jobPostId },
            data: { status: 'CANCELLED' },
        });

        return tx.contract.findUnique({ where: { id: contract.id } });
    });

// @route   POST /api/contracts
// @access  Private (CLIENT)
export const createContract = asyncHandler(async (req, res) => {
    const { proposalId } = req.body;

    const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
            jobPost: true,
        },
    });

    if (!proposal) {
        throw new AppError('Proposal not found', 404);
    }

    if (proposal.jobPost.clientId !== req.user.id) {
        throw new AppError('You are not authorized to create a contract for this job', 403);
    }

    if (proposal.status !== 'PENDING') {
        throw new AppError('Contract can only be created from a PENDING proposal', 400);
    }

    const contract = await prisma.$transaction(async (tx) => {
        // ATOMİK YOXLAMA VƏ KİLİDLƏMƏ (Race condition qarşısını alır)
        const lockedJob = await tx.jobPost.updateMany({
            where: {
                id: proposal.jobPostId,
                status: 'OPEN',
            },
            data: {
                status: 'IN_PROGRESS',
            },
        });

        if (lockedJob.count === 0) {
            throw new AppError('Job is no longer open for contract creation', 400);
        }

        const newContract = await tx.contract.create({
            data: {
                jobPostId: proposal.jobPostId,
                proposalId: proposal.id,
                clientId: req.user.id,
                freelancerId: proposal.freelancerId,
                status: 'ACTIVE',
                board: {
                    create: {},
                },
            },
        });

        await tx.proposal.update({
            where: { id: proposal.id },
            data: { status: 'ACCEPTED' },
        });

        await tx.proposal.updateMany({
            where: {
                jobPostId: proposal.jobPostId,
                id: { not: proposal.id },
                status: 'PENDING',
            },
            data: { status: 'REJECTED' },
        });

        return newContract;
    });

    res.status(201).json({ success: true, contract });
});

// @route   GET /api/contracts/my
// @access  Private (CLIENT & FREELANCER)
export const getMyContracts = asyncHandler(async (req, res) => {
    const whereClause =
        req.user.role === 'CLIENT'
            ? { clientId: req.user.id }
            : { freelancerId: req.user.id };

    const contracts = await prisma.contract.findMany({
        where: whereClause,
        include: {
            jobPost: {
                select: { id: true, title: true, status: true },
            },
            proposal: {
                select: { id: true, bidAmount: true, coverLetter: true },
            },
            client: {
                select: { id: true, fullName: true },
            },
            freelancer: {
                select: { id: true, fullName: true },
            },
            board: {
                select: { id: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ success: true, count: contracts.length, contracts });
});

// @route   GET /api/contracts/:id
// @access  Private (Müqavilənin iştirakçısı olan CLIENT və ya FREELANCER)
// workStarted: true olanda ləğv üçün qarşı tərəfin razılığı lazımdır (frontend düymələri buna görə seçir)
export const getContractById = asyncHandler(async (req, res) => {
    const contract = await verifyContractAccess(req.params.id, req.user.id);
    const workStarted = OPEN_STATUSES.includes(contract.status) ? await hasWorkStarted(contract) : false;

    res.status(200).json({ success: true, contract: { ...contract, workStarted } });
});

// @route   PATCH /api/contracts/:id/complete
// @access  Private (CLIENT)
export const completeContract = asyncHandler(async (req, res) => {
    const contract = await prisma.contract.findUnique({
        where: { id: req.params.id },
    });

    if (!contract) {
        throw new AppError('Contract not found', 404);
    }

    if (contract.clientId !== req.user.id) {
        throw new AppError('Only the client can complete this contract', 403);
    }

    if (!OPEN_STATUSES.includes(contract.status)) {
        throw new AppError('Only ACTIVE or DELIVERED contracts can be completed', 400);
    }

    const updatedContract = await prisma.$transaction(async (tx) => {
        // Müqavilə uğurla bitirsə, gözləyən ləğv təklifi mənasını itirir
        const updated = await tx.contract.update({
            where: { id: req.params.id },
            data: { status: 'COMPLETED', ...CLEAR_CANCEL_REQUEST },
        });

        await tx.jobPost.update({
            where: { id: contract.jobPostId },
            data: { status: 'COMPLETED' },
        });

        return updated;
    });

    emitUpdated(updatedContract);

    res.status(200).json({ success: true, contract: updatedContract });
});

// @route   PATCH /api/contracts/:id/cancel
// @access  Private (müqavilənin hər iki tərəfi)
// Birbaşa ləğv yalnız iş hələ başlamayıbsa mümkündür. Başlayıbsa: cancel-request axını.
export const cancelContract = asyncHandler(async (req, res) => {
    const contract = await loadPartyContract(req.params.id, req.user.id);
    assertOpen(contract);

    if (await hasWorkStarted(contract)) {
        throw new AppError(
            'Work has already started. Send a cancellation request; the other party has to agree.',
            400
        );
    }

    const cancelled = await applyCancellation(contract, CLEAR_CANCEL_REQUEST);

    emitUpdated(cancelled);

    res.status(200).json({ success: true, contract: cancelled });
});

// @route   PATCH /api/contracts/:id/cancel-request
// @access  Private (müqavilənin hər iki tərəfi). Body: { reason? }
export const requestCancellation = asyncHandler(async (req, res) => {
    const contract = await loadPartyContract(req.params.id, req.user.id);
    assertOpen(contract, 'Only ACTIVE or DELIVERED contracts can be cancelled');

    if (!(await hasWorkStarted(contract))) {
        throw new AppError('Work has not started yet. You can cancel the contract directly.', 400);
    }

    // Atomik: yalnız gözləyən təklif yoxdursa yazılır, iki tərəf eyni anda göndərsə biri qalib gəlir
    const result = await prisma.contract.updateMany({
        where: { id: contract.id, status: { in: OPEN_STATUSES }, cancelRequestedById: null },
        data: {
            cancelRequestedById: req.user.id,
            cancelRequestedAt: new Date(),
            cancelReason: req.body?.reason || null,
        },
    });

    if (result.count === 0) {
        throw new AppError('A cancellation request is already pending', 400);
    }

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } });

    emitUpdated(updated);

    res.status(200).json({ success: true, contract: updated });
});

// @route   PATCH /api/contracts/:id/cancel-request/accept
// @access  Private (təklifi göndərən YOX, digər tərəf)
export const acceptCancellation = asyncHandler(async (req, res) => {
    const contract = await loadPartyContract(req.params.id, req.user.id);

    if (!contract.cancelRequestedById) {
        throw new AppError('There is no pending cancellation request', 400);
    }
    if (contract.cancelRequestedById === req.user.id) {
        throw new AppError('You cannot accept your own cancellation request', 403);
    }
    assertOpen(contract);

    const cancelled = await applyCancellation(contract);

    emitUpdated(cancelled);

    res.status(200).json({ success: true, contract: cancelled });
});

// Rədd etmə (digər tərəf) və geri çəkmə (göndərən) eyni təmizləməni edir, yalnız kimin edə biləcəyi fərqlidir
const resolveRequest = (who) =>
    asyncHandler(async (req, res) => {
        const contract = await loadPartyContract(req.params.id, req.user.id);

        if (!contract.cancelRequestedById) {
            throw new AppError('There is no pending cancellation request', 400);
        }

        const isRequester = contract.cancelRequestedById === req.user.id;
        if (who === 'requester' && !isRequester) {
            throw new AppError('Only the party who sent the request can withdraw it', 403);
        }
        if (who === 'other' && isRequester) {
            throw new AppError('You cannot decline your own cancellation request. Withdraw it instead.', 403);
        }
        assertOpen(contract);

        const result = await prisma.contract.updateMany({
            where: {
                id: contract.id,
                status: { in: OPEN_STATUSES },
                cancelRequestedById: contract.cancelRequestedById,
            },
            data: CLEAR_CANCEL_REQUEST,
        });

        if (result.count === 0) {
            throw new AppError('The cancellation request has already been resolved', 400);
        }

        const updated = await prisma.contract.findUnique({ where: { id: contract.id } });

        emitUpdated(updated);

        res.status(200).json({ success: true, contract: updated });
    });

// @route   PATCH /api/contracts/:id/cancel-request/decline
export const declineCancellation = resolveRequest('other');

// @route   PATCH /api/contracts/:id/cancel-request/withdraw
export const withdrawCancellation = resolveRequest('requester');

// @route   PATCH /api/contracts/:id/deliver
// @access  Private (FREELANCER of the contract)
export const deliverContract = asyncHandler(async (req, res) => {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } });

    if (!contract) {
        throw new AppError('Contract not found', 404);
    }

    if (contract.freelancerId !== req.user.id) {
        throw new AppError('Only the freelancer of this contract can mark it as delivered', 403);
    }

    // Atomik keçid: yalnız ACTIVE olan DELIVERED olur
    const result = await prisma.contract.updateMany({
        where: { id: contract.id, status: 'ACTIVE' },
        data: { status: 'DELIVERED' },
    });

    if (result.count === 0) {
        throw new AppError('Only ACTIVE contracts can be delivered', 400);
    }

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } });

    emitUpdated(updated);

    res.status(200).json({ success: true, contract: updated });
});

// @route   PATCH /api/contracts/:id/reopen
// @access  Private (CLIENT of the contract): "dəyişiklik istəyirəm"
export const reopenContract = asyncHandler(async (req, res) => {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } });

    if (!contract) {
        throw new AppError('Contract not found', 404);
    }

    if (contract.clientId !== req.user.id) {
        throw new AppError('Only the client can request changes on this contract', 403);
    }

    const result = await prisma.contract.updateMany({
        where: { id: contract.id, status: 'DELIVERED' },
        data: { status: 'ACTIVE' },
    });

    if (result.count === 0) {
        throw new AppError('Only DELIVERED contracts can be reopened', 400);
    }

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } });

    emitUpdated(updated);

    res.status(200).json({ success: true, contract: updated });
});
