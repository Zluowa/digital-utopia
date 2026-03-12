// @input: Engine, config
// @output: World CRUD + config routes
// @position: 世界管理 + 配置 API 层

import type { Express } from 'express';
import path from 'path';
import { ok, err } from '../types.js';
import * as config from '../config.js';
import {
  createEngine,
  listWorlds,
  bootstrapWorldFromSpec,
  deleteWorld,
  updateWorld,
  WorldNotFoundError,
  WorldActiveError,
  WorldValidationError,
} from '../index.js';

export interface RouteContext {
  getEngine: () => import('../index.js').Engine;
  setEngine: (engine: import('../index.js').Engine) => void;
}

export function registerWorldRoutes(
  app: Express,
  context: Pick<RouteContext, 'getEngine' | 'setEngine'>,
): void {
  app.get('/api/health', (_r, res) => res.json({ ok: true }));

  app.get('/api/snapshot', async (_r, res) => res.json(await context.getEngine().snapshot()));

  app.get('/api/tree', async (_r, res) => {
    const snap = await context.getEngine().snapshot();
    res.json(snap.tree ?? null);
  });

  // ── Config ───────────────────────────────────────────────
  app.get('/api/config', (_r, res) => {
    res.json(ok({ current: config.getSafeConfig(), defaults: config.getDefaults(), envMap: config.getEnvMap() }));
  });

  app.put('/api/config', (req, res) => {
    try { config.setConfigOverrides(req.body as Record<string, unknown>); return res.json(ok(config.getConfig())); }
    catch (e) { return res.status(400).json(err((e as Error).message)); }
  });

  app.post('/api/config/reset', (_r, res) => { config.resetConfig(); res.json(ok(config.getConfig())); });

  // ── World CRUD ───────────────────────────────────────────
  app.get('/api/worlds', async (_r, res) => {
    const engine = context.getEngine();
    res.json(ok(await listWorlds(engine.projectRoot, path.basename(engine.worldDir))));
  });

  app.post('/api/worlds', async (req, res) => {
    try {
      const engine = context.getEngine();
      const { name, theme, agents } = req.body ?? {};
      if (!name) return res.status(400).json(err('name is required'));
      res.json(ok(await bootstrapWorldFromSpec(engine.projectRoot, { name, theme, agents: agents ?? [] })));
    } catch (e: unknown) { res.status(500).json(err((e as Error).message)); }
  });

  let activating = false;
  app.post('/api/worlds/:name/activate', async (req, res) => {
    if (activating) return res.status(409).json(err('activation in progress'));
    activating = true;
    const prev = context.getEngine();
    try {
      prev.shutdown();
      const next = await createEngine(prev.projectRoot, req.params.name);
      await next.init();
      context.setEngine(next);
      res.json(ok({ activated: req.params.name }));
    } catch (e: unknown) {
      try { await prev.init(); context.setEngine(prev); } catch {}
      res.status(500).json(err((e as Error).message));
    } finally { activating = false; }
  });

  app.delete('/api/worlds/:name', async (req, res) => {
    try {
      const engine = context.getEngine();
      await deleteWorld(engine.projectRoot, req.params.name, path.basename(engine.worldDir));
      res.json(ok({ deleted: req.params.name }));
    } catch (e: unknown) {
      const status = e instanceof WorldActiveError ? 409
        : e instanceof WorldNotFoundError ? 404
          : e instanceof WorldValidationError ? 400 : 500;
      res.status(status).json(err((e as Error).message));
    }
  });

  app.put('/api/worlds/:name', async (req, res) => {
    try {
      const engine = context.getEngine();
      const { name, theme } = req.body ?? {};
      res.json(ok({ updated: await updateWorld(engine.projectRoot, req.params.name, { name, theme }) }));
    } catch (e: unknown) {
      const status = e instanceof WorldNotFoundError ? 404 : e instanceof WorldValidationError ? 400 : 500;
      res.status(status).json(err((e as Error).message));
    }
  });
}
