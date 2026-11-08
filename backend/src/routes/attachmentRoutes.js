import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { multiFiles, singleFile } from '../middlewares/upload.js';
import {
  getAttachment,
  uploadAvatar,
  uploadCommentFiles,
  uploadDisputeFiles,
  uploadIssueFiles,
  uploadMilestoneFiles,
} from '../controllers/attachmentController.js';

const router = express.Router();

router.use(protect);

// Own avatar
router.post('/avatar', singleFile('AVATAR', 'file'), uploadAvatar);

// Milestone delivery files (freelancer, funded milestone, before/for submission context)
router.post('/milestones/:id/files', multiFiles('MILESTONE_SUBMIT', 'files'), uploadMilestoneFiles);

// Dispute evidence (contract parties, open dispute)
router.post('/disputes/:id/files', multiFiles('DISPUTE_EVIDENCE', 'files'), uploadDisputeFiles);

// Issue / comment attachments (contract parties, active contract)
router.post('/issues/:id/files', multiFiles('ISSUE', 'files'), uploadIssueFiles);
router.post('/issue-comments/:id/files', multiFiles('ISSUE_COMMENT', 'files'), uploadCommentFiles);

// Attachment metadata (access controlled)
router.get('/:id', getAttachment);

export default router;
