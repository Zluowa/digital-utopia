// @input: 文件路径 + 白名单/黑名单模式
// @output: 路径是否安全可读
// @position: 桥接安全层，防止越界访问

import path from 'path';

export interface SafetyConfig {
  allowedPatterns: string[];
  deniedPatterns: string[];
  maxFileSizeKB: number;
  maxFilesPerRequest: number;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAny(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return patterns.some((p) => globToRegex(p).test(normalized));
}

export function validatePath(filePath: string, config: SafetyConfig): { ok: boolean; reason: string } {
  const normalized = filePath.replace(/\\/g, '/');

  // Block path traversal
  if (normalized.includes('..')) {
    return { ok: false, reason: 'path traversal blocked' };
  }

  // Block absolute paths
  if (path.isAbsolute(filePath)) {
    return { ok: false, reason: 'absolute paths not allowed' };
  }

  // Check deny list first (deny wins)
  if (matchesAny(normalized, config.deniedPatterns)) {
    return { ok: false, reason: `matches deny pattern` };
  }

  // Check allow list
  if (!matchesAny(normalized, config.allowedPatterns)) {
    return { ok: false, reason: `not in allowed patterns` };
  }

  return { ok: true, reason: 'ok' };
}

export function validateRequest(
  files: string[],
  config: SafetyConfig,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (files.length > config.maxFilesPerRequest) {
    errors.push(`too many files: ${files.length} > ${config.maxFilesPerRequest}`);
  }

  for (const f of files) {
    const check = validatePath(f, config);
    if (!check.ok) errors.push(`${f}: ${check.reason}`);
  }

  return { ok: errors.length === 0, errors };
}
