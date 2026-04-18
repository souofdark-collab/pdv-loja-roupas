import path from 'path';
import fs from 'fs';
import os from 'os';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function freshTmpDir(prefix = 'pdv-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function buildApp(tmpRoot) {
  const dataRoot = path.join(tmpRoot, 'pdv-loja-roupas');
  fs.mkdirSync(dataRoot, { recursive: true });
  process.env.APPDATA = tmpRoot;
  process.env.HOME = tmpRoot;

  const dbPath = require.resolve('../../electron/api/db');
  delete require.cache[dbPath];
  const routesDir = path.join(__dirname, '..', '..', 'electron', 'api', 'routes');
  for (const f of fs.readdirSync(routesDir)) {
    const full = path.join(routesDir, f);
    if (require.cache[full]) delete require.cache[full];
  }

  const db = require('../../electron/api/db');
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  for (const file of fs.readdirSync(routesDir).filter(f => f.endsWith('.js'))) {
    const route = require(path.join(routesDir, file));
    app.use('/api', route(db));
  }

  return { app, db, dataRoot };
}
