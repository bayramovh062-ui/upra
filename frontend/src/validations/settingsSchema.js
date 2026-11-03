import { z } from 'zod';
import { isValidTimezone } from '../lib/labels';

// Qaydalar backend-dəki updateMeSchema ilə eynidir (backend/src/validators/authValidator.js)
const isHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

const optionalText = (max, label) => z.string().trim().max(max, `${label} must be at most ${max} characters`);

export const profileSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long'),
    avatarUrl: optionalText(500, 'Avatar URL').refine(
        (v) => v === '' || isHttpUrl(v),
        'Avatar URL must start with http:// or https://'
    ),
    location: optionalText(80, 'Location'),
    timezone: z
        .string()
        .trim()
        .refine((v) => v === '' || isValidTimezone(v), 'Choose a valid time zone'),
});

// hourlyRate formada mətn kimi saxlanılır, göndəriləndə rəqəmə çevrilir (boş = null)
export const professionalSchema = z.object({
    headline: optionalText(120, 'Headline'),
    bio: optionalText(1000, 'Bio'),
    hourlyRate: z
        .string()
        .trim()
        .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Enter a number with up to 2 decimal places')
        .refine((v) => v === '' || (Number(v) > 0 && Number(v) <= 10000), 'Hourly rate must be between 0.01 and 10,000'),
    availability: z.enum(['AVAILABLE', 'BUSY', 'UNAVAILABLE'], { error: 'Choose your availability' }),
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
