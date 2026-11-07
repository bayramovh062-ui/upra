import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { resolveDisputeSchema } from '../validators/disputeValidator.js';
import { reviewReportSchema } from '../validators/reportValidator.js';
import { updateUserSuspensionSchema } from '../validators/adminValidator.js';
import {
    listDisputes,
    getDispute,
    resolveDisputeHandler,
    listReports,
    getReport,
    reviewReport,
    listUsers,
    updateUserSuspension,
} from '../controllers/adminController.js';

const router = express.Router();

// Bütün admin endpoint-ləri yalnız ADMIN rolu üçündür
router.use(protect, restrictTo('ADMIN'));

router.get('/disputes', listDisputes);
router.get('/disputes/:id', getDispute);
router.patch('/disputes/:id/resolve', validate(resolveDisputeSchema), resolveDisputeHandler);

router.get('/reports', listReports);
router.get('/reports/:id', getReport);
router.patch('/reports/:id', validate(reviewReportSchema), reviewReport);

// P3: istifadəçi moderasiyası (soft suspension)
router.get('/users', listUsers);
router.patch('/users/:id/suspension', validate(updateUserSuspensionSchema), updateUserSuspension);

export default router;
