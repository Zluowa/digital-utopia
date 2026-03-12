// @input: Engine instance
// @output: DU native REST API + WebSocket
// @position: Dashboard entrypoint

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Engine } from './index.js';
import { err } from './types.js';
import type { RouteContext } from './routes/world.js';
import { registerAgentRoutes } from './routes/agents.js';
import { registerEconomyRoutes } from './routes/economy.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerWorldRoutes } from './routes/world.js';

const DU_API_KEY = process.env.DU_API_KEY;

// ── DU native WebSocket ──────────────────────────────────

async function handleDUNativeWs(ws: WebSocket, engine: Engine): Promise<void> {
  ws.send(JSON.stringify({ type: 'snapshot', data: await engine.snapshot() }));
  ws.send(JSON.stringify({ type: 'timeline', data: engine.getTimeline(500) }));
  const onEvent = (ev: unknown) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'event', data: ev }));
  };
  engine.on('event', onEvent);
  ws.on('close', () => engine.off('event', onEvent));
}

// ── HTTP server ──────────────────────────────────────────

export function startServer(initialEngine: Engine, port: number): void {
  let engine = initialEngine;
  const app = express();
  app.use(cors());
  app.use(express.json());

  if (DU_API_KEY) {
    app.use((req, res, next) => {
      if (req.path === '/api/health') return next();
      if (req.header('X-DU-API-Key') === DU_API_KEY) return next();
      res.status(401).json({ ok: false, error: 'unauthorized' });
    });
  }

  const routeContext: RouteContext = {
    getEngine: () => engine,
    setEngine: (next) => { engine = next; },
  };

  registerAgentRoutes(app, routeContext);
  registerEconomyRoutes(app, routeContext);
  registerMessageRoutes(app, routeContext);
  registerWorldRoutes(app, routeContext);

  app.all('/api/*', (req, res) => {
    console.warn(`[404] ${req.method} ${req.path}`);
    res.status(404).json(err(`API route not found: ${req.method} ${req.path}`));
  });

  const server = createServer(app);

  // WebSocket: only DU-native /ws
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => void handleDUNativeWs(ws, engine));
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => console.log(`[utopia] Dashboard: http://localhost:${port}`));
}
