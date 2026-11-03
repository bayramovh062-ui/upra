import { z } from 'zod';

export const createContractSchema = z.object({
    proposalId: z
        .string({ error: 'Proposal ID is required' })
        .uuid('Invalid Proposal ID format')
});

// İş başlayandan sonra ləğv təklifi: səbəb ixtiyaridir. Boş sətir "səbəb yoxdur" sayılır.
export const cancelRequestSchema = z.object({
    reason: z.string().trim().max(500, 'Reason must be at most 500 characters long').optional(),
});
