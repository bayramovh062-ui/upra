import { z } from 'zod';
import prisma from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { verifyContractAccess } from '../../utils/contractAccess.js';
import { redactText, truncate } from './redact.js';

// =====================================================================================
// AI alətləri: YALNIZ oxuma, hamısı çağıran istifadəçiyə bağlı.
// Nəticələr ağ siyahı ilə qurulur: e-poçt, token, telefon, qarşı tərəfin adı və s. heç vaxt qaytarılmır.
// =====================================================================================

const NO_ARGS = { type: 'object', properties: {} };

export const TOOL_DEFINITIONS = [
    {
        name: 'getMyContracts',
        description:
            "Lists the current user's contracts (id, status, job title, the user's role, number of milestones). Use it to answer which contracts the user has.",
        parameters: NO_ARGS,
    },
    {
        name: 'getContract',
        description:
            'Returns one contract of the current user: status, milestones (title, amount in cents, status, due date, revisions) and any pending cancellation request. Use it to explain why a milestone is blocked or what happens next.',
        parameters: {
            type: 'object',
            properties: { contractId: { type: 'string', description: 'The contract id (UUID).' } },
            required: ['contractId'],
        },
    },
    {
        name: 'getMyProposals',
        description: "Lists the current freelancer's proposals (job title, bid amount, status).",
        parameters: NO_ARGS,
    },
    {
        name: 'getMyWallet',
        description: "Returns the current user's wallet: available and escrow-locked balance in cents.",
        parameters: NO_ARGS,
    },
];

const contractIdSchema = z.object({ contractId: z.string().uuid() });

const roleIn = (contract, userId) => (contract.clientId === userId ? 'client' : 'freelancer');

const getMyContracts = async (user) => {
    const contracts = await prisma.contract.findMany({
        where: { OR: [{ clientId: user.id }, { freelancerId: user.id }] },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
            id: true,
            status: true,
            clientId: true,
            freelancerId: true,
            jobPost: { select: { title: true } },
            _count: { select: { milestones: true } },
        },
    });

    return {
        contracts: contracts.map((c) => ({
            id: c.id,
            status: c.status,
            jobTitle: truncate(redactText(c.jobPost?.title ?? ''), 120),
            myRole: roleIn(c, user.id),
            milestoneCount: c._count.milestones,
        })),
    };
};

const getContract = async (args, user) => {
    const parsed = contractIdSchema.safeParse(args);
    if (!parsed.success) return { error: 'invalid_args' };

    let contract;
    try {
        contract = await verifyContractAccess(parsed.data.contractId, user.id);
    } catch (err) {
        // Mövcud olmayan və başqasının müqaviləsi eyni cavabı verir (varlığı sızdırmır)
        if (err instanceof AppError && [403, 404].includes(err.statusCode)) return { error: 'not_found' };
        throw err;
    }

    const milestones = await prisma.milestone.findMany({
        where: { contractId: contract.id },
        orderBy: { sequence: 'asc' },
        select: {
            title: true,
            amountCents: true,
            status: true,
            dueDate: true,
            revisionCount: true,
            maxRevisions: true,
        },
    });

    return {
        id: contract.id,
        status: contract.status,
        jobTitle: truncate(redactText(contract.jobPost?.title ?? ''), 120),
        myRole: roleIn(contract, user.id),
        milestones: milestones.map((m) => ({
            title: truncate(redactText(m.title), 120),
            amountCents: m.amountCents,
            status: m.status,
            dueDate: m.dueDate ? m.dueDate.toISOString() : null,
            revisionCount: m.revisionCount,
            maxRevisions: m.maxRevisions,
        })),
        cancelRequest: contract.cancelRequestedById
            ? {
                  requestedBy: contract.cancelRequestedById === contract.clientId ? 'client' : 'freelancer',
                  reason: contract.cancelReason ? truncate(redactText(contract.cancelReason), 300) : null,
              }
            : null,
    };
};

const getMyProposals = async (user) => {
    const proposals = await prisma.proposal.findMany({
        where: { freelancerId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { bidAmount: true, status: true, jobPost: { select: { title: true } } },
    });

    return {
        proposals: proposals.map((p) => ({
            jobTitle: truncate(redactText(p.jobPost?.title ?? ''), 120),
            bidAmount: Number(p.bidAmount),
            status: p.status,
        })),
    };
};

const getMyWallet = async (user) => {
    const wallet = await prisma.wallet.findUnique({
        where: { userId: user.id },
        select: { availableCents: true, lockedCents: true, currency: true },
    });
    return {
        availableCents: wallet?.availableCents ?? 0,
        lockedCents: wallet?.lockedCents ?? 0,
        currency: wallet?.currency ?? 'USD',
    };
};

const KNOWN = new Set(TOOL_DEFINITIONS.map((d) => d.name));

// Modelin çağırdığı alət. Naməlum ad və səhv arqumentlər xəta DEYİL: modelə { error } qaytarılır, dövr davam edir.
export const runTool = async (name, args, user) => {
    if (!KNOWN.has(name)) return { error: 'unknown_tool' };

    try {
        switch (name) {
            case 'getMyContracts':
                return await getMyContracts(user);
            case 'getContract':
                return await getContract(args ?? {}, user);
            case 'getMyProposals':
                return await getMyProposals(user);
            case 'getMyWallet':
                return await getMyWallet(user);
            default:
                return { error: 'unknown_tool' };
        }
    } catch (err) {
        logger.error(`AI tool ${name} failed: ${err.message}`, { stack: err.stack });
        return { error: 'tool_failed' };
    }
};
