import express from 'express';
import { getCategories, getSkills } from '../controllers/taxonomyController.js';

const router = express.Router();

// Hər ikisi ictimaidir (qeydiyyat və iş yaratma formalarında da lazımdır).
// Bu router /api-də quraşdırılıb, ona görə router.use(protect) YOXDUR (userRoutes-dakı qeydə bax).
router.get('/categories', getCategories);
router.get('/skills', getSkills);

export default router;
