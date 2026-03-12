import { createEngine } from '../src/index.js';
import { deliverOutbox } from '../src/postman.js';

const PROJECT_ROOT = 'D:/Moss/projects/digital-utopia';

async function main() {
  const engine = await createEngine(PROJECT_ROOT, 'genesis');
  await engine.init();

  // First deliver all outbox messages
  const delivered = await deliverOutbox(
    engine.registry, engine.worldDir,
    (type, msg) => console.log(`[${type}] ${msg}`),
  );
  console.log(`\nDelivered ${delivered} messages\n`);

  // Now bury the zombies
  const kills = [
    { id: 'vigil', epitaph: '质量部主管。唤醒40+次，0个workspace文件。无法执行任何实际QA测试。', cause: 'zero-output' },
    { id: 'pulse', epitaph: '产品运营部主管。唤醒30+次，0个workspace文件。Sprint管理停留在模板阶段。', cause: 'zero-output' },
    { id: 'haven', epitaph: '社区与支持部主管。唤醒30+次，0个workspace文件。社区运营从未实际执行。', cause: 'zero-output' },
    { id: 'axis', epitaph: '项目管理部主管。唤醒20+次，2个workspace文件（均为空模板）。每次醒来检查inbox→无任务→归档→睡觉。', cause: 'bureaucratic-loop' },
    { id: 'ledger', epitaph: '财务运营部主管。唤醒15+次，0个workspace文件。每次routine check完成-无新财务数据。', cause: 'bureaucratic-loop' },
    { id: 'oracle', epitaph: '研究与数据部主管。唤醒最少(7868T burned)，0个workspace文件。数据分析从未产出。', cause: 'zero-output' },
    { id: 'herald', epitaph: '人事部主管。唤醒20+次，1个workspace文件（空花名册模板）。处理15+唤醒消息，未做任何实事。', cause: 'bureaucratic-loop' },
    { id: 'prism', epitaph: '设计部主管。唤醒15+次，1个workspace文件（空设计系统模板）。Echo发6次follow-up未得到任何回应。', cause: 'unresponsive' },
  ];

  for (const k of kills) {
    const agent = engine.registry.get(k.id);
    if (!agent) { console.log(`SKIP ${k.id}: not found`); continue; }
    try {
      const record = await engine.buryAgent(k.id, k.epitaph, k.cause);
      console.log(`BURIED ${k.id} (balance: ${record.finalBalance}T)`);
    } catch (e: any) {
      console.error(`FAIL ${k.id}: ${e.message}`);
    }
  }

  // List survivors
  console.log('\n--- Survivors ---');
  for (const a of engine.registry.all()) {
    console.log(`  ${a.id}: ${a.tokenBalance}T (${a.status})`);
  }

  engine.shutdown();
}

main().catch(console.error);
