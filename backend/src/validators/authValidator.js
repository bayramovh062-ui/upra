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

export const updateMeSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters long'),
});

export const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});