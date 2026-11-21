import { Router } from 'express';
import * as logs from '../controllers/movieLog.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { movieLogBody } from '../utils/schemas.js';

const router = Router();

router.get('/', logs.listRecent);                 // public: newest reviews (?top_k=5)
router.get('/browse', logs.browse);               // public: forum page, filtered + paged reviews
router.get('/movies', logs.movieSummaries);       // public: forum page, one row per movie
router.get('/mine', protect, logs.listMine);      // my reviews
router.post('/', protect, validate({ body: movieLogBody }), logs.upsert);

export default router;
