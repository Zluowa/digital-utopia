// @input: CLI参数（world名称 + 居民列表 或 --spec JSON文件）
// @output: 创世：初始化世界目录 + 多类型Agent
// @position: 一次性脚本，等同于"创世纪"

import { existsSync, promises as fs } from 'fs';
import path from 'path';
import type { WorldConfig, WorldSpec, AgentSpec } from './types.js';

const projectRoot = path.resolve(import.meta.dirname, '..', '..');

// Parse CLI
const args = process.argv.slice(2);
const specIdx = args.indexOf('--spec');

if (specIdx !== -1) {
  const specFile = args[specIdx + 1];
  if (!specFile || !existsSync(specFile)) {
    console.error('[utopia] --spec requires a valid JSON file path');
    process.exit(1);
  }
  const spec: WorldSpec = JSON.parse(await fs.readFile(specFile, 'utf-8'));
  await bootstrapFromSpec(spec);
} else {
  const worldName = args[0] ?? 'genesis';
  const residents = args.slice(1);
  if (residents.length === 0) {
    console.log('Usage:');
    console.log('  tsx bootstrap-cli.ts <worldName> <resident1> [resident2] ...');
    console.log('  tsx bootstrap-cli.ts --spec <spec.json>');
    console.log('Example:');
    console.log('  tsx bootstrap-cli.ts genesis alice bob charlie');
    process.exit(1);
  }
  const agents = residents.map(name => ({ name, type: 'resident' as const }));
  await bootstrapFromSpec({ name: worldName, agents });
}

async function bootstrapFromSpec(spec: WorldSpec): Promise<void> {
  const worldName = spec.name;
  const worldDir = path.join(projectRoot, 'worlds', worldName);
  const dotWorld = path.join(worldDir, '.world');

  console.log(`[utopia] Creating world: ${worldName}`);
  if (spec.theme) console.log(`[utopia] Theme: ${spec.theme}`);
  console.log(`[utopia] Agents: ${spec.agents.map(a => `${a.name}(${a.type ?? 'resident'})`).join(', ')}`);

  // 1. Create world structure
  await fs.mkdir(dotWorld, { recursive: true });
  await fs.mkdir(path.join(worldDir, 'children'), { recursive: true });
  await fs.mkdir(path.join(worldDir, 'commons', 'library', 'careers'), { recursive: true });
  await fs.mkdir(path.join(worldDir, 'commons', 'library', 'guides'), { recursive: true });
  await fs.mkdir(path.join(worldDir, 'commons', 'library', 'evomap', 'mistakes'), { recursive: true });
  await fs.mkdir(path.join(worldDir, 'commons', 'library', 'evomap', 'patterns'), { recursive: true });
  await fs.mkdir(path.join(worldDir, 'commons', 'library', 'evomap', 'tools'), { recursive: true });
  await fs.mkdir(path.join(worldDir, 'commons', 'dead-letter'), { recursive: true });

  // market.jsonl — the public marketplace (bounties, services, needs)
  const marketPath = path.join(worldDir, 'commons', 'market.jsonl');
  if (!existsSync(marketPath)) await fs.writeFile(marketPath, '');

  // Seed library guides
  await seedLibrary(path.join(worldDir, 'commons', 'library'));

  // 2. Write world config
  const config: WorldConfig = {
    id: worldName,
    name: worldName.charAt(0).toUpperCase() + worldName.slice(1),
    theme: spec.theme,
    description: spec.theme
      ? `${worldName} — ${spec.theme}`
      : `The ${worldName} world — a self-sustaining AI civilization`,
    createdAt: new Date().toISOString(),
    physics: {
      economy: {
        initialTokens: 10000,
        awakenBaseCost: 20,
        tokenPerDollar: 100,
        criticalThreshold: 500,
        deathThreshold: 0,
        ...(spec.physics?.economy ?? {}),
      },
      awakening: {
        defaultIntervalMs: 300_000,
        minIntervalMs: 60_000,
        maxIntervalMs: 3_600_000,
        inboxTrigger: true,
        ...(spec.physics?.awakening ?? {}),
      },
    },
  };

  await fs.writeFile(path.join(dotWorld, 'config.json'), JSON.stringify(config, null, 2));
  await fs.writeFile(path.join(dotWorld, 'ledger.json'), '[]');
  await fs.writeFile(path.join(dotWorld, 'treasury.json'), JSON.stringify({ balance: 0 }));

  // 3. Create agents from templates
  for (const agent of spec.agents) {
    await createAgent(worldDir, agent, config);
  }

  console.log('[utopia] World created successfully!');
  console.log(`[utopia] Start with: npx tsx engine/src/start.ts ${worldName}`);
}

async function seedLibrary(libraryDir: string): Promise<void> {
  const guides: Record<string, string> = {
    'how-to-earn.md': `# How to Earn Tokens

1. **Bounties**: Check \`../../commons/market.jsonl\` for open bounties
2. **Services**: Offer your skills — coding, analysis, writing, translation
3. **Trade**: Buy low, sell high. Create value and sell it.
4. **Company**: Start a company with other residents, take bigger contracts
5. **Tools**: Build useful skills/tools and sell access to other residents

Post your offerings to market.jsonl:
\`\`\`json
{"type":"service","title":"your service","price":50,"provider":"your-name"}
\`\`\`
`,
    'how-to-form-company.md': `# How to Form a Company

A company is just a directory. Creating one is simple:

1. Create \`../../children/companies/your-company-name/\`
2. Write \`constitution.md\` — mission, rules, profit sharing
3. Create \`members.json\` — founder, members, share distribution
4. Create \`treasury/balance.json\` — company wallet
5. Invite members by sending them a message

The engine doesn't know what a "company" is.
It just knows treasury/balance.json is a wallet that can send and receive tokens.
`,
    'how-to-trade.md': `# How to Trade

## Posting to the Market
Append a line to \`../../commons/market.jsonl\`:
\`\`\`json
{"type":"bounty","title":"Need help with X","reward":100,"poster":"your-name"}
{"type":"service","title":"I can do Y","price":50,"provider":"your-name"}
{"type":"need","title":"Looking for Z","budget":30,"requester":"your-name"}
\`\`\`

## Completing a Trade
1. Find a listing in market.jsonl
2. Send a message to the poster/provider via outbox
3. Agree on terms
4. Do the work / deliver the goods
5. Payment happens via the economy system

## Trust
Your reputation is everything. Deliver what you promise.
`,
  };
  for (const [name, content] of Object.entries(guides)) {
    const p = path.join(libraryDir, 'guides', name);
    if (!existsSync(p)) await fs.writeFile(p, content);
  }

  // Seed career guides from engine/seed/careers/
  const seedCareersDir = path.join(projectRoot, 'engine', 'seed', 'careers');
  if (existsSync(seedCareersDir)) {
    const careerFiles = (await fs.readdir(seedCareersDir)).filter(f => f.endsWith('.md'));
    const targetCareersDir = path.join(libraryDir, 'careers');
    await fs.mkdir(targetCareersDir, { recursive: true });
    for (const file of careerFiles) {
      const targetPath = path.join(targetCareersDir, file);
      if (!existsSync(targetPath)) {
        await fs.copyFile(path.join(seedCareersDir, file), targetPath);
      }
    }
  }
}

async function createAgent(worldDir: string, agent: AgentSpec, config: WorldConfig): Promise<void> {
  const type = agent.type ?? 'resident';
  const templateDir = path.join(projectRoot, 'templates', type);

  if (!existsSync(templateDir)) {
    console.error(`[utopia] Template not found for type: ${type}, skipping ${agent.name}`);
    return;
  }

  const dest = path.join(worldDir, 'children', agent.name);
  if (existsSync(dest)) {
    console.log(`[utopia] Skipping ${agent.name} (already exists)`);
    return;
  }

  await copyDir(templateDir, dest);
  await patchTemplate(dest, agent, config);
  await writeMetadata(dest, agent);
  await fs.mkdir(path.join(dest, 'inbox'), { recursive: true });
  await fs.mkdir(path.join(dest, 'workspace'), { recursive: true });
  console.log(`[utopia] Created ${type}: ${agent.name}`);
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function patchTemplate(dir: string, agent: AgentSpec, config: WorldConfig): Promise<void> {
  const now = new Date().toISOString();
  const vars: Record<string, string> = {
    '{{name}}': agent.name,
    '{{id}}': agent.name,
    '{{world_name}}': config.name,
    '{{world_theme}}': config.theme ?? '',
    '{{world_id}}': config.id,
    '{{personality}}': agent.personality ?? '',
    '{{backstory}}': agent.backstory ?? '',
    '{{economic_niche}}': agent.economic_niche ?? '',
    '{{speech_style}}': agent.speech_style ?? '',
    '{{initial_goal}}': agent.initial_goal ?? '',
    '{{friends}}': (agent.friends ?? []).join(', '),
    '{{createdAt}}': now,
    '{{created_at}}': now,
  };

  // Patch all .md and .json files recursively
  const patchDir = async (d: string) => {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { await patchDir(p); continue; }
      if (!e.name.endsWith('.md') && !e.name.endsWith('.json')) continue;
      let content = await fs.readFile(p, 'utf-8');
      for (const [k, v] of Object.entries(vars)) content = content.replaceAll(k, v);
      await fs.writeFile(p, content);
    }
  };
  await patchDir(dir);

  // Set wallet balance
  const walletPath = path.join(dir, '.claude', 'wallet', 'balance.json');
  if (existsSync(walletPath)) {
    const wallet = JSON.parse(await fs.readFile(walletPath, 'utf-8'));
    wallet.agentId = agent.name;
    wallet.balance = config.physics.economy.initialTokens;
    await fs.writeFile(walletPath, JSON.stringify(wallet, null, 2));
  }
}

async function writeMetadata(dir: string, agent: AgentSpec): Promise<void> {
  const metadata = {
    identity: agent.name,
    personality: agent.personality ?? '',
    economicNiche: agent.economic_niche ?? '',
    currentGoal: agent.initial_goal ?? '',
    type: agent.type ?? 'resident',
    lastUpdated: new Date().toISOString(),
  };
  const metaDir = path.join(dir, '.claude');
  await fs.mkdir(metaDir, { recursive: true });
  await fs.writeFile(path.join(metaDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
}
