import { z } from 'zod';

export const REPORT_TARGET_TYPES = ['USER', 'CONTRACT', 'MILESTONE', 'JOB', 'MESSAGE'];

// İstifadəçi şikayəti yaradır. targetId UUID-dir; target-in mövcudluğu və görünürlüğü controller yoxlayır.
export const createReportSchema = z.object({
    targetType: z.enum(REPORT_TARGET_TYPES, {
        error: 'targetType must be USER, CONTRACT, MILESTONE, JOB or MESSAGE',
    }),
    targetId: z.string({ error: 'targetId is required' }).uuid('Invalid target ID format'),
    reason: z
        .string({ error: 'Reason is required' })
        .trim()
        .min(5, 'Reason must be at least 5 characters long')
        .max(500, 'Reason must be at most 500 characters long'),
    details: z.string().trim().max(2000, 'Details must be at most 2000 characters long').optional(),
});

// Admin şikayəti bağlayır. OPEN-a geri qaytarmaq üçün endpoint yoxdur.
export const reviewReportSchema = z.object({
    status: z.enum(['REVIEWED', 'CLOSED'], { error: 'Status must be REVIEWED or CLOSED' }),
    adminNote: z.string().trim().max(2000, 'Admin note must be at most 2000 characters long').optional(),
});
