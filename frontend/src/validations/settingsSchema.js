import { z } from 'zod';

export const profileSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long'),
});

export const passwordSchema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(6, 'New password must be at least 6 characters'),
        confirmPassword: z.string().min(1, 'Please confirm the new password'),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    })
    .refine((v) => v.newPassword !== v.currentPassword, {
        message: 'New password must be different',
        path: ['newPassword'],
    });
