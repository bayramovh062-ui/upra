import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { messageLimiter } from '../middlewares/rateLimiter.js';
import { openConversationSchema, sendMessageSchema } from '../validators/chatValidator.js';
import {
    openConversation,
    getConversations,
    getUnreadCount,
    getConversation,
    getMessages,
    sendMessage,
    markConversationRead,
} from '../controllers/conversationController.js';

const router = express.Router();

router.use(protect);

router.get('/', getConversations);
// "unread-count" :id marşrutundan ƏVVƏL gəlməlidir
router.get('/unread-count', getUnreadCount);
router.post('/', validate(openConversationSchema), openConversation);
router.get('/:id', getConversation);
router.get('/:id/messages', getMessages);
// Limit protect-dən sonra gəlir ki, açar istifadəçi olsun
router.post('/:id/messages', messageLimiter, validate(sendMessageSchema), sendMessage);
router.patch('/:id/read', markConversationRead);

export default router;
