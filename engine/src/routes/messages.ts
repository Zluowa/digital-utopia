// @input: Engine sendMessage, GM inbox
// @output: Message sending API routes
// @position: 消息发送 API 层

import type { Express } from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import { existsSync, promises as fs } from 'fs';
import { ok, err } from '../types.js';
import type { RouteContext } from './world.js';

export function registerMessageRoutes(
  app: Express,
  context: Pick<RouteContext, 'getEngine'>,
): void {
  app.post('/api/messages', async (req, res) => {
    const engine = context.getEngine();
    const { from, to, subject, content, body, type, ttl, ack, replyTo, priority } = req.body ?? {};
    if (!to || !subject) return res.json(err('missing to/subject'));
    if (!engine.registry.get(to)) return res.json(err(`agent "${to}" not found`));
    await engine.sendMessage({
      from: from || 'moss-gm',
      to,
      subject,
      content: content || body || '',
      priority: priority || 'normal',
      ...(type && { type }),
      ...(typeof ttl === 'number' && { ttl }),
      ...(typeof ack === 'boolean' && { ack }),
      ...(replyTo && { replyTo }),
    });
    res.json(ok({ sent: true, to }));
  });

  app.post('/api/gm/inbox', async (req, res) => {
    const engine = context.getEngine();
    const { from, subject, content, deliverable } = req.body ?? {};
    if (!from || !subject) return res.json(err('missing from/subject'));
    const id = await engine.sendToGm({
      from,
      to: 'moss-gm',
      subject,
      content: JSON.stringify({ message: content, deliverable }),
      priority: 'normal',
    });
    res.json(ok({ sent: true, id }));
  });

  app.get('/api/gm/inbox', async (_r, res) => {
    const engine = context.getEngine();
    res.json(ok(await engine.getGmMessages()));
  });

  app.post('/api/gm/inbox/:id/processed', async (req, res) => {
    const engine = context.getEngine();
    const processed = await engine.markGmProcessed(req.params.id);
    res.json(processed ? ok({ processed: true }) : err('message not found'));
  });

  // ── External bridge: escalation + reply ──────────────────

  app.post('/api/escalate', async (req, res) => {
    const engine = context.getEngine();
    const { from, subject, body, priority } = req.body ?? {};
    if (!subject || !body) return res.json(err('missing subject/body'));
    const id = randomUUID();
    const chatId = process.env.DU_HELIOS_FEISHU_CHAT;
    if (!chatId) return res.json(err('DU_HELIOS_FEISHU_CHAT not configured'));
    const text = `🚨 升级请求\n升级ID: ${id}\n来自: ${from || 'unknown'}\n优先级: ${priority || 'normal'}\n\n${subject}\n\n${body}`;
    const cli = path.join(engine.projectRoot, 'services', 'moss-feishu', 'cli', 'feishu-send.js');
    const { execFile } = await import('child_process');
    execFile('node', [cli, 'text', chatId, text], (sendErr) => {
      if (sendErr) console.error('[escalate] Feishu send failed:', sendErr.message);
    });
    res.json(ok({ escalationId: id, sent: true }));
  });

  app.post('/api/moss/reply', async (req, res) => {
    const engine = context.getEngine();
    const { escalationId, reply } = req.body ?? {};
    if (!reply) return res.json(err('missing reply'));
    await engine.sendMessage({
      from: 'helios',
      to: 'moss',
      subject: `escalation-reply${escalationId ? `: ${escalationId}` : ''}`,
      content: reply,
      priority: 'urgent',
    });
    res.json(ok({ delivered: true, escalationId }));
  });

  // Legacy: bulletin-board claim reader (resident-managed in v2)
  app.get('/api/world/bounty/:id/claims', async (req, res) => {
    const engine = context.getEngine();
    const bbDir = path.join(engine.worldDir, 'commons', 'bulletin-board');
    if (!existsSync(bbDir)) return res.json(ok([]));
    const files = await fs.readdir(bbDir);
    const claims: object[] = [];
    for (const f of files) {
      if (!f.startsWith('claim-') || !f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(await fs.readFile(path.join(bbDir, f), 'utf-8'));
        if (data.bountyId === req.params.id || f.includes(req.params.id)) {
          claims.push({ file: f, ...data });
        }
      } catch {}
    }
    res.json(ok(claims));
  });
}
