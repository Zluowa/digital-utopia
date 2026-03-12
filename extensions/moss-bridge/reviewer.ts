// @input: 交付提交manifest + 验收结果
// @output: Token奖励/扣罚 + 反馈写入inbox
// @position: 验收处理器

import { promises as fs } from 'fs';
import path from 'path';
import { credit } from '../../engine/src/economy.js';

export interface DeliverySubmission {
  id: string;
  submittedBy: string;
  submittedAt: string;
  title: string;
  description: string;
  targetProject: string;
  files: { artifactPath: string; intendedPath: string; action: 'create' | 'modify' }[];
  status: 'pending-review' | 'accepted' | 'rejected';
}

export type ReviewVerdict = 'excellent' | 'good' | 'acceptable' | 'rejected';

export interface ReviewResult {
  deliveryId: string;
  reviewedAt: string;
  verdict: ReviewVerdict;
  reward: number;
  feedback: string;
}

export async function processReview(
  deliveryId: string,
  verdict: ReviewVerdict,
  feedback: string,
  agentDir: string,
  agentId: string,
  bridgeDir: string,
  baseReward: number,
  multipliers: Record<string, number>,
): Promise<ReviewResult> {
  const multiplier = multipliers[verdict] ?? 0;
  const reward = Math.floor(baseReward * multiplier);

  // Credit reward if accepted
  if (reward > 0) {
    await credit(agentDir, agentId, reward, `delivery-reward: ${deliveryId}`, { verdict });
  }

  const result: ReviewResult = {
    deliveryId, reviewedAt: new Date().toISOString(),
    verdict, reward, feedback,
  };

  // Write review
  const reviewDir = path.join(bridgeDir, 'acceptance', 'reviews');
  await fs.mkdir(reviewDir, { recursive: true });
  await fs.writeFile(
    path.join(reviewDir, `${deliveryId}.json`),
    JSON.stringify(result, null, 2),
  );

  // Send feedback to agent inbox
  const inboxDir = path.join(agentDir, 'inbox');
  await fs.mkdir(inboxDir, { recursive: true });
  const inboxMsg = {
    id: `review-${deliveryId}`,
    from: 'moss-bridge',
    subject: verdict === 'rejected'
      ? `交付被退回: ${deliveryId}`
      : `交付已接受 (+${reward}T): ${deliveryId}`,
    content: feedback,
    timestamp: new Date().toISOString(),
    priority: 'normal',
  };
  await fs.writeFile(
    path.join(inboxDir, `review-${deliveryId}.json`),
    JSON.stringify(inboxMsg, null, 2),
  );

  return result;
}
