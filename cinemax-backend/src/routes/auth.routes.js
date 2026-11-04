import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginBody } from '../utils/schemas.js';

const router = Router();

// Limit on login attempts to slow down password guessing
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false }));

router.post('/login', validate({ body: loginBody }), auth.login);
router.post('/admin/login', validate({ body: loginBody }), auth.adminLogin);
router.get('/me', protect, auth.me);

export default router;
