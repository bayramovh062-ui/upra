import { z } from 'zod';

export const createJobSchema = z.object({
    title: z.string({ error: 'Title is required' }).min(5, 'Title must be at least 5 characters long').trim(),
    description: z.string({ error: 'Description is required' }).min(20, 'Description must be at least 20 characters long').trim(),
    budget: z.number({ error: 'Budget must be a number' }).positive('Budget must be a positive number'),
});

export const updateJobSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters long').trim().optional(),
    description: z.string().min(20, 'Description must be at least 20 characters long').trim().optional(),
    budget: z.number().positive('Budget must be a positive number').optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});