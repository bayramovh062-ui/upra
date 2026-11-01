import { z } from 'zod';

export const createJobSchema = z.object({
    // trim() min()-dən ƏVVƏL: yoxsa boşluqlardan ibarət dəyər yoxlamadan keçərdi
    title: z.string({ error: 'Title is required' }).trim().min(5, 'Title must be at least 5 characters long'),
    description: z.string({ error: 'Description is required' }).trim().min(20, 'Description must be at least 20 characters long'),
    budget: z.number({ error: 'Budget must be a number' }).positive('Budget must be a positive number'),
});

export const updateJobSchema = z
    .object({
        title: z.string().trim().min(5, 'Title must be at least 5 characters long').optional(),
        description: z.string().trim().min(20, 'Description must be at least 20 characters long').optional(),
        budget: z.number().positive('Budget must be a positive number').optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Please provide at least one field to update',
    });