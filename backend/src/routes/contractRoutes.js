import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { createContractSchema, cancelRequestSchema } from '../validators/contractValidator.js';
import {
    createContract,
    getMyContracts,
    getContractById,
    completeContract,
    cancelContract,
    requestCancellation,
    acceptCancellation,
    declineCancellation,
    withdrawCancellation,
    deliverContract,
    reopenContract,
} from '../controllers/contractController.js';
import { getContractMilestones } from '../controllers/milestoneController.js';

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('CLIENT'), validate(createContractSchema), createContract);
router.get('/my', getMyContracts);
router.get('/:id', getContractById);
router.get('/:id/milestones', getContractMilestones);
router.patch('/:id/complete', restrictTo('CLIENT'), completeContract);
router.patch('/:id/deliver', restrictTo('FREELANCER'), deliverContract);
router.patch('/:id/reopen', restrictTo('CLIENT'), reopenContract);

// Ləğv: iş başlamayıbsa hər iki tərəf birbaşa ləğv edir.
// Başlayıbsa bir tərəf təklif göndərir, digəri qəbul edir və ya rədd edir (göndərən geri çəkə bilər).
router.patch('/:id/cancel', cancelContract);
router.patch('/:id/cancel-request', validate(cancelRequestSchema), requestCancellation);
router.patch('/:id/cancel-request/accept', acceptCancellation);
router.patch('/:id/cancel-request/decline', declineCancellation);
router.patch('/:id/cancel-request/withdraw', withdrawCancellation);

export default router;
