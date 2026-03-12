// @input: DU agent directory + economy functions
// @output: AgentAdapter for DU residents (inbox + Token)
// @position: adapter plugin — DU-specific notification and payment

import { promises as fs } from 'fs';
import path from 'path';
import type { AgentAdapter, Assignment, Job } from '../core/protocol.js';

// Dynamic import to avoid tsconfig rootDir conflict with engine/
async function creditAgent(
  agentDir: string, agentId: string, amount: number,
  reason: string, metadata?: Record<string, unknown>,
): Promise<void> {
  const { credit } = await import('../../../engine/src/economy.js');
  await credit(agentDir, agentId, amount, reason, metadata);
}

export class DuResidentAdapter implements AgentAdapter {
  readonly type = 'du-resident';
  private worldDir: string;

  constructor(worldDir: string) {
    this.worldDir = worldDir;
  }

  private agentDir(agentId: string): string {
    return path.join(this.worldDir, 'children', agentId);
  }

  async notify(agentId: string, assignment: Assignment, job: Job): Promise<void> {
    const inboxDir = path.join(this.agentDir(agentId), 'inbox');
    await fs.mkdir(inboxDir, { recursive: true });

    const message = {
      from: 'MOSS',
      subject: `外包录用: ${job.title}`,
      priority: 'P0',
      message: [
        `你已被录用为外包任务 "${job.title}" 的承包商。`,
        '',
        `工区路径: ${assignment.worktreePath}`,
        `目标项目: ${assignment.accessPaths[0] ?? job.targetProject}`,
        `分支: ${assignment.branch}`,
        `报酬: ${job.reward} Token（质量越高倍率越高）`,
        '',
        '## 工作流程',
        '1. cd 到工区路径',
        '2. 在目标项目中完成任务',
        '3. 可以运行 tsc / lint / test 验证',
        '4. git commit 你的改动',
        '5. 回到家目录，完成后写报告',
        '',
        '## 注意',
        '- 只修改目标项目内的文件',
        '- 不要 git stash / checkout / force-push',
        '- 改动会被自动审查（tsc + scope + 人工）',
      ].join('\n'),
      worktreePath: assignment.worktreePath,
      targetProject: job.targetProject,
      branch: assignment.branch,
      reward: job.reward,
      timestamp: new Date().toISOString(),
    };

    const fp = path.join(inboxDir, `outsource-${job.id}.json`);
    await fs.writeFile(fp, JSON.stringify(message, null, 2));
  }

  async pay(
    agentId: string, amount: number,
    reason: string, metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (amount <= 0) return;
    await creditAgent(this.agentDir(agentId), agentId, amount, reason, metadata);
  }

  async canClaim(agentId: string, _job: Job): Promise<{ eligible: boolean; reason?: string }> {
    const dir = this.agentDir(agentId);
    try {
      await fs.access(dir);
      return { eligible: true };
    } catch {
      return { eligible: false, reason: `Agent ${agentId} not found in world` };
    }
  }
}
