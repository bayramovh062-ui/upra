import prisma from '../config/db.js';
import { AppError } from './AppError.js';

export const verifyContractAccess = async (contractId, userId) => {
    const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
            board: true,
            jobPost: true,
            proposal: true,
            client: { select: { id: true, fullName: true, email: true } },
            freelancer: { select: { id: true, fullName: true, email: true } },
        },
    });

    if (!contract) {
        throw new AppError('Contract not found', 404);
    }

    const isClient = contract.clientId === userId;
    const isFreelancer = contract.freelancerId === userId;

    if (!isClient && !isFreelancer) {
        throw new AppError('You do not have permission to access this contract', 403);
    }

    return contract;
};