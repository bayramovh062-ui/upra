import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { createContractSchema } from '../validators/contractValidator.js';
import {
    createContract,
    getMyContracts,
    getContractById,
    completeContract,
    cancelContract,
} from '../controllers/contractController.js';

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('CLIENT'), validate(createContractSchema), createContract);
router.get('/my', getMyContracts);
router.get('/:id', getContractById);
router.patch('/:id/complete', restrictTo('CLIENT'), completeContract);
router.patch('/:id/cancel', restrictTo('CLIENT'), cancelContract);

export default router;