// vite.config.ts
// @input: engine API on port 4000, shared/ schemas
// @output: dev server on port 3000, proxies /api + /v1 to engine
// @position: frontend build config + dev proxy

// Kill system proxy for local dev — prevents http-proxy from routing
// localhost traffic through HTTP_PROXY (e.g. clash on :7890)
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;

import { createLogger, defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import http from "http";
import pkg from "./package.json";

const noProxyAgent = new http.Agent({ noProxy: true });

function createFilteredLogger() {
  const logger = createLogger();
  const originalError = logger.error.bind(logger);
  let lastRestartLog = 0;

  logger.error = (msg, options) => {
    const isProxyError =
      msg.includes("ws proxy socket error") ||
      msg.includes("ws proxy error:") ||
      msg.includes("http proxy error:");
    if (isProxyError) {
      const now = Date.now();
      if (now - lastRestartLog > 2000) {
        logger.warn("Proxy connection closed, auto-reconnecting...");
        lastRestartLog = now;
      }
      return;
    }
    originalError(msg, options);
  };
  return logger;
}

function executorSchemasPlugin(): Plugin {
  const VIRTUAL_ID = 'virtual:executor-schemas';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;
  return {
    name: 'executor-schemas-plugin',
    resolveId(id) { return id === VIRTUAL_ID ? RESOLVED_ID : null; },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const dir = path.resolve(__dirname, '../shared/schemas');
      const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : [];
      const imports = files.map((f, i) => `import __s${i} from "shared/schemas/${f}";`);
      const entries = files.map((f, i) => `  "${f.replace(/\.json$/, '').toUpperCase()}": __s${i}`);
      return `${imports.join('\n')}\nexport const schemas = {\n${entries.join(',\n')}\n};\nexport default schemas;\n`;
    },
  };
}

export default defineConfig({
  customLogger: createFilteredLogger(),
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    executorSchemasPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      shared: path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: true,
    port: parseInt(process.env.FRONTEND_PORT || '3000'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.DU_ENGINE_PORT || '4000'}`,
        changeOrigin: true,
        ws: true,
        agent: noProxyAgent,
      },
      '/v1': {
        target: `http://localhost:${process.env.DU_ENGINE_PORT || '4000'}`,
        changeOrigin: true,
        ws: true,
        secure: false,
        agent: noProxyAgent,
      },
      '/ws': {
        target: `ws://localhost:${process.env.DU_ENGINE_PORT || '4000'}`,
        changeOrigin: true,
        ws: true,
        agent: noProxyAgent,
      },
    },
    open: false,
  },
  build: { sourcemap: true },
});
