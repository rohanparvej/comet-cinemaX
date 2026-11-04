import { Router } from 'express';
import * as admin from '../controllers/admin.controller.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import * as images from '../controllers/siteImage.controller.js';
import { uploadImage } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { choiceBody, createUserBody, declareWinnerBody, idParam } from '../utils/schemas.js';

const router = Router();

// Everything below needs an admin token
router.use(protect, requireAdmin);

// Users: dropdown list for "recommended by", and create new accounts
router.get('/users', admin.listUsers);
router.post('/users', validate({ body: createUserBody }), admin.createUser);

// Poll entries
router.get('/choices', admin.listChoices);
router.post('/choices', validate({ body: choiceBody }), admin.createChoice);
router.delete('/choices/:id', validate({ params: idParam }), admin.removeChoice); // soft delete

// Who voted for what
router.get('/votes', admin.votesByChoice);

// Site images (stored in MongoDB). Field name of the file: "image"
router.put('/images/:key', uploadImage, images.saveImage);
router.delete('/images/:key', images.removeImage);

// Winners
router.get('/winners', admin.listWinners);
router.post('/winners', validate({ body: declareWinnerBody }), admin.declareWinner);
router.patch('/winners/:id/current', validate({ params: idParam }), admin.makeCurrent);
router.delete('/winners/current', admin.clearCurrent);

export default router;
