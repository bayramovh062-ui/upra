import { z } from 'zod';

// Bütün sxemlər `t` (tərcümə funksiyası) qəbul edən fabriklərdir ki, xəta mətnləri
// aktiv dilə uyğun olsun. Formalar `useTranslation()` ilə `t`-ni ötürür.

// Yeni parol qaydası (backend-dəki passwordRule ilə eyni): ≥8 simvol, hərf + rəqəm + simvol
export const createStrongPassword = (t) =>
    z
        .string()
        .min(8, t('validation.passwordStrong'))
        .max(128, t('validation.passwordStrong'))
        .refine((v) => /\p{L}/u.test(v), t('validation.passwordStrong'))
        .refine((v) => /\d/.test(v), t('validation.passwordStrong'))
        .refine((v) => /[^\p{L}\d\s]/u.test(v), t('validation.passwordStrong'));

// Login üçün daxil edilən məlumatların yoxlanması sxemi
export const createLoginSchema = (t) =>
    z.object({
        email: z
            .string()
            .trim()
            .min(1, t('validation.emailRequired'))
            .email(t('validation.invalidEmail')),
        password: z.string().min(1, t('validation.passwordRequired')),
    });

// Phase B: parol bərpası
export const createForgotPasswordSchema = (t) =>
    z.object({
        email: z.string().trim().min(1, t('validation.emailRequired')).email(t('validation.invalidEmail')),
    });

export const createResetPasswordSchema = (t) =>
    z
        .object({
            newPassword: createStrongPassword(t),
            confirmPassword: z.string().min(1, t('validation.confirmPasswordRequired')),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
            message: t('validation.passwordsMismatch'),
            path: ['confirmPassword'],
        });

// Qeydiyyat üçün daxil edilən məlumatların yoxlanması sxemi
// Sahə adları və rol dəyərləri backend-dəki registerSchema ilə eyni olmalıdır
export const createRegisterSchema = (t) =>
    z
        .object({
            fullName: z.string().trim().min(2, t('validation.fullNameMin2')),
            email: z
                .string()
                .trim()
                .min(1, t('validation.emailRequired'))
                .email(t('validation.invalidEmail')),
            password: createStrongPassword(t),
            confirmPassword: z.string().min(1, t('validation.confirmPasswordRequired')),
            role: z.enum(['CLIENT', 'FREELANCER'], {
                error: t('validation.accountTypeRequired'),
            }),
        })
        // Şifrələrin bir-birinə uyğunluğunu yoxlayırıq
        .refine((data) => data.password === data.confirmPassword, {
            message: t('validation.passwordsMismatch'),
            path: ['confirmPassword'],
        });
