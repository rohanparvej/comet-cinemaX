import { Router } from 'express';
import * as movies from '../controllers/movie.controller.js';

const router = Router();

router.get('/', movies.search); // public: searchable list of reviewable movies (?q=&limit=)

export default router;
