import { z } from 'zod';

export const registerSchema = z.object({
    email: z
        .string({ error: 'Email is required' })
        .trim()
        .toLowerCase()
        .email('Invalid email address format'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters long'),
    role: z.enum(['CLIENT', 'FREELANCER'], { error: 'Role must be either CLIENT or FREELANCER' }).optional(),
});

export const loginSchema = z.object({
    email: z
        .string({ error: 'Email is required' })
        .trim()
        .toLowerCase()
        .email('Invalid email address format'),
    password: z.string().min(1, 'Password is required'),
});

export const updateMeSchema = z
    .object({
        fullName: z.string().trim().min(2, 'Full name must be at least 2 characters long').optional(),
        headline: z.string().trim().max(120, 'Headline must be at most 120 characters long').nullable().optional(),
        bio: z.string().trim().max(1000, 'Bio must be at most 1000 characters long').nullable().optional(),
        hourlyRate: z
            .number({ error: 'Hourly rate must be a number' })
            .positive('Hourly rate must be a positive number')
            .max(10000, 'Hourly rate is too high')
            .nullable()
            .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Please provide at least one field to update',
    });

export const deleteAccountSchema = z.object({
    password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

export const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});