import { z } from 'zod';

export const createIssueSchema = z.object({
    title: z
        .string({ error: 'Title is required' })
        .min(3, 'Title must be at least 3 characters long')
        .trim(),
    description: z.string().trim().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    assigneeId: z.string().uuid('Invalid Assignee ID format').optional(),
});

export const updateIssueSchema = z
    .object({
        title: z.string().min(3).trim().optional(),
        description: z.string().trim().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
        assigneeId: z.string().uuid('Invalid Assignee ID format').nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Please provide at least one field to update',
    });

export const moveIssueSchema = z.object({
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
    position: z
        .number({ error: 'Position must be a number' })
        .nonnegative('Position cannot be negative'),
});

export const createCommentSchema = z.object({
    body: z
        .string({ error: 'Comment body is required' })
        .min(1, 'Comment body cannot be empty')
        .trim(),
});