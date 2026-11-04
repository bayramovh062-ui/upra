import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { fund, submit, approve, changes } from '../controllers/milestoneController.js';

const router = express.Router();

router.use(protect);

// Tərəf yoxlaması (bu müqavilənin client-i / frilanseri) servisdə aparılır, rol yoxlaması burada
router.post('/:id/fund', restrictTo('CLIENT'), fund);
router.post('/:id/submit', restrictTo('FREELANCER'), submit);
router.post('/:id/approve', restrictTo('CLIENT'), approve);
router.post('/:id/request-changes', restrictTo('CLIENT'), changes);

export default router;
