import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { resolveDisputeSchema } from '../validators/disputeValidator.js';
import { reviewReportSchema } from '../validators/reportValidator.js';
import {
    listDisputes,
    getDispute,
    resolveDisputeHandler,
    listReports,
    reviewReport,
} from '../controllers/adminController.js';

const router = express.Router();

// Bütün admin endpoint-ləri yalnız ADMIN rolu üçündür
router.use(protect, restrictTo('ADMIN'));

router.get('/disputes', listDisputes);
router.get('/disputes/:id', getDispute);
router.patch('/disputes/:id/resolve', validate(resolveDisputeSchema), resolveDisputeHandler);

router.get('/reports', listReports);
router.patch('/reports/:id', validate(reviewReportSchema), reviewReport);

export default router;
