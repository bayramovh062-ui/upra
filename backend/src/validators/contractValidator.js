import { z } from 'zod';

export const MAX_MILESTONES = 20;

// Dollar məbləği ən çox 2 onluq rəqəmlə (sent dəqiqliyi). 10.005 kimi dəyərlər rədd olunur.
const hasMaxTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const milestoneInputSchema = z.object({
    title: z.string({ error: 'Milestone title is required' }).trim().min(1, 'Milestone title is required').max(120, 'Milestone title must be at most 120 characters long'),
    amount: z
        .number({ error: 'Milestone amount must be a number' })
        .positive('Milestone amount must be positive')
        .refine(hasMaxTwoDecimals, 'Milestone amount can have at most 2 decimal places'),
    dueDate: z.coerce.date({ error: 'Milestone due date must be a valid date' }).optional(),
    // P2: dəyişiklik tələbi limiti (0..10). Verilməzsə default 2.
    maxRevisions: z
        .number({ error: 'maxRevisions must be a number' })
        .int('maxRevisions must be a whole number')
        .min(0, 'maxRevisions cannot be negative')
        .max(10, 'maxRevisions can be at most 10')
        .optional(),
});

export const createContractSchema = z.object({
    proposalId: z
        .string({ error: 'Proposal ID is required' })
        .uuid('Invalid Proposal ID format'),
    // İxtiyari: dollarla mərhələlər, cəmi təklifin məbləğinə bərabər olmalıdır (controller yoxlayır).
    // Verilməzsə təklifin tam məbləği üçün tək "Full delivery" mərhələsi yaranır.
    milestones: z
        .array(milestoneInputSchema)
        .min(1, 'Provide at least one milestone or omit the field')
        .max(MAX_MILESTONES, `You can add at most ${MAX_MILESTONES} milestones`)
        .optional(),
});

// İş başlayandan sonra ləğv təklifi: səbəb ixtiyaridir. Boş sətir "səbəb yoxdur" sayılır.
export const cancelRequestSchema = z.object({
    reason: z.string().trim().max(500, 'Reason must be at most 500 characters long').optional(),
});

// P2: dəyişiklik tələbi səbəbi (ixtiyari, geriyə uyğun)
export const requestChangesSchema = z.object({
    note: z.string().trim().max(1000, 'Note must be at most 1000 characters long').optional(),
});
