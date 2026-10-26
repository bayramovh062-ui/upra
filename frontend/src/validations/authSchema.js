import { z } from 'zod';

// Login üçün daxil edilən məlumatların yoxlanması sxemi
export const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email address'),
    password: z
        .string()
        .min(6, 'Password must be at least 6 characters'),
});

// Qeydiyyat üçün daxil edilən məlumatların yoxlanması sxemi
export const registerSchema = z
    .object({
        name: z
            .string()
            .min(2, 'Full name must be at least 2 characters'),
        email: z
            .string()
            .min(1, 'Email is required')
            .email('Invalid email address'),
        password: z
            .string()
            .min(6, 'Password must be at least 6 characters'),
        confirmPassword: z
            .string()
            .min(1, 'Confirm password is required'),
        // Rol seimini 'freelancer' va 'client' olaraq dayilayirik
        role: z.enum(['freelancer', 'client'], {
            errorMap: () => ({ message: 'Please select an account type' }),
        }),
    })
    // Şifrələrin bir-birinə uyğunluğunu yoxlayırıq
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });