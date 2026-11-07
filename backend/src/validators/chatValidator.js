import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 2000;

export const openConversationSchema = z.object({
    userId: z.string({ error: 'User ID is required' }).uuid('Invalid user ID format'),
});

// .trim() .min()-dən əvvəl: yalnız boşluqdan ibarət mesaj keçməsin
export const sendMessageSchema = z.object({
    body: z
        .string({ error: 'Message is required' })
        .trim()
        .min(1, 'Message cannot be empty')
        .max(MAX_MESSAGE_LENGTH, `Message must be at most ${MAX_MESSAGE_LENGTH} characters long`),
});
