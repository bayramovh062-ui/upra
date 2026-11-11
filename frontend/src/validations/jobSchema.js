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

// Hər addımda yoxlanan sahələr (Next basanda yalnız cari addım yoxlanır).
// `titleKey` tərcümə açarıdır; JobForm onu `t` ilə oxuyur.
export const STEPS = [
    { key: 'basics', titleKey: 'jobs.form.steps.basics', fields: ['title', 'categoryId', 'experienceLevel'] },
    { key: 'scope', titleKey: 'jobs.form.steps.scope', fields: ['description', 'skills'] },
    { key: 'budget', titleKey: 'jobs.form.steps.budget', fields: ['budget', 'paymentStructure', 'deadline'] },
];

// initialDeadline: redaktədə elanın köhnə son tarixi. İstifadəçi ona toxunmayıbsa,
// tarix artıq 7 gündən yaxın olsa belə yoxlamadan keçir (backend də göndərilməyən sahəni yoxlamır).
export const createJobSchemas = ({ initialDeadline = '', t }) => {
    const title = z
        .string({ error: t('validation.job.titleRequired') })
        .trim()
        .min(5, t('validation.job.titleMin5'))
        .max(120, t('validation.job.titleMax120'));

    const description = z
        .string({ error: t('validation.job.descriptionRequired') })
        .trim()
        .min(20, t('validation.job.descriptionMin20'))
        .max(3000, t('validation.job.descriptionMax3000'));

    // budget inputda register('budget', { valueAsNumber: true }) ilə rəqəmə çevrilir, boş olanda NaN gəlir
    const budget = z
        .number({ error: t('validation.job.budgetNumber') })
        .positive(t('validation.job.budgetPositive'))
        .max(10_000_000, t('validation.job.budgetMax'));

    const paymentStructure = z.enum(PAYMENTS, { error: t('validation.job.paymentStructureRequired') });

    const deadline = z
        .string()
        .regex(/^(\d{4}-\d{2}-\d{2})?$/, t('validation.job.deadlineInvalid'))
        .optional()
        .refine(
            (value) => !value || value === initialDeadline || value >= minDeadlineValue(),
            t('validation.job.deadlineMin', { days: MIN_DEADLINE_DAYS })
        );

    const common = { title, description, budget, paymentStructure, deadline };
    const tooManySkills = t('validation.job.skillsMax', { max: MAX_JOB_SKILLS });

    const jobSchema = z.object({
        ...common,
        categoryId: z
            .string({ error: t('validation.job.categoryRequired') })
            .min(1, t('validation.job.categoryRequired')),
        experienceLevel: z.enum(LEVELS, { error: t('validation.job.experienceRequired') }),
        skills: z
            .array(z.string())
            .min(1, t('validation.job.skillsMin'))
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
