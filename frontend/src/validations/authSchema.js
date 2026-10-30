import { z } from 'zod';

// Login üçün daxil edilən məlumatların yoxlanması sxemi
export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, 'Email is required')
        .email('Invalid email address'),
    password: z
        .string()
        .min(1, 'Password is required'),
});

// Qeydiyyat üçün daxil edilən məlumatların yoxlanması sxemi
// Sahə adları və rol dəyərləri backend-dəki registerSchema ilə eyni olmalıdır
export const registerSchema = z
    .object({
        fullName: z
            .string()
            .trim()
            .min(2, 'Full name must be at least 2 characters'),
        email: z
            .string()
            .trim()
            .min(1, 'Email is required')
            .email('Invalid email address'),
        password: z
            .string()
            .min(6, 'Password must be at least 6 characters'),
        confirmPassword: z
            .string()
            .min(1, 'Confirm password is required'),
        role: z.enum(['CLIENT', 'FREELANCER'], {
            error: 'Please select an account type',
        }),
    })
    // Şifrələrin bir-birinə uyğunluğunu yoxlayırıq
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });
