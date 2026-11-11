import { z } from 'zod';
import { isValidTimezone } from '../lib/labels';

// Qaydalar backend-dəki updateMeSchema ilə eynidir (backend/src/validators/authValidator.js).
// Hər fabrik `t` qəbul edir ki, xəta mətnləri aktiv dilə uyğun olsun.
const isHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

export const createProfileSchema = (t) =>
    z.object({
        fullName: z
            .string()
            .trim()
            .min(2, t('validation.fullNameMin2'))
            .max(100, t('validation.fullNameMax')),
        avatarUrl: z
            .string()
            .trim()
            .max(500, t('validation.settings.avatarUrlMax'))
            .refine((v) => v === '' || isHttpUrl(v), t('validation.settings.avatarUrlInvalid')),
        location: z.string().trim().max(80, t('validation.settings.locationMax')),
        timezone: z
            .string()
            .trim()
            .refine((v) => v === '' || isValidTimezone(v), t('validation.settings.timezoneInvalid')),
    });

// hourlyRate formada mətn kimi saxlanılır, göndəriləndə rəqəmə çevrilir (boş = null)
export const createProfessionalSchema = (t) =>
    z.object({
        headline: z.string().trim().max(120, t('validation.settings.headlineMax')),
        bio: z.string().trim().max(1000, t('validation.settings.bioMax')),
        hourlyRate: z
            .string()
            .trim()
            .refine(
                (v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v),
                t('validation.settings.hourlyRateFormat')
            )
            .refine(
                (v) => v === '' || (Number(v) > 0 && Number(v) <= 10000),
                t('validation.settings.hourlyRateRange')
            ),
        availability: z.enum(['AVAILABLE', 'BUSY', 'UNAVAILABLE'], {
            error: t('validation.settings.availabilityRequired'),
        }),
    });

export const createPasswordSchema = (t) =>
    z
        .object({
            currentPassword: z.string().min(1, t('validation.currentPasswordRequired')),
            newPassword: z.string().min(6, t('validation.newPasswordMin6')),
            confirmPassword: z.string().min(1, t('validation.confirmPasswordRequired')),
        })
        .refine((v) => v.newPassword === v.confirmPassword, {
            message: t('validation.passwordsMismatch'),
            path: ['confirmPassword'],
        })
        .refine((v) => v.newPassword !== v.currentPassword, {
            message: t('validation.newPasswordDifferent'),
            path: ['newPassword'],
        });
