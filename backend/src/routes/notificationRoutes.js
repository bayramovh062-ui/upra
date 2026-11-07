import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
    getNotifications,
    getUnreadCount,
    markRead,
    markAllRead,
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
// "read-all" :id marşrutundan ƏVVƏL gəlməlidir
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
