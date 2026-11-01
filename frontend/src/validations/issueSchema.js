import { z } from 'zod';

export const issueSchema = z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title is too long'),
    description: z.string().trim().max(2000, 'Description is too long').optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    assigneeId: z.string().optional(), // '' = təyin olunmayıb
});

export const commentSchema = z.object({
    body: z.string().trim().min(1, 'Write something first').max(1000, 'Comment is too long'),
});
