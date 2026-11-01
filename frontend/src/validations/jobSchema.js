import { z } from 'zod';

// Backend-dəki createJobSchema ilə uyğundur (backend/src/validators/jobValidator.js).
// Wizard-da iki rejim var:
//   jobSchema   → "Publish" / "Save changes": bütün sahələr tələb olunur
//   draftSchema → "Save as draft": yalnız backend-in məcburi saydığı sahələr (title, description, budget)
// Yuxarı limitlər (120, 3000, 10 mln) yalnız interfeys üçündür.

export const MIN_DEADLINE_DAYS = 7;
export const MAX_JOB_SKILLS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVELS = ['ENTRY', 'MID', 'SENIOR'];
const PAYMENTS = ['MILESTONES', 'LUMP_SUM'];

// Backend UTC günü ilə müqayisə edir (bu gündən 7 gün sonra), ona görə burada da UTC işlənir.
// "YYYY-MM-DD" qaytarır: həm yoxlama, həm də <input type="date" min="..."> üçün
export const minDeadlineValue = () =>
    new Date(Date.now() + MIN_DEADLINE_DAYS * DAY_MS).toISOString().slice(0, 10);

// Hər addımda yoxlanan sahələr (Next basanda yalnız cari addım yoxlanır)
export const STEPS = [
    { key: 'basics', title: 'Basics', fields: ['title', 'categoryId', 'experienceLevel'] },
    { key: 'scope', title: 'Scope', fields: ['description', 'skills'] },
    { key: 'budget', title: 'Budget & timeline', fields: ['budget', 'paymentStructure', 'deadline'] },
];

// initialDeadline: redaktədə elanın köhnə son tarixi. İstifadəçi ona toxunmayıbsa,
// tarix artıq 7 gündən yaxın olsa belə yoxlamadan keçir (backend də göndərilməyən sahəni yoxlamır).
export const createJobSchemas = ({ initialDeadline = '' } = {}) => {
    const title = z
        .string({ error: 'Title is required' })
        .trim()
        .min(5, 'Title must be at least 5 characters')
        .max(120, 'Title must be at most 120 characters');

    const description = z
        .string({ error: 'Description is required' })
        .trim()
        .min(20, 'Description must be at least 20 characters')
        .max(3000, 'Description must be at most 3,000 characters');

    // budget inputda register('budget', { valueAsNumber: true }) ilə rəqəmə çevrilir, boş olanda NaN gəlir
    const budget = z
        .number({ error: 'Budget must be a number' })
        .positive('Budget must be greater than 0')
        .max(10_000_000, 'Budget is too large');

    const paymentStructure = z.enum(PAYMENTS, { error: 'Choose a payment structure' });

    const deadline = z
        .string()
        .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date')
        .optional()
        .refine(
            (value) => !value || value === initialDeadline || value >= minDeadlineValue(),
            `Deadline must be at least ${MIN_DEADLINE_DAYS} days from today`
        );

    const common = { title, description, budget, paymentStructure, deadline };
    const tooManySkills = `You can add at most ${MAX_JOB_SKILLS} skills`;

    const jobSchema = z.object({
        ...common,
        categoryId: z.string({ error: 'Choose a category' }).min(1, 'Choose a category'),
        experienceLevel: z.enum(LEVELS, { error: 'Choose an experience level' }),
        skills: z
            .array(z.string())
            .min(1, 'Add at least one skill')
            .max(MAX_JOB_SKILLS, tooManySkills),
    });

    const draftSchema = z.object({
        ...common,
        categoryId: z.string().optional(),
        experienceLevel: z.union([z.enum(LEVELS), z.literal('')]).optional(),
        skills: z.array(z.string()).max(MAX_JOB_SKILLS, tooManySkills),
    });

    return { jobSchema, draftSchema };
};

// Formadan çıxan dəyərləri API gövdəsinə çevirir.
//   isEdit=false: boş son tarix göndərilmir.
//   isEdit=true : dəyişməyibsə göndərilmir, təmizlənibsə null göndərilir (backend silir).
export const buildJobPayload = (values, { isEdit = false, initialDeadline = '' } = {}) => {
    const payload = {
        title: values.title,
        description: values.description,
        budget: values.budget,
        paymentStructure: values.paymentStructure || 'MILESTONES',
        categoryId: values.categoryId || null,
        experienceLevel: values.experienceLevel || null,
        skills: values.skills ?? [],
    };

    if (values.deadline) {
        if (!(isEdit && values.deadline === initialDeadline)) payload.deadline = values.deadline;
    } else if (isEdit && initialDeadline) {
        payload.deadline = null;
    }

    return payload;
};
