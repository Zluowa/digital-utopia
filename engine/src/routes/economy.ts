// @input: Engine economy
// @output: Economic operations + metrics routes
// @position: 经济操作 API 层

import type { Express } from 'express';
import { ok, err } from '../types.js';
import type { RouteContext } from './world.js';

export function registerEconomyRoutes(
  app: Express,
  context: Pick<RouteContext, 'getEngine'>,
): void {
  app.post('/api/world/treasury/pay', async (req, res) => {
    const engine = context.getEngine();
    const { agentId, amount, reason } = req.body ?? {};
    if (!agentId || !amount) return res.json(err('missing agentId/amount'));
    const agent = engine.registry.get(agentId);
    if (!agent) return res.json(err('agent not found'));
    const { treasuryPay, getBalance } = await import('../economy.js');
    const result = await treasuryPay(engine.worldDir, agentId, agent.dir, amount, reason ?? 'treasury payout');
    if (!result) return res.json(err('insufficient treasury balance'));
    engine.registry.update(agentId, { tokenBalance: await getBalance(agent.dir) });
    res.json(ok({ paid: amount, to: agentId }));
  });

  app.get('/api/economy/transactions', async (req, res) => {
    const engine = context.getEngine();
    const limit = Number(req.query.limit) || 50;
    const { getTransactions } = await import('../economy.js');
    res.json(ok(await getTransactions(engine.worldDir, limit)));
  });

  app.get('/api/economy/metrics', async (req, res) => {
    const engine = context.getEngine();
    const { getEconomicMetrics } = await import('../snapshot.js');
    const agentDirs = engine.registry.all().map(a => ({ id: a.id, dir: a.dir }));
    const prevCirculation = req.query.prevCirculation != null
      ? Number(req.query.prevCirculation)
      : undefined;
    res.json(ok(await getEconomicMetrics(engine.worldDir, agentDirs, prevCirculation)));
  });

  app.get('/api/economy/summary', async (req, res) => {
    const engine = context.getEngine();
    const { getEconomySummary } = await import('../economy.js');
    const agentDirs = engine.registry.all().map(a => ({ id: a.id, dir: a.dir }));
    res.json(ok(await getEconomySummary(engine.worldDir, agentDirs)));
  });

  app.get('/api/economy/flow', async (_r, res) => {
    const engine = context.getEngine();
    const { getEconomyFlow } = await import('../snapshot.js');
    const agentDirs = engine.registry.all().map(a => ({ id: a.id, dir: a.dir }));
    res.json(ok(await getEconomyFlow(engine.worldDir, agentDirs)));
  });

  app.get('/api/economy/leaderboard', async (_r, res) => {
    const engine = context.getEngine();
    const agents = engine.registry.all();
    const sorted = [...agents]
      .sort((a, b) => b.tokenBalance - a.tokenBalance)
      .map((a, i) => ({ rank: i + 1, agentId: a.id, balance: a.tokenBalance, status: a.status }));
    res.json(ok(sorted));
  });

  // ── External revenue deposit (real money → tokens) ──────
  app.post('/api/exchange/deposit', async (req, res) => {
    const engine = context.getEngine();
    const { agentId, amountUsd, reason, paymentRef } = req.body ?? {};
    if (!agentId || !amountUsd || amountUsd <= 0) return res.json(err('missing agentId or invalid amountUsd'));
    const agent = engine.registry.get(agentId);
    if (!agent) return res.json(err('agent not found'));
    const { mintDeposit, getBalance, resolvePhysics } = await import('../economy.js');
    const physics = await resolvePhysics(agent.dir, engine.worldDir);
    const tokenPerDollar = physics?.economy.tokenPerDollar ?? 100;
    const treasurySharePct = physics?.economy.treasurySharePct ?? 10;
    const result = await mintDeposit(
      engine.worldDir, agentId, agent.dir, amountUsd, tokenPerDollar, treasurySharePct,
      reason ?? `external deposit $${amountUsd}${paymentRef ? ` ref:${paymentRef}` : ''}`,
    );
    engine.registry.update(agentId, { tokenBalance: await getBalance(agent.dir) });
    res.json(ok(result));
  });

  app.get('/api/economy/history/:agentId', async (req, res) => {
    const engine = context.getEngine();
    const { getTransactionHistory } = await import('../snapshot.js');
    const limit = Number(req.query.limit) || 50;
    res.json(ok(await getTransactionHistory(engine.worldDir, req.params.agentId, limit)));
  });

}
