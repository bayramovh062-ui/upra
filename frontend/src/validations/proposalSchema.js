import { z } from 'zod';

// Backend-dəki createProposalSchema ilə uyğundur (coverLetter ≥ 20, bidAmount > 0).
// jobPostId formada yoxdur, səhifə onu özü əlavə edir.
export const proposalSchema = z.object({
    bidAmount: z
        .number({ error: 'Bid amount must be a number' })
        .positive('Bid amount must be greater than 0')
        .max(10_000_000, 'Bid amount is too large'),
    coverLetter: z
        .string({ error: 'Cover letter is required' })
        .trim()
        .min(20, 'Cover letter must be at least 20 characters')
        .max(2000, 'Cover letter must be at most 2,000 characters'),
});
