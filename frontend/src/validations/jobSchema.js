import { z } from 'zod';

// Backend-dəki createJobSchema ilə uyğundur (title ≥ 5, description ≥ 20, budget > 0).
// Yuxarı limitlər yalnız interfeys üçündür.
// budget inputda register('budget', { valueAsNumber: true }) ilə rəqəmə çevrilir, boş olanda NaN gəlir.
export const jobSchema = z.object({
    title: z
        .string({ error: 'Title is required' })
        .trim()
        .min(5, 'Title must be at least 5 characters')
        .max(120, 'Title must be at most 120 characters'),
    description: z
        .string({ error: 'Description is required' })
        .trim()
        .min(20, 'Description must be at least 20 characters')
        .max(3000, 'Description must be at most 3,000 characters'),
    budget: z
        .number({ error: 'Budget must be a number' })
        .positive('Budget must be greater than 0')
        .max(10_000_000, 'Budget is too large'),
});
