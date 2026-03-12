// @input: worlds/<world>/children/<agent>/.claude/memory/categories/ (v1 BDI format)
// @output: worlds/<world>/children/<agent>/.claude/memory/MEMORY.md (v2 unified format)
// @position: one-time migration script — converts v1 agents to v2 memory layout

/**
 * Migrates agents from v1 BDI format to v2 unified MEMORY.md format.
 *
 * v1: .claude/memory/categories/{IDENTITY,GOALS,TASKS,HANDOFF,...}.md
 * v2: .claude/memory/MEMORY.md (single file, all content merged)
 *
 * After migration, categories/ is renamed to categories-v1-archive/ (no data loss).
 *
 * Usage:
 *   npx tsx engine/scripts/migrate-v1-to-v2.mts [world-name]
 *   npx tsx engine/scripts/migrate-v1-to-v2.mts genesis
 *   npx tsx engine/scripts/migrate-v1-to-v2.mts genesis --dry-run
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

// Files that define BDI state — merged in this order
const BDI_FILES = ['IDENTITY.md', 'GOALS.md', 'TASKS.md'];

// Extra files merged after BDI core (if present)
const EXTRA_FILES = ['HANDOFF.md', 'REFLECTIONS.md'];

interface MigrationResult {
  agent: string;
  status: 'migrated' | 'skipped' | 'already-v2' | 'error';
  reason?: string;
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function migrateAgent(agentDir: string, dryRun: boolean): Promise<MigrationResult> {
  const agentName = path.basename(agentDir);
  const memoryDir = path.join(agentDir, '.claude', 'memory');
  const categoriesDir = path.join(memoryDir, 'categories');
  const memoryFile = path.join(memoryDir, 'MEMORY.md');
  const archiveDir = path.join(memoryDir, 'categories-v1-archive');

  // Check if already v2 (has MEMORY.md, no categories/ with IDENTITY.md)
  const identityPath = path.join(categoriesDir, 'IDENTITY.md');
  const identityContent = await readFileIfExists(identityPath);
  if (!identityContent) {
    const hasMemoryFile = await readFileIfExists(memoryFile);
    if (hasMemoryFile) return { agent: agentName, status: 'already-v2' };
    return { agent: agentName, status: 'skipped', reason: 'no v1 categories/ and no MEMORY.md' };
  }

  // Build merged MEMORY.md content
  const sections: string[] = [];
  sections.push(`# ${agentName} — Memory\n`);
  sections.push(`> Migrated from v1 BDI format on ${new Date().toISOString()}\n`);

  for (const fileName of BDI_FILES) {
    const content = await readFileIfExists(path.join(categoriesDir, fileName));
    if (content) {
      const sectionName = fileName.replace('.md', '');
      sections.push(`\n---\n\n## ${sectionName}\n\n${content.trim()}\n`);
    }
  }

  // Merge extra files if they have meaningful content
  for (const fileName of EXTRA_FILES) {
    const content = await readFileIfExists(path.join(categoriesDir, fileName));
    if (content && content.trim().length > 20) {
      const sectionName = fileName.replace('.md', '');
      sections.push(`\n---\n\n## ${sectionName}\n\n${content.trim()}\n`);
    }
  }

  // Include any remaining files not already covered
  let allFiles: string[] = [];
  try {
    allFiles = await fs.readdir(categoriesDir);
  } catch {
    return { agent: agentName, status: 'error', reason: 'cannot read categories/' };
  }

  const coveredFiles = new Set([...BDI_FILES, ...EXTRA_FILES]);
  const extraCategoryFiles = allFiles.filter(
    (f) => f.endsWith('.md') && !coveredFiles.has(f),
  );

  for (const fileName of extraCategoryFiles) {
    const content = await readFileIfExists(path.join(categoriesDir, fileName));
    if (content && content.trim().length > 20) {
      const sectionName = fileName.replace('.md', '');
      sections.push(`\n---\n\n## ${sectionName}\n\n${content.trim()}\n`);
    }
  }

  const merged = sections.join('');

  if (dryRun) {
    console.log(`[DRY RUN] Would migrate ${agentName}:`);
    console.log(`  categories/ → categories-v1-archive/`);
    console.log(`  Write MEMORY.md (${merged.length} chars)`);
    return { agent: agentName, status: 'migrated' };
  }

  try {
    // Write MEMORY.md (create if missing)
    await fs.mkdir(memoryDir, { recursive: true });
    await fs.writeFile(memoryFile, merged, 'utf-8');

    // Archive categories/ → categories-v1-archive/
    await fs.rename(categoriesDir, archiveDir);

    return { agent: agentName, status: 'migrated' };
  } catch (e) {
    return { agent: agentName, status: 'error', reason: String(e) };
  }
}

async function migrateWorld(worldName: string, worldDir: string, dryRun: boolean): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(worldDir);
  } catch {
    console.error(`World not found: ${worldDir}`);
    process.exit(1);
  }

  const results: MigrationResult[] = [];
  for (const entry of entries) {
    const agentDir = path.join(worldDir, entry);
    const stat = await fs.stat(agentDir).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const result = await migrateAgent(agentDir, dryRun);
    results.push(result);
  }

  // Summary
  const migrated = results.filter((r) => r.status === 'migrated');
  const alreadyV2 = results.filter((r) => r.status === 'already-v2');
  const skipped = results.filter((r) => r.status === 'skipped');
  const errors = results.filter((r) => r.status === 'error');

  console.log(`\nMigration ${dryRun ? '(DRY RUN) ' : ''}complete for world: ${worldName}`);
  console.log(`  migrated:   ${migrated.map((r) => r.agent).join(', ') || 'none'}`);
  console.log(`  already-v2: ${alreadyV2.map((r) => r.agent).join(', ') || 'none'}`);
  if (skipped.length) console.log(`  skipped:    ${skipped.map((r) => `${r.agent} (${r.reason})`).join(', ')}`);
  if (errors.length) {
    console.log(`  errors:     ${errors.map((r) => `${r.agent} (${r.reason})`).join(', ')}`);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
const worldNameArg = args.find((a) => !a.startsWith('--')) ?? 'genesis';
const dryRun = args.includes('--dry-run');

// Support absolute path (for tests) or world name (resolved under projectRoot/worlds/)
const worldChildrenDir = path.isAbsolute(worldNameArg)
  ? path.join(worldNameArg, 'children')
  : path.join(projectRoot, 'worlds', worldNameArg, 'children');

await migrateWorld(worldNameArg, worldChildrenDir, dryRun);
