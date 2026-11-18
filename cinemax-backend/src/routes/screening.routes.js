import { Router } from 'express';
import * as screening from '../controllers/screening.controller.js';
import * as upcoming from '../controllers/upcoming.controller.js';
import { choicePoster, upcomingPoster } from '../controllers/poster.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../utils/schemas.js';

const router = Router();

// Public (landing page)
router.get('/choices', screening.listChoices);
router.get('/winner/current', screening.currentWinner);
router.get('/choices/:id/poster', validate({ params: idParam }), choicePoster.serve);
router.get('/upcoming', upcoming.list);
router.get('/upcoming/:id/poster', validate({ params: idParam }), upcomingPoster.serve);

// Logged-in users
router.get('/votes/me', protect, screening.myVote);
router.post('/choices/:id/vote', protect, validate({ params: idParam }), screening.vote);

export default router;
