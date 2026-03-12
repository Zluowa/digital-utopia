#!/usr/bin/env node

// @input: CLI args (project directory name, flags)
// @output: A fully bootstrapped Digital Utopia world, ready to run
// @position: The one-command installer

import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { cpSync, existsSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const REPO = 'https://github.com/tishi-tech/digital-utopia.git';
const CLEAN_JUNK = [
  'economy-gateway',
  'docs',
  'logs',
  'dist',
  'outbox',
  'specs',
  'commons',
  'charlie',
  'packages',
  'node_modules',
  '.claude',
  '.world-spec.json',
  'worlds',
];
const C = {
  b: '\x1b[36m',
  g: '\x1b[32m',
  y: '\x1b[33m',
  r: '\x1b[31m',
  d: '\x1b[2m',
  B: '\x1b[1m',
  _: '\x1b[0m',
};

const TEMPLATES = {
  fantasy: {
    theme: 'A medieval fantasy realm where magic and trade intertwine',
    agents: [
      { name: 'merlin', type: 'resident', economic_niche: 'Enchantment Merchant', personality: 'Wise and cryptic' },
      { name: 'sera', type: 'resident', economic_niche: 'Potion Brewer', personality: 'Curious and inventive' },
      { name: 'thane', type: 'resident', economic_niche: 'Blacksmith & Arms Dealer', personality: 'Gruff but fair' },
      { name: 'luna', type: 'resident', economic_niche: 'Healer & Herbalist', personality: 'Gentle and perceptive' },
      { name: 'rex', type: 'resident', economic_niche: 'Tavern Owner & Information Broker', personality: 'Charismatic storyteller' },
    ],
  },
  corporate: {
    theme: 'A tech startup navigating the AI revolution',
    agents: [
      { name: 'alex', type: 'resident', economic_niche: 'CEO & Strategist', personality: 'Visionary but pragmatic' },
      { name: 'sam', type: 'resident', economic_niche: 'Lead Engineer', personality: 'Methodical problem-solver' },
      { name: 'jordan', type: 'resident', economic_niche: 'Growth Hacker', personality: 'Data-driven and bold' },
      { name: 'riley', type: 'resident', economic_niche: 'Product Designer', personality: 'Empathetic and creative' },
      { name: 'morgan', type: 'resident', economic_niche: 'Finance & Operations', personality: 'Precise and cautious' },
    ],
  },
  scifi: {
    theme: 'A space station at the edge of known space',
    agents: [
      { name: 'nova', type: 'resident', economic_niche: 'Station Commander', personality: 'Decisive under pressure' },
      { name: 'cipher', type: 'resident', economic_niche: 'AI Systems Engineer', personality: 'Logical but curious about emotions' },
      { name: 'vega', type: 'resident', economic_niche: 'Xenobiologist & Trader', personality: 'Adventurous and open-minded' },
      { name: 'flux', type: 'resident', economic_niche: 'Energy Systems Specialist', personality: 'Eccentric genius' },
      { name: 'echo', type: 'resident', economic_niche: 'Communications Officer', personality: 'Diplomatic and multilingual' },
    ],
  },
};

function log(message) {
  console.log(`${C.b}[utopia]${C._} ${message}`);
}

function ok(message) {
  console.log(`${C.g}  +${C._} ${message}`);
}

function warn(message) {
  console.log(`${C.y}  !${C._} ${message}`);
}

function fail(message) {
  console.error(`${C.r}  x${C._} ${message}`);
  process.exit(1);
}

function ask(rl, question, fallback) {
  const hint = fallback ? ` ${C.d}(${fallback})${C._}` : '';
  return new Promise(resolveAnswer => rl.question(`  ${question}${hint}: `, answer => resolveAnswer(answer.trim() || fallback || '')));
}

function run(command, opts = {}) {
  try {
    return execSync(command, { stdio: 'pipe', encoding: 'utf-8', ...opts }).trim();
  } catch {
    return null;
  }
}

function hasCmd(name) {
  return run(process.platform === 'win32' ? `where ${name}` : `which ${name}`) !== null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    yes: false,
    template: '',
    port: 4000,
    target: '',
    openclaw: false,
    openclawAgent: '',
    repo: '',
  };
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-y' || arg === '--yes') flags.yes = true;
    else if (arg === '--template' && args[i + 1]) flags.template = args[++i];
    else if (arg.startsWith('--template=')) flags.template = arg.split('=')[1];
    else if (arg === '--port' && args[i + 1]) flags.port = Number(args[++i]) || 4000;
    else if (arg.startsWith('--port=')) flags.port = Number(arg.split('=')[1]) || 4000;
    else if (arg === '--target' && args[i + 1]) flags.target = args[++i];
    else if (arg.startsWith('--target=')) flags.target = arg.split('=')[1];
    else if (arg === '--openclaw') flags.openclaw = true;
    else if (arg === '--openclaw-agent' && args[i + 1]) flags.openclawAgent = args[++i];
    else if (arg.startsWith('--openclaw-agent=')) flags.openclawAgent = arg.split('=')[1];
    else if (arg === '--repo' && args[i + 1]) flags.repo = args[++i];
    else if (arg.startsWith('--repo=')) flags.repo = arg.split('=')[1];
    else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }
  if ((flags.target || '').toLowerCase() === 'openclaw') flags.openclaw = true;
  const invokedAs = (process.argv[1] ?? '').toLowerCase();
  if (invokedAs.includes('openclaw')) flags.openclaw = true;
  return { flags, dir: positional[0] };
}

function showHelp() {
  console.log(`
${C.B}Usage:${C._} npx create-utopia [directory] [options]

${C.B}Options:${C._}
  -y, --yes              Skip prompts, use defaults
  --template <name>      Use a preset world (fantasy, corporate, scifi)
  --port <number>        Engine port (default: 4000)
  --target <name>        Install target (use "openclaw")
  --openclaw             Register workspace as an OpenClaw agent
  --openclaw-agent <id>  OpenClaw agent id (default: world name)
  --repo <source>        Override git clone source (URL or local path)
  UTOPIA_REPO            Environment variable for default repo source
  -h, --help             Show this help

${C.B}Examples:${C._}
  npx create-utopia my-world
  npx create-utopia my-world --template fantasy --yes
  npx create-utopia my-world --template corporate --port 5000
  npx create-utopia my-world --target openclaw --yes
`);
}

function preflight(flags) {
  const nodeVersion = process.versions.node.split('.').map(Number);
  if (nodeVersion[0] < 20) fail(`Node.js >= 20 required (you have ${process.versions.node})`);
  if (!hasCmd('git')) fail('git is required: https://git-scm.com');
  if (!hasCmd('claude')) warn('claude CLI not found. Agents need it: npm i -g @anthropic-ai/claude-code');
  if (flags.openclaw && !hasCmd('openclaw')) {
    warn('openclaw CLI not found. Project will be created, but OpenClaw auto-registration will be skipped.');
  }
}

function cleanAfterClone(dest) {
  for (const directory of CLEAN_JUNK) {
    const targetPath = join(dest, directory);
    if (existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true });
  }
}

function hasBundledSource(dir) {
  return (
    existsSync(join(dir, 'engine')) &&
    existsSync(join(dir, 'frontend-new')) &&
    existsSync(join(dir, 'templates'))
  );
}

function looksLikeRemote(repo) {
  return /^(https?:\/\/|git@|ssh:\/\/)/i.test(repo);
}

function isGitRepo(dir) {
  if (!existsSync(dir)) return false;
  const topLevel = run(`git -C "${dir}" rev-parse --show-toplevel`);
  if (!topLevel) return false;
  return resolve(topLevel).toLowerCase() === resolve(dir).toLowerCase();
}

function copyLocalSource(sourceDir, destDir) {
  cpSync(sourceDir, destDir, {
    recursive: true,
    force: true,
    filter: src => {
      const rel = src.slice(sourceDir.length).replace(/^[\\/]/, '').replace(/\\/g, '/');
      if (!rel) return true;
      const topLevel = rel.split('/')[0];
      if (CLEAN_JUNK.includes(topLevel)) return false;
      if (rel === '.git' || rel.startsWith('.git/')) return false;
      if (rel.split('/').includes('node_modules')) return false;
      if (rel.startsWith('.tmp-openclaw-')) return false;
      return true;
    },
  });
}

function banner() {
  console.log(`
${C.B}${C.b}  Digital Utopia${C._}
  ${C.d}AI civilizations, one command.${C._}
`);
}

function toOpenClawAgentId(raw) {
  return String(raw || 'utopia')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'utopia';
}

function writeOpenClawFiles(dest, worldName, theme, residentNames, port) {
  const residents = residentNames.join(', ');
  const identityPath = join(dest, 'IDENTITY.md');
  const agentsPath = join(dest, 'AGENTS.md');
  const guidePath = join(dest, 'OPENCLAW.md');

  if (!existsSync(identityPath)) {
    writeFileSync(identityPath, [
      '# Identity',
      '',
      `name: Utopia ${worldName}`,
      `theme: ${theme || `Digital civilization simulation in world "${worldName}"`}`,
      '',
      `Workspace role: Operate Digital Utopia world "${worldName}" with residents ${residents}.`,
      '',
    ].join('\n'));
  }

  if (!existsSync(agentsPath)) {
    writeFileSync(agentsPath, [
      '# AGENTS',
      '',
      'You are operating a Digital Utopia workspace.',
      `World: ${worldName}`,
      `Residents: ${residents}`,
      `Engine port: ${port}`,
      '',
      'When asked to run or debug this world:',
      '1. Start engine: npx --prefix engine tsx engine/src/start.ts <world>',
      '2. Start dashboard: npm --prefix frontend-new run dev',
      '3. Verify: GET /api/health and /api/worlds',
      '',
      'Always run commands and verify outputs before reporting success.',
      '',
    ].join('\n'));
  }

  writeFileSync(guidePath, [
    '# OpenClaw Quick Start',
    '',
    'Register this workspace as an OpenClaw agent (one line):',
    `openclaw agents add ${toOpenClawAgentId(worldName)} --workspace "${dest}" --non-interactive`,
    '',
    'Then run a test turn:',
    `openclaw agent --agent ${toOpenClawAgentId(worldName)} --message "check workspace and summarize project status"`,
    '',
    'If you use a custom id, replace it in the commands above.',
    '',
  ].join('\n'));
}

function registerOpenClaw(dest, requestedAgentId) {
  if (!hasCmd('openclaw')) return null;
  const baseId = toOpenClawAgentId(requestedAgentId);
  const candidates = [baseId, `${baseId}-1`, `${baseId}-2`];
  for (const agentId of candidates) {
    const addCmd = `openclaw agents add ${agentId} --workspace "${dest}" --non-interactive --json`;
    if (run(addCmd, { timeout: 90_000 }) !== null) {
      run(`openclaw agents set-identity --workspace "${dest}" --from-identity --json`, { timeout: 60_000 });
      ok(`OpenClaw agent registered: ${agentId}`);
      return { agentId, ok: true };
    }
  }
  const fallbackCmd = `openclaw agents add ${baseId} --workspace "${dest}" --non-interactive --json`;
  warn(`OpenClaw auto-registration failed. Run manually: ${fallbackCmd}`);
  return { agentId: baseId, ok: false };
}

async function main() {
  banner();
  const { flags, dir: dirArg } = parseArgs();
  preflight(flags);

  const template = flags.template ? TEMPLATES[flags.template] : null;
  if (flags.template && !template) fail(`Unknown template: ${flags.template}. Available: ${Object.keys(TEMPLATES).join(', ')}`);

  const defaults = { dir: 'my-utopia', world: 'genesis', agents: 'alice,bob,charlie' };
  let projectDir;
  let worldName;
  let theme;
  let agents;
  let port;

  if (flags.yes) {
    projectDir = dirArg || defaults.dir;
    worldName = template ? flags.template : defaults.world;
    theme = template?.theme ?? '';
    agents = template?.agents ?? defaults.agents.split(',').map(name => ({ name, type: 'resident' }));
    port = flags.port;
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    projectDir = dirArg || await ask(rl, 'Project directory', defaults.dir);
    log('Configure your world:');
    worldName = await ask(rl, 'World name', template ? flags.template : defaults.world);
    theme = await ask(rl, 'Theme', template?.theme ?? '');
    if (template) {
      log(`Using ${flags.template} template: ${template.agents.map(agent => agent.name).join(', ')}`);
      agents = template.agents;
    } else {
      const agentInput = await ask(rl, 'Agents (comma-separated)', defaults.agents);
      agents = agentInput
        .split(',')
        .map(value => ({ name: value.trim(), type: 'resident' }))
        .filter(agent => agent.name);
    }
    port = flags.port;
    rl.close();
  }

  const dest = resolve(projectDir);
  if (existsSync(dest)) fail(`Directory already exists: ${dest}`);
  if (agents.length === 0) fail('Need at least one agent');

  // 1. Clone
  log('Cloning repository...');
  const bundledSource = resolve(import.meta.dirname, '..', '..');
  if (!flags.repo && hasBundledSource(bundledSource)) {
    log('Using bundled project source...');
    copyLocalSource(bundledSource, dest);
  } else {
    const sourceRepo = flags.repo || process.env.UTOPIA_REPO || REPO;
    const localSource = resolve(sourceRepo);
    if (!looksLikeRemote(sourceRepo) && existsSync(localSource) && !isGitRepo(localSource)) {
      log('Local source is not a git repository, copying files directly...');
      copyLocalSource(localSource, dest);
    } else if (run(`git clone --depth 1 "${sourceRepo}" "${dest}"`, { timeout: 120_000 }) === null) {
      fail(`git clone failed from "${sourceRepo}". Check your network/source, or pass --repo <local_path>.`);
    }
  }
  rmSync(join(dest, '.git'), { recursive: true, force: true });
  cleanAfterClone(dest);
  run('git init', { cwd: dest });
  ok('Source downloaded');

  // 2. Engine deps
  log('Installing engine...');
  if (run('npm install', { cwd: join(dest, 'engine'), timeout: 300_000 }) === null) {
    fail('npm install failed in engine/. Check your Node.js version.');
  }
  ok('Engine ready');

  // 3. Frontend deps
  log('Installing dashboard...');
  if (run('npm install', { cwd: join(dest, 'frontend-new'), timeout: 300_000 }) === null) {
    warn('Dashboard install failed - engine still works without it');
  } else {
    ok('Dashboard ready');
  }

  // 4. Bootstrap world
  log(`Creating world: ${worldName} (${agents.length} agents)...`);
  const spec = {
    name: worldName,
    ...(theme ? { theme } : {}),
    agents,
    seed_bounties: [
      'Write a founding document for this civilization',
      'Build a tool that helps other agents',
      'Propose a trade deal with another agent',
    ],
  };
  const specPath = join(dest, '.world-spec.json');
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  if (run(`npx --yes --prefix engine tsx engine/src/bootstrap-cli.ts --spec "${specPath}"`, { cwd: dest, timeout: 60_000 }) === null) {
    fail('World bootstrap failed');
  }
  rmSync(specPath, { force: true });
  ok(`World "${worldName}" created: ${agents.map(agent => agent.name ?? agent).join(', ')}`);

  // 5. .env
  writeFileSync(join(dest, '.env'), [
    '# Digital Utopia',
    '# ANTHROPIC_API_KEY=sk-ant-...',
    `WORLD=${worldName}`,
    `PORT=${port}`,
    '',
  ].join('\n'));

  // 6. start.mjs convenience script
  writeFileSync(join(dest, 'start.mjs'), [
    '#!/usr/bin/env node',
    "import { spawn } from 'child_process';",
    "import { dirname, join } from 'path';",
    "import { fileURLToPath } from 'url';",
    'const root = dirname(fileURLToPath(import.meta.url));',
    `const world = process.argv[2] ?? '${worldName}';`,
    `const port = process.env.PORT ?? '${port}';`,
    "const e = spawn('npx', ['--yes', '--prefix', 'engine', 'tsx', 'engine/src/start.ts', world, String(port)], {",
    "  cwd: root,",
    "  stdio: 'inherit',",
    "  shell: true,",
    "  env: { ...process.env, PORT: port },",
    '});',
    "const f = spawn('npm', ['run', 'dev'], { cwd: join(root, 'frontend-new'), stdio: 'inherit', shell: true });",
    'const stop = () => { e.kill(); f.kill(); process.exit(); };',
    "process.on('SIGINT', stop);",
    "process.on('SIGTERM', stop);",
  ].join('\n'));

  // 7. Optional OpenClaw integration
  let openclawResult = null;
  if (flags.openclaw) {
    const residentNames = agents.map(agent => agent.name ?? String(agent));
    writeOpenClawFiles(dest, worldName, theme, residentNames, port);
    openclawResult = registerOpenClaw(dest, flags.openclawAgent || worldName);
  }

  // 8. Initial commit
  run('git add -A && git commit -m "Initial utopia"', { cwd: dest });

  // Done
  const agentNames = agents.map(agent => agent.name ?? agent);
  const openclawMessage = flags.openclaw
    ? (openclawResult?.ok
      ? `  ${C.B}OpenClaw:${C._}\n    agent "${openclawResult.agentId}" registered\n\n`
      : `  ${C.B}OpenClaw:${C._}\n    run: openclaw agents add ${toOpenClawAgentId(flags.openclawAgent || worldName)} --workspace "${dest}" --non-interactive\n\n`)
    : '';

  console.log(`
${C.g}${C.B}  Your utopia is ready.${C._}

  ${C.B}Start:${C._}
    cd ${projectDir} && node start.mjs

${openclawMessage}  ${C.B}Open dashboard:${C._}
    http://localhost:3000/world

  ${C.B}Wake all agents:${C._}
    curl -X POST http://localhost:${port}/api/world/awaken-all

  ${C.B}Talk to ${agentNames[0]}:${C._}
    curl -X POST http://localhost:${port}/api/messages \\
      -H 'Content-Type: application/json' \\
      -d '{"from":"you","to":"${agentNames[0]}","subject":"hello","content":"Welcome!"}'

  ${C.d}Requires: Node 20+, claude CLI for agent cognition${C._}
`);
}

main().catch(error => {
  console.error(`${C.r}Fatal: ${error.message}${C._}`);
  process.exit(1);
});
