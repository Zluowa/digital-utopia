// @input: worktree meta + diff
// @output: automated check results (tsc, scope validation)
// @position: quality gate — runs before human review

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type { AutomatedCheckResult } from './protocol.js';
import { getDiff } from './provision.js';

const exec = promisify(execFile);

// ── Run all automated checks ─────────────────────────────────────────

export async function runChecks(
  worldDir: string,
  jobId: string,
  targetProject: string | string[],
): Promise<AutomatedCheckResult> {
  const projects = Array.isArray(targetProject) ? targetProject : [targetProject];
  const { summary, raw } = await getDiff(worldDir, jobId);
  const scopeResult = checkScope(raw, projects);
  const tscResult = await runTsc(worldDir, jobId, projects[0]);

  return {
    tscPassed: tscResult.passed,
    tscOutput: tscResult.output,
    scopeValid: scopeResult.valid,
    scopeViolations: scopeResult.violations,
    diff: summary,
  };
}

// ── TypeScript compile check ─────────────────────────────────────────

async function runTsc(
  worldDir: string,
  jobId: string,
  primaryProject: string,
): Promise<{ passed: boolean; output: string }> {
  const wtPath = path.join(worldDir, '.worktrees', jobId);
  const projectPath = path.join(wtPath, primaryProject);

  try {
    const { stdout, stderr } = await exec(
      'npx', ['tsc', '--noEmit'],
      { cwd: projectPath, timeout: 60_000 },
    );
    return { passed: true, output: stdout || stderr || 'OK' };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    return { passed: false, output: e.stderr || e.stdout || 'tsc failed' };
  }
}

// ── Scope validation ─────────────────────────────────────────────────
// Ensure changes are within the allowed project directories

function checkScope(rawDiff: string, allowedProjects: string[]): { valid: boolean; violations: string[] } {
  const filePattern = /^diff --git a\/(.+?) b\//gm;
  const violations: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = filePattern.exec(rawDiff)) !== null) {
    const filePath = match[1];
    if (!allowedProjects.some(p => filePath.startsWith(p))) {
      violations.push(filePath);
    }
  }

  return { valid: violations.length === 0, violations };
}

// ── Format review report for human consumption ───────────────────────

export function formatReport(checks: AutomatedCheckResult): string {
  const lines: string[] = ['# Automated Review Report', ''];

  lines.push(`## Diff: ${checks.diff.filesChanged} files, +${checks.diff.linesAdded} -${checks.diff.linesRemoved}`);
  lines.push('');

  lines.push(`## TypeScript: ${checks.tscPassed ? 'PASS' : 'FAIL'}`);
  if (!checks.tscPassed) lines.push('```', checks.tscOutput.slice(0, 2000), '```');
  lines.push('');

  lines.push(`## Scope: ${checks.scopeValid ? 'PASS' : 'FAIL'}`);
  if (!checks.scopeValid) {
    lines.push('Out-of-scope files:');
    checks.scopeViolations.forEach(v => lines.push(`  - ${v}`));
  }

  return lines.join('\n');
}
