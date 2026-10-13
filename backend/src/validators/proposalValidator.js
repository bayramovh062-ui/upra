import { z } from 'zod';

if (Object.keys(req.body).length === 0) {
    throw new AppError('Please provide at least one field to update', 400);
}

export const createProposalSchema = z.object({
    jobPostId: z
        .string({ error: 'Job Post ID is required' })
        .uuid('Invalid Job Post ID format'),
    coverLetter: z
        .string({ error: 'Cover letter is required' })
        .min(20, 'Cover letter must be at least 20 characters long')
        .trim(),
    bidAmount: z
        .number({ error: 'Bid amount must be a number' })
        .positive('Bid amount must be a positive number'),
});

export const updateProposalSchema = z.object({
    coverLetter: z
        .string()
        .min(20, 'Cover letter must be at least 20 characters long')
        .trim()
        .optional(),
    bidAmount: z
        .number()
        .positive('Bid amount must be a positive number')
        .optional(),
});