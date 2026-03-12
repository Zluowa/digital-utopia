// @input: Engine registry, economy
// @output: Agent CRUD + state + file browser routes
// @position: 代理操作 API 层

import type { Express } from 'express';
import path from 'path';
import { existsSync, promises as fs } from 'fs';
import { ok, err } from '../types.js';
import type { RouteContext } from './world.js';

export function registerAgentRoutes(
  app: Express,
  context: Pick<RouteContext, 'getEngine'>,
): void {
  app.post('/api/agents/:id/awaken', async (req, res) => {
    const engine = context.getEngine();
    engine.setAgentSkip(req.params.id, false);
    await engine.awaken(req.params.id, req.body?.reason ?? 'manual');
    res.json({ ok: true });
  });

  app.post('/api/world/awaken-all', async (_r, res) => {
    const engine = context.getEngine();
    for (const agent of engine.registry.all()) {
      if (agent.status !== 'dead') engine.setAgentSkip(agent.id, false);
    }
    await engine.awakenAll('manual awaken-all');
    res.json({ ok: true });
  });

  app.post('/api/task-attempts/:id/stop', async (req, res) => {
    const engine = context.getEngine();
    const agent = engine.registry.get(req.params.id);
    if (!agent) return res.json(err('not found'));
    engine.killAgent(agent.id);
    engine.setAgentSkip(agent.id, true);
    res.json(ok(null));
  });

  app.post('/api/agents/:id/toggle-active', (req, res) => {
    const engine = context.getEngine();
    const agent = engine.registry.get(req.params.id);
    if (!agent) return res.json(err('not found'));
    const active = req.body?.active ?? true;
    engine.setAgentSkip(agent.id, !active);
    if (!active) engine.killAgent(agent.id);
    res.json(ok({ agentId: agent.id, active }));
  });

  app.get('/api/agents/skip-list', (_r, res) => {
    const engine = context.getEngine();
    res.json(ok(engine.getSkipList()));
  });

  app.post('/api/agents/:id/transfer', async (req, res) => {
    const engine = context.getEngine();
    const { to, amount, reason } = req.body ?? {};
    if (!to || !amount) return res.json(err('missing to/amount'));
    const fromAgent = engine.registry.get(req.params.id);
    const toAgent = engine.registry.get(to);
    if (!fromAgent || !toAgent) return res.json(err('agent not found'));
    const taxRate = engine.config.physics.economy.taxRate ?? 0;
    const { transferWithTax, getBalance } = await import('../economy.js');
    const result = await transferWithTax(
      fromAgent.dir, fromAgent.id, toAgent.dir, toAgent.id,
      amount, reason ?? '', engine.worldDir, taxRate,
    );
    if (!result) return res.json(err('insufficient balance'));
    engine.registry.update(fromAgent.id, { tokenBalance: await getBalance(fromAgent.dir) });
    engine.registry.update(toAgent.id, { tokenBalance: await getBalance(toAgent.dir) });
    res.json(ok({ transferred: amount, taxRate }));
  });

  app.get('/api/agents/:id/files', async (req, res) => {
    const engine = context.getEngine();
    const agentDir = engine.registry.getDir(req.params.id);
    const target = path.resolve(agentDir, (req.query.path as string) ?? '.');
    if (!target.startsWith(agentDir + path.sep) && target !== agentDir) {
      return res.status(403).json(err('path escapes agent sandbox'));
    }
    if (!existsSync(target)) return res.json(ok([]));
    const entries = await fs.readdir(target, { withFileTypes: true });
    res.json(ok(entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))));
  });

  app.get('/api/agents/:id/file', async (req, res) => {
    const engine = context.getEngine();
    const agentDir = engine.registry.getDir(req.params.id);
    const filePath = path.resolve(agentDir, (req.query.path as string) ?? 'CLAUDE.md');
    if (!filePath.startsWith(agentDir + path.sep) && filePath !== agentDir) {
      return res.status(403).json(err('path escapes agent sandbox'));
    }
    if (!existsSync(filePath)) return res.status(404).json(err('not found'));
    res.json(ok({ path: req.query.path, content: await fs.readFile(filePath, 'utf-8') }));
  });

  app.post('/api/agents/:id/bury', async (req, res) => {
    const engine = context.getEngine();
    const { epitaph, cause } = req.body ?? {};
    if (!epitaph) return res.json(err('missing epitaph'));
    try {
      const record = await engine.buryAgent(req.params.id, epitaph, cause ?? 'culled');
      res.json(ok(record));
    } catch (e: unknown) {
      res.json(err((e as Error).message));
    }
  });

  app.get('/api/graveyard', async (_r, res) => {
    const engine = context.getEngine();
    res.json(ok(await engine.getGraves()));
  });
}
