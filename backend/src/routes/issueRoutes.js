import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import {
    getContractIssues,
    createIssue,
    updateIssue,
    moveIssue,
    addIssueComment,
} from '../controllers/issueController.js';
import {
    createIssueSchema,
    updateIssueSchema,
    moveIssueSchema,
    createCommentSchema,
} from '../validators/issueValidator.js';

const router = express.Router();

router.get('/contracts/:contractId/issues', protect, getContractIssues);

router.post(
    '/contracts/:contractId/issues',
    protect,
    validate(createIssueSchema),
    createIssue
);

router.patch('/issues/:id', protect, validate(updateIssueSchema), updateIssue);

router.patch('/issues/:id/move', protect, validate(moveIssueSchema), moveIssue);

router.post(
    '/issues/:id/comments',
    protect,
    validate(createCommentSchema),
    addIssueComment
);

export default router;
