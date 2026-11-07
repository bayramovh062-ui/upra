import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { autoApproveDue } from '../services/financialService.js';

const router = express.Router();

const safeEqual = (a, b) => {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && timingSafeEqual(left, right);
};

// Xarici cron (Render Cron Job, cron-job.org, GitHub Actions) bu endpoint-i çağırır.
// Render-in pulsuz instansiyası yatdığı üçün server.js-dəki setInterval təkbaşına etibarlı deyil: bu sorğu instansiyanı oyadır da.
// CRON_SECRET təyin olunmayıbsa endpoint söndürülüb (404), yanlış secret 401 qaytarır.
// Nümunə: curl -X POST https://<api>/api/internal/auto-approve -H "x-cron-secret: $CRON_SECRET"
router.post(
    '/auto-approve',
    asyncHandler(async (req, res) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
            throw new AppError('Not found', 404);
        }

        if (!safeEqual(req.get('x-cron-secret') ?? '', secret)) {
            throw new AppError('Invalid cron secret', 401);
        }

        const summary = await autoApproveDue();
        res.status(200).json({ success: true, summary });
    })
);

export default router;
