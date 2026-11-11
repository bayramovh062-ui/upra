import { z } from 'zod';

// Backend-dəki createProposalSchema ilə uyğundur (coverLetter ≥ 20, bidAmount > 0).
// jobPostId formada yoxdur, səhifə onu özü əlavə edir.
export const createProposalSchema = (t) =>
    z.object({
        bidAmount: z
            .number({ error: t('validation.proposal.bidNumber') })
            .positive(t('validation.proposal.bidPositive'))
            .max(10_000_000, t('validation.proposal.bidMax')),
        coverLetter: z
            .string({ error: t('validation.proposal.coverRequired') })
            .trim()
            .min(20, t('validation.proposal.coverMin'))
            .max(2000, t('validation.proposal.coverMax')),
    });
