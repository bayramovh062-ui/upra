import { z } from 'zod';

export const createProposalSchema = z.object({
    jobPostId: z
        .string({ error: 'Job Post ID is required' })
        .uuid('Invalid Job Post ID format'),
    coverLetter: z
        .string({ error: 'Cover letter is required' })
        .trim()
        .min(20, 'Cover letter must be at least 20 characters long'),
    bidAmount: z
        .number({ error: 'Bid amount must be a number' })
        .positive('Bid amount must be a positive number'),
});

export const updateProposalSchema = z
    .object({
        coverLetter: z
            .string()
            .trim()
            .min(20, 'Cover letter must be at least 20 characters long')
            .optional(),
        bidAmount: z
            .number()
            .positive('Bid amount must be a positive number')
            .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Please provide at least one field to update',
    });