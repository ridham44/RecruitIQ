// Self-hosted production entry point (deploy.sh). Serves the built React
// app from dist/ and the Express API on one port. The Vercel deployment
// keeps using api/index.js — this file is never imported by that path.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';
import { env } from './config/env.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.join(rootDir, 'dist');

const api = createApp();
const server = express();

// One proxy hop (nginx) so req.ip is the real client — same as app.js.
server.set('trust proxy', 1);

// Everything under /api goes to the API app (including its JSON 404s).
server.use((req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return api(req, res, next);
  return next();
});

// Hashed build assets can be cached forever; index.html must not be.
server.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y' }));
server.use(express.static(distDir, { index: false }));

// SPA fallback — React Router handles every other path client-side.
server.get('*', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(distDir, 'index.html'));
});

server.listen(env.port, () => {
  console.log(`RecruitIQ (web + API) listening on http://localhost:${env.port}`);
});
