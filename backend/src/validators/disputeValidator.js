import { z } from 'zod';

// P2: mübahisə açmaq. Səbəb mütləqdir, detal ixtiyari.
export const openDisputeSchema = z.object({
    reason: z
        .string({ error: 'Reason is required' })
        .trim()
        .min(5, 'Reason must be at least 5 characters long')
        .max(500, 'Reason must be at most 500 characters long'),
    details: z.string().trim().max(2000, 'Details must be at most 2000 characters long').optional(),
});

// Admin həlli. RELEASE/REFUND üçün məbləğlər serverdə gross-dan hesablanır;
// SPLIT üçün releaseCents + refundCents gross-a bərabər olmalıdır (financialService yoxlayır).
export const resolveDisputeSchema = z.object({
    resolution: z.enum(['RELEASE', 'REFUND', 'SPLIT'], {
        error: 'Resolution must be RELEASE, REFUND or SPLIT',
    }),
    releaseCents: z
        .number({ error: 'releaseCents must be a number' })
        .int('releaseCents must be a whole number')
        .min(0, 'releaseCents cannot be negative')
        .optional(),
    refundCents: z
        .number({ error: 'refundCents must be a number' })
        .int('refundCents must be a whole number')
        .min(0, 'refundCents cannot be negative')
        .optional(),
    adminNote: z.string().trim().max(2000, 'Admin note must be at most 2000 characters long').optional(),
});
