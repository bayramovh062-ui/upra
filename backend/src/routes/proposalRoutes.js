import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import {
    createProposalSchema,
    updateProposalSchema,
} from '../validators/proposalValidator.js';
import {
    createProposal,
    getProposalById,
    getMyProposals,
    getProposalsForJob,
    updateProposal,
    deleteProposal,
} from '../controllers/proposalController.js';

const router = express.Router();

router.use(protect);

router.post('/', restrictTo('FREELANCER'), validate(createProposalSchema), createProposal);
router.get('/my', restrictTo('FREELANCER'), getMyProposals);
router.get('/job/:jobId', restrictTo('CLIENT'), getProposalsForJob);
router.patch('/:id', restrictTo('FREELANCER'), validate(updateProposalSchema), updateProposal);
router.delete('/:id', restrictTo('FREELANCER'), deleteProposal);
router.get('/:id', getProposalById)

export default router;