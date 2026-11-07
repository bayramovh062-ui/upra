import { z } from 'zod';

// P3: admin istifadəçi suspension idarəsi. reason yalnız suspend edərkən mənalıdır.
export const updateUserSuspensionSchema = z.object({
    suspended: z.boolean({ error: 'suspended must be true or false' }),
    reason: z.string().trim().max(500, 'Suspension reason must be at most 500 characters long').optional(),
});
