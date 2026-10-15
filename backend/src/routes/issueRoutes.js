import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import {
    createIssueSchema,
    updateIssueSchema,
    moveIssueSchema,
    createCommentSchema,
} from '../validators/issueValidator.js';
import {
    getContractIssues,
    createIssue,
    updateIssue,
    moveIssue,
    addIssueComment,
} from '../controllers/issueController.js';

const router = express.Router();

router.use(protect);

router.get('/contracts/:contractId/issues', getContractIssues);
router.post(
    '/contracts/:contractId/issues',
    validate(createIssueSchema),
    createIssue
);

router.patch('/issues/:id', validate(updateIssueSchema), updateIssue);
router.patch('/issues/:id/move', validate(moveIssueSchema), moveIssue);
router.post('/issues/:id/comments', validate(createCommentSchema), addIssueComment);

export default router;