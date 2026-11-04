import { z } from 'zod';
import { MAX_TOPUP_CENTS, MAX_AMOUNT_CENTS } from '../services/financialService.js';

const cents = (max, label) =>
    z
        .number({ error: 'Amount must be a number' })
        .int('Amount must be a whole number of cents')
        .positive('Amount must be positive')
        .max(max, `${label} is limited to ${max} cents per request`);

// DEMO: bir sorğuya maksimum 500000 sent ($5000)
export const topUpSchema = z.object({
    amountCents: cents(MAX_TOPUP_CENTS, 'Top-up'),
});

export const withdrawSchema = z.object({
    amountCents: cents(MAX_AMOUNT_CENTS, 'Withdrawal'),
});
