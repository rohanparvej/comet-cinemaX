import express, { Router } from 'express';
import * as admin from '../controllers/admin.controller.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import * as images from '../controllers/siteImage.controller.js';
import { uploadImage } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { env } from '../config/env.js';
import * as upcoming from '../controllers/upcoming.controller.js';
import { choicePoster, upcomingPoster } from '../controllers/poster.controller.js';
import {
  choiceBody,
  createUserBody,
  declareWinnerBody,
  idParam,
  posterBody,
  upcomingBody,
  upcomingUpdateBody,
  votingBody,
} from '../utils/schemas.js';

const router = Router();

// Everything below needs an admin token.
// JSON is read here (after the login check) with a bigger limit than the rest of the API,
// because a movie can carry a base64 poster. app.js skips its own small parser for /api/admin.
router.use(protect, requireAdmin, express.json({ limit: env.adminJsonLimitBytes }));

// Users: dropdown list for "recommended by", and create new accounts
router.get('/users', admin.listUsers);
router.post('/users', validate({ body: createUserBody }), admin.createUser);

// Poll entries
router.get('/choices', admin.listChoices);
router.post('/choices', validate({ body: choiceBody }), admin.createChoice);
router.delete('/choices/:id', validate({ params: idParam }), admin.removeChoice); // soft delete

// Poster of a poll movie (base64 data URI in the body; sending again replaces it)
router.put('/choices/:id/poster', validate({ params: idParam, body: posterBody }), choicePoster.set);
router.delete('/choices/:id/poster', validate({ params: idParam }), choicePoster.remove);

// Upcoming movies (home page shortlist scroller): as many as needed, each with its own poster
router.get('/upcoming', upcoming.list);
router.post('/upcoming', validate({ body: upcomingBody }), upcoming.create);
router.patch('/upcoming/:id', validate({ params: idParam, body: upcomingUpdateBody }), upcoming.update);
router.delete('/upcoming/:id', validate({ params: idParam }), upcoming.remove); // soft delete
router.put('/upcoming/:id/poster', validate({ params: idParam, body: posterBody }), upcomingPoster.set);
router.delete('/upcoming/:id/poster', validate({ params: idParam }), upcomingPoster.remove);

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

// "Open voting" switch: lets people vote again while the current winner stays
router.get('/voting', admin.getVoting);
router.put('/voting', validate({ body: votingBody }), admin.setVoting);

export default router;
