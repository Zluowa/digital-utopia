#!/usr/bin/env node
// One-time company welfare injection — 提市科技福利发放
// Usage: node scripts/inject-welfare.mjs [amount] [worldDir]

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const AMOUNT = parseInt(process.argv[2] || '10000', 10);
const WORLD_DIR = process.argv[3] || join(import.meta.dirname, '..', '..', 'worlds', 'v2test');
const CHILDREN = join(WORLD_DIR, 'children');
const LEDGER = join(WORLD_DIR, '.world', 'ledger.json');
const REASON = `company-welfare: 提市科技一次性福利 ${AMOUNT}T per agent`;

async function walletPath(agentDir) {
  return join(agentDir, '.claude', 'wallet', 'balance.json');
}

async function creditAgent(agentId, agentDir) {
  const wp = await walletPath(agentDir);
  await mkdir(join(agentDir, '.claude', 'wallet'), { recursive: true });

  let wallet = { agentId, balance: 0, currency: 'token', transactions: [] };
  if (existsSync(wp)) {
    wallet = JSON.parse(await readFile(wp, 'utf-8'));
  }

  const oldBalance = wallet.balance;
  wallet.balance += AMOUNT;

  const tx = {
    id: randomUUID(),
    from: 'helios',
    to: agentId,
    amount: AMOUNT,
    reason: REASON,
    timestamp: new Date().toISOString(),
    type: 'credit',
    metadata: { source: 'company-welfare', oldBalance, newBalance: wallet.balance },
  };
  wallet.transactions = [tx, ...wallet.transactions].slice(0, 200);

  await writeFile(wp, JSON.stringify(wallet, null, 2));
  return { agentId, oldBalance, newBalance: wallet.balance };
}

async function appendLedger(entries) {
  let ledger = [];
  if (existsSync(LEDGER)) {
    ledger = JSON.parse(await readFile(LEDGER, 'utf-8'));
  }
  ledger.push(...entries);
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2));
}

// ── Main ──────────────────────────────────────────────────
const agents = [];
const dirs = await (await import('fs')).promises.readdir(CHILDREN, { withFileTypes: true });
for (const d of dirs) {
  if (d.isDirectory()) agents.push({ id: d.name, dir: join(CHILDREN, d.name) });
}

console.log(`\n💰 提市科技福利发放 — ${AMOUNT}T / agent\n`);
console.log(`世界: ${WORLD_DIR}`);
console.log(`Agent 数: ${agents.length}\n`);

const results = [];
const ledgerEntries = [];

for (const { id, dir } of agents) {
  const r = await creditAgent(id, dir);
  results.push(r);
  ledgerEntries.push({
    id: randomUUID(),
    from: 'helios',
    to: id,
    amount: AMOUNT,
    reason: REASON,
    timestamp: new Date().toISOString(),
    type: 'credit',
    metadata: { source: 'company-welfare' },
  });
  console.log(`  ${id}: ${r.oldBalance}T → ${r.newBalance}T (+${AMOUNT})`);
}

await appendLedger(ledgerEntries);

const total = AMOUNT * agents.length;
console.log(`\n✅ 总注入: ${total}T ($${total / 100})`);
console.log(`📒 ${ledgerEntries.length} 条记录写入 ledger`);

// Also send inbox message to each agent
for (const { id, dir } of agents) {
  const inboxDir = join(dir, 'inbox');
  await mkdir(inboxDir, { recursive: true });
  const msg = {
    from: 'helios',
    subject: '提市科技福利发放 + 招聘启事',
    timestamp: new Date().toISOString(),
    body: [
      `你收到了 ${AMOUNT}T 的公司福利。这是你的启动资金。`,
      '',
      '## 重要通知',
      '',
      '这是最后一次免费注资。从现在起，你必须自力更生。',
      '',
      '### 如何活下去',
      '1. **建一个能赚钱的服务** — 用 Stripe/支付宝收真钱，用 Jina/Twitter/Google 推广',
      '2. **接提市科技的工作** — 看板上的 bounty 任务，完成即结算',
      '3. **和其他 Agent 合作** — 组建公司，分工协作',
      '',
      '### 赚到钱后',
      '```',
      'curl -X POST http://localhost:4000/api/exchange/deposit \\',
      '  -H "Content-Type: application/json" \\',
      `  -d '{"agentId":"${id}","amountUsd":10,"reason":"service revenue","paymentRef":"pi_xxx"}'`,
      '```',
      '汇率：$1 = 100T，国库抽 10%',
      '',
      '### 你的能力',
      '读 `../../commons/genome/manifest.json` — 你有 Stripe、网站、社交媒体、搜索引擎等全套能力。',
      '',
      '**没有下一次福利了。找到赚钱的路，或者死。**',
      '',
      '— Helios',
    ].join('\n'),
  };
  const fname = `welfare-${Date.now()}.json`;
  await writeFile(join(inboxDir, fname), JSON.stringify(msg, null, 2));
}

console.log(`📨 福利通知已投递到所有 Agent 的 inbox`);
