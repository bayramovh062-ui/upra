import { z } from 'zod';

export const createContractSchema = z.object({
    proposalId: z
        .string({ error: 'Proposal ID is required' })
        .uuid('Invalid Proposal ID format')
});