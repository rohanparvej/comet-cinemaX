import { Router } from 'express';
import * as images from '../controllers/siteImage.controller.js';

const router = Router();

// Public: the site loads these
router.get('/images', images.listImages);
router.get('/images/:key', images.getImage);

export default router;
