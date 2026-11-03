import { z } from 'zod';
import { skillNameSchema } from '../utils/skills.js';

export const MAX_USER_SKILLS = 15;

const isHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

// IANA saat qurşağı (məs. "Asia/Baku", "UTC"). Node-un Intl məlumat bazası ilə yoxlanılır
export const isValidTimezone = (value) => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
    } catch {
        return false;
    }
};

const hasAtMostTwoDecimals = (value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

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
        fullName: z
            .string()
            .trim()
            .min(2, 'Full name must be at least 2 characters long')
            .max(100, 'Full name must be at most 100 characters long')
            .optional(),
        headline: z.string().trim().max(120, 'Headline must be at most 120 characters long').nullable().optional(),
        bio: z.string().trim().max(1000, 'Bio must be at most 1000 characters long').nullable().optional(),
        hourlyRate: z
            .number({ error: 'Hourly rate must be a number' })
            .positive('Hourly rate must be a positive number')
            .max(10000, 'Hourly rate is too high')
            .refine(hasAtMostTwoDecimals, 'Hourly rate can have at most 2 decimal places')
            .nullable()
            .optional(),
        location: z.string().trim().max(80, 'Location must be at most 80 characters long').nullable().optional(),
        timezone: z
            .string()
            .trim()
            .max(60, 'Timezone must be at most 60 characters long')
            .refine((v) => v === '' || isValidTimezone(v), 'Timezone must be a valid IANA time zone (e.g. Europe/London)')
            .nullable()
            .optional(),
        availability: z
            .enum(['AVAILABLE', 'BUSY', 'UNAVAILABLE'], {
                error: 'Availability must be AVAILABLE, BUSY or UNAVAILABLE',
            })
            .optional(),
        avatarUrl: z
            .string()
            .trim()
            .max(500, 'Avatar URL is too long')
            .refine((v) => v === '' || isHttpUrl(v), 'Avatar URL must start with http:// or https://')
            .nullable()
            .optional(),
        // false: profili yalnız özü tam görür, başqalar ad və rolu görür
        profilePublic: z.boolean({ error: 'Profile visibility must be true or false' }).optional(),
        // Frilanserin bacarıqları (tam siyahı göndərilir, köhnəsi əvəz olunur). Boş massiv hamısını silir.
        skills: z.array(skillNameSchema).max(MAX_USER_SKILLS, `You can add at most ${MAX_USER_SKILLS} skills`).optional(),
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
