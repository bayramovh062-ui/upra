import { z } from 'zod';

// POST /api/ai/chat və /api/ai/disputes/:id/chat gövdəsi.
// Server vəziyyətsizdir: frontend son mesajları göndərir. Limitlər xərci və sui-istifadəni məhdudlaşdırır.
export const MAX_AI_MESSAGES = 10;
export const MAX_AI_CONTENT = 1000;

export const aiChatSchema = z
    .object({
        messages: z
            .array(
                z.object({
                    role: z.enum(['user', 'assistant']),
                    content: z.string().trim().min(1, 'Message cannot be empty').max(MAX_AI_CONTENT, `Message is too long (max ${MAX_AI_CONTENT} characters)`),
                })
            )
            .min(1, 'At least one message is required')
            .max(MAX_AI_MESSAGES, `At most ${MAX_AI_MESSAGES} messages are allowed`),
        locale: z.enum(['en', 'az', 'tr']).optional(),
        context: z.object({ contractId: z.string().uuid().optional() }).optional(),
    })
    .refine((data) => data.messages.at(-1)?.role === 'user', {
        message: 'The last message must be from the user',
        path: ['messages'],
    });
