import { z } from 'zod';
import { skillNameSchema } from '../utils/skills.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_DEADLINE_DAYS = 7;
export const MAX_JOB_SKILLS = 8;

const startOfUtcDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

// Tarixə görə müqayisə (saata yox): "YYYY-MM-DD" seçən istifadəçi saat qurşağı səbəbindən rədd olunmasın
const isAtLeastMinDays = (date) => startOfUtcDay(date) >= startOfUtcDay(new Date()) + MIN_DEADLINE_DAYS * DAY_MS;

// null = son tarixi sil. (z.union əvəzinə nullable: union xəta mesajını "Invalid input"-a çevirir.)
const deadlineSchema = z.coerce
    .date({ error: 'Deadline must be a valid date' })
    .refine(isAtLeastMinDays, `Deadline must be at least ${MIN_DEADLINE_DAYS} days from today`)
    .nullable();

const experienceLevelSchema = z.enum(['ENTRY', 'MID', 'SENIOR'], {
    error: 'Experience level must be ENTRY, MID or SENIOR',
});

const paymentStructureSchema = z.enum(['MILESTONES', 'LUMP_SUM'], {
    error: 'Payment structure must be MILESTONES or LUMP_SUM',
});

const skillsSchema = z.array(skillNameSchema).max(MAX_JOB_SKILLS, `You can add at most ${MAX_JOB_SKILLS} skills`);

export const createJobSchema = z.object({
    // trim() min()-dən ƏVVƏL: yoxsa boşluqlardan ibarət dəyər yoxlamadan keçərdi
    title: z.string({ error: 'Title is required' }).trim().min(5, 'Title must be at least 5 characters long'),
    description: z.string({ error: 'Description is required' }).trim().min(20, 'Description must be at least 20 characters long'),
    budget: z.number({ error: 'Budget must be a number' }).positive('Budget must be a positive number'),

    categoryId: z.string().min(1, 'Invalid category').nullable().optional(),
    experienceLevel: experienceLevelSchema.nullable().optional(),
    paymentStructure: paymentStructureSchema.optional(),
    deadline: deadlineSchema.optional(),
    skills: skillsSchema.optional(),

    // DRAFT: yalnız client görür, /jobs/:id/publish ilə dərc olunur. Verilməzsə dərhal OPEN olur.
    status: z.enum(['DRAFT', 'OPEN'], { error: 'Status must be DRAFT or OPEN' }).optional(),
});

// status burada YOXDUR: status dəyişikliyi yalnız publish/delete ilə. Göndərilsə də zod onu atır.
export const updateJobSchema = z
    .object({
        title: z.string().trim().min(5, 'Title must be at least 5 characters long').optional(),
        description: z.string().trim().min(20, 'Description must be at least 20 characters long').optional(),
        budget: z.number().positive('Budget must be a positive number').optional(),

        categoryId: z.string().min(1, 'Invalid category').nullable().optional(),
        experienceLevel: experienceLevelSchema.nullable().optional(),
        paymentStructure: paymentStructureSchema.optional(),
        deadline: deadlineSchema.optional(),
        skills: skillsSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'Please provide at least one field to update',
    });
