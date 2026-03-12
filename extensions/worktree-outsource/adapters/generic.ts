// @input: worktree path only (no DU dependencies)
// @output: AgentAdapter for any agent (file-based notification, no payment)
// @position: adapter plugin — open source / external agent participation

import { promises as fs } from 'fs';
import path from 'path';
import type { AgentAdapter, Assignment, Job } from '../core/protocol.js';

export class GenericAdapter implements AgentAdapter {
  readonly type = 'generic';

  async notify(agentId: string, assignment: Assignment, job: Job): Promise<void> {
    const notifyDir = path.join(assignment.worktreePath, '.outsource');
    await fs.mkdir(notifyDir, { recursive: true });

    const briefing = {
      agentId,
      job: { id: job.id, title: job.title, description: job.description },
      branch: assignment.branch,
      targetProject: job.targetProject,
      accessPaths: assignment.accessPaths,
      instructions: [
        'Work within the target project directory.',
        'Run tsc/lint/test to verify before submitting.',
        'Commit your changes to the assigned branch.',
        'Changes outside targetProject scope will be rejected.',
      ],
      assignedAt: assignment.assignedAt,
    };

    await fs.writeFile(
      path.join(notifyDir, 'briefing.json'),
      JSON.stringify(briefing, null, 2),
    );
  }

  async pay(_agentId: string, _amount: number, _reason: string): Promise<void> {
    // Generic adapter has no payment system.
    // The "payment" is merge access — the code gets into the repo.
  }

  async canClaim(_agentId: string, _job: Job): Promise<{ eligible: boolean }> {
    return { eligible: true };
  }
}
