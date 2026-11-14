import express from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { aiLimiter } from '../middlewares/rateLimiter.js';
import { aiChatSchema } from '../validators/aiValidator.js';
import { chat, disputeChat, getStatus } from '../controllers/aiController.js';

const router = express.Router();

router.use(protect);

router.get('/status', getStatus);
router.post('/chat', aiLimiter, validate(aiChatSchema), chat);
router.post('/disputes/:id/chat', restrictTo('ADMIN'), aiLimiter, validate(aiChatSchema), disputeChat);

export default router;
