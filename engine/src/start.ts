// @input: CLI参数（world名称、端口）
// @output: 启动Engine + Dashboard
// @position: 应用入口，等同于"宇宙大爆炸按钮"

import { startAll } from './index.js';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

// Load .env from ancestor directories (D:\Moss\.env) — no dotenv dependency
function loadEnvFile(): void {
  let dir = path.resolve(import.meta.dirname, '..', '..');
  for (let i = 0; i < 5; i++) {
    const envPath = path.join(dir, '.env');
    if (existsSync(envPath)) {
      for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
      }
      return;
    }
    dir = path.dirname(dir);
  }
}
loadEnvFile();

const worldName = process.argv[2] ?? 'genesis';
const port = parseInt(process.argv[3] ?? '4000', 10);
const projectRoot = path.resolve(import.meta.dirname, '..', '..');

console.log(`[utopia] Starting world: ${worldName} on port ${port}`);

const engine = await startAll(projectRoot, worldName, port);

process.on('SIGINT', () => {
  console.log('\n[utopia] Shutting down...');
  engine.shutdown();
  process.exit(0);
});
