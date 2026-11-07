import { z } from 'zod';

// P3: müqavilə rəyi. Rating 1..5 tam ədəd, comment ixtiyari və uzunluq məhduddur.
// Rəy yaradıldıqdan sonra dəyişdirilə bilməz (redaktə endpointi yoxdur).
export const createReviewSchema = z.object({
    rating: z
        .number({ error: 'Rating must be a number' })
        .int('Rating must be a whole number')
        .min(1, 'Rating must be between 1 and 5')
        .max(5, 'Rating must be between 1 and 5'),
    comment: z.string().trim().max(1000, 'Comment must be at most 1000 characters long').optional(),
});
