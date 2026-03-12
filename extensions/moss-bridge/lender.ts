// @input: 借阅请求文件 + 真实项目根目录
// @output: 只读文件副本 + 扣Token
// @position: 文档借阅处理器

import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { validateRequest, type SafetyConfig } from './safety.js';
import { deduct } from '../../engine/src/economy.js';

export interface LendRequest {
  id: string;
  requestedBy: string;
  requestedAt: string;
  files: string[];
  reason: string;
  status: 'pending' | 'granted' | 'denied';
}

export interface LendGrant {
  requestId: string;
  grantedAt: string;
  files: { originalPath: string; localPath: string; sizeBytes: number; costTokens: number }[];
  totalCost: number;
  status: 'granted' | 'denied-invalid' | 'denied-insufficient-funds';
  denyReason?: string;
}

export async function processLendRequest(
  request: LendRequest,
  projectRoot: string,
  worldDir: string,
  agentDir: string,
  safetyConfig: SafetyConfig,
  bridgeDir: string,
  costPerKB: number,
  baseCost: number,
): Promise<LendGrant> {
  // Validate paths
  const validation = validateRequest(request.files, safetyConfig);
  if (!validation.ok) {
    return {
      requestId: request.id, grantedAt: new Date().toISOString(),
      files: [], totalCost: 0, status: 'denied-invalid',
      denyReason: validation.errors.join('; '),
    };
  }

  // Calculate cost and copy files
  const grantedFiles: LendGrant['files'] = [];
  let totalCost = baseCost;

  for (const relPath of request.files) {
    const srcPath = path.join(projectRoot, relPath);
    if (!existsSync(srcPath)) continue;

    const stat = await fs.stat(srcPath);
    if (!stat.isFile()) continue;
    if (stat.size > safetyConfig.maxFileSizeKB * 1024) continue;

    const sizeKB = Math.ceil(stat.size / 1024);
    const fileCost = sizeKB * costPerKB;
    totalCost += fileCost;

    const localName = relPath.replace(/\//g, '__');
    grantedFiles.push({
      originalPath: relPath, localPath: localName,
      sizeBytes: stat.size, costTokens: fileCost,
    });
  }

  if (grantedFiles.length === 0) {
    return {
      requestId: request.id, grantedAt: new Date().toISOString(),
      files: [], totalCost: 0, status: 'denied-invalid',
      denyReason: 'no valid files found',
    };
  }

  // Deduct tokens
  const paid = await deduct(agentDir, request.requestedBy, totalCost, `doc-lending: ${request.reason}`);
  if (!paid) {
    return {
      requestId: request.id, grantedAt: new Date().toISOString(),
      files: grantedFiles, totalCost, status: 'denied-insufficient-funds',
    };
  }

  // Copy files to granted directory
  const grantDir = path.join(bridgeDir, 'lending', 'granted', request.id);
  const filesDir = path.join(grantDir, 'files');
  await fs.mkdir(filesDir, { recursive: true });

  for (const gf of grantedFiles) {
    const src = path.join(projectRoot, gf.originalPath);
    const dst = path.join(filesDir, gf.localPath);
    await fs.copyFile(src, dst);
  }

  const grant: LendGrant = {
    requestId: request.id, grantedAt: new Date().toISOString(),
    files: grantedFiles, totalCost, status: 'granted',
  };

  await fs.writeFile(path.join(grantDir, 'manifest.json'), JSON.stringify(grant, null, 2));
  return grant;
}
