import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { requestChangesSchema } from '../validators/contractValidator.js';
import { openDisputeSchema } from '../validators/disputeValidator.js';
import { fund, submit, approve, changes, dispute } from '../controllers/milestoneController.js';

const router = express.Router();

router.use(protect);

// Tərəf yoxlaması (bu müqavilənin client-i / frilanseri) servisdə aparılır, rol yoxlaması burada
router.post('/:id/fund', restrictTo('CLIENT'), fund);
router.post('/:id/submit', restrictTo('FREELANCER'), submit);
router.post('/:id/approve', restrictTo('CLIENT'), approve);
router.post('/:id/request-changes', restrictTo('CLIENT'), validate(requestChangesSchema), changes);
// P2: mübahisəni hər iki tərəf aça bilər (icazə financialService-də yoxlanılır)
router.post('/:id/dispute', validate(openDisputeSchema), dispute);

export default router;
