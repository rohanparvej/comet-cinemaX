import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import screeningRoutes from './routes/screening.routes.js';
import movieLogRoutes from './routes/movieLog.routes.js';
import adminRoutes from './routes/admin.routes.js';
import siteImageRoutes from './routes/siteImage.routes.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();

// Default helmet CSP minus upgrade-insecure-requests (it breaks plain http on localhost in some browsers)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { 'upgrade-insecure-requests': null },
    },
  })
);
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()),
  })
);
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok' }));
app.use('/api/auth', authRoutes);

// One-time admin setup route. To remove it for good, just delete src/routes/bootstrap.routes.js.
try {
  const { default: bootstrapRoutes } = await import('./routes/bootstrap.routes.js');
  app.use('/api/auth', bootstrapRoutes);
} catch (err) {
  if (err.code !== 'ERR_MODULE_NOT_FOUND' || !String(err.message).includes('bootstrap.routes')) throw err;
}
app.use('/api/screenings', screeningRoutes);
app.use('/api/movie-logs', movieLogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/site', siteImageRoutes);

// Serve the frontend from the same server (open http://localhost:4000), so no CORS setup is needed.
// Set FRONTEND_DIR to change the folder; it is skipped if the folder does not exist.
const frontendDir = path.resolve(
  env.frontendDir || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../cinemax')
);
if (fs.existsSync(path.join(frontendDir, 'index.html'))) {
  app.use(express.static(frontendDir));
}

app.use(notFound);
app.use(errorHandler);

export default app;
