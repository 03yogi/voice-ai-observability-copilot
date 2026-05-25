import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import apiRouter from './routes/api.js';
import { getDb } from './db.js';
import { embedHeaders } from './middleware/embed-headers.js';
import { startSyncScheduler } from './services/sync-scheduler.js';

const app = express();

app.use(embedHeaders);
app.use(cors({ origin: true }));
app.use(express.json());

getDb();

app.use('/api', apiRouter);

if (config.serveWeb) {
  app.use(express.static(config.webDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(config.webDistPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    details: err.body || undefined,
  });
});

app.listen(config.port, () => {
  const mode = config.serveWeb ? 'API + web UI' : 'API only';
  console.log(`${mode} listening on http://localhost:${config.port}`);
  if (config.serveWeb && config.publicUrl) {
    console.log(`GHL iframe URL: ${config.publicUrl}/?location_id={location_id}`);
  }
  startSyncScheduler();
});
