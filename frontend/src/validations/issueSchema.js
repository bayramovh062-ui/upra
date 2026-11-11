import { z } from 'zod';

export const createIssueSchema = (t) =>
    z.object({
        title: z
            .string()
            .trim()
            .min(3, t('validation.issue.titleMin3'))
            .max(200, t('validation.issue.titleMax200')),
        description: z.string().trim().max(2000, t('validation.issue.descriptionMax2000')).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
        assigneeId: z.string().optional(), // '' = təyin olunmayıb
    });

export const createCommentSchema = (t) =>
    z.object({
        body: z
            .string()
            .trim()
            .min(1, t('validation.issue.commentRequired'))
            .max(1000, t('validation.issue.commentMax1000')),
    });
