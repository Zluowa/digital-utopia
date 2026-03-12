// @input: Running Digital Utopia frontend at localhost:3000
// @output: 8 replacement guide images in public/guide-images/
// @position: One-off build script for guide image generation
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'guide-images');

// ── Theme tokens (match Digital Utopia dark theme) ──
const T = {
  bg: '#111114', surface: '#1a1a1f', card: '#222228',
  border: '#333338', text: '#e8e8ec', dim: '#888890',
  accent: '#e67e22', green: '#4ade80', red: '#f87171',
  blue: '#60a5fa', purple: '#a78bfa', font: `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`,
};

const BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:${T.bg}; color:${T.text}; font-family:${T.font}; font-size:14px; line-height:1.5; }
  .surface { background:${T.surface}; }
  .card { background:${T.card}; border:1px solid ${T.border}; border-radius:8px; }
  .accent { color:${T.accent}; }
  .dim { color:${T.dim}; }
  .green { color:${T.green}; }
  .red { color:${T.red}; }
  .blue { color:${T.blue}; }
  .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:500; }
  .badge-green { background:#166534; color:#4ade80; }
  .badge-orange { background:#7c2d12; color:#fb923c; }
  .badge-blue { background:#1e3a5f; color:#60a5fa; }
  .badge-red { background:#7f1d1d; color:#f87171; }
`;

function wrap(body, w = 1280, h = 800) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
  <body style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;overflow:hidden">${body}</body></html>`;
}

// ── Mockup generators ──

function sidebarHtml() {
  const residents = ['alice', 'bob', 'charlie', 'dai', 'nexus', 'reeve', 'sentinel'];
  const items = residents.map(r => `
    <div style="display:flex;align-items:center;padding:8px 16px;gap:10px;cursor:pointer">
      <div style="width:8px;height:8px;border-radius:50%;background:${T.green};flex-shrink:0"></div>
      <span>${r}</span>
    </div>`).join('');
  return wrap(`
    <div style="width:260px;height:520px;background:${T.surface};border-right:1px solid ${T.border};border-radius:12px;overflow:hidden">
      <div style="padding:12px 16px;display:flex;align-items:center;justify-content:between">
        <span style="font-weight:600;font-size:15px;flex:1">工作区</span>
        <span style="color:${T.accent};margin-left:auto;font-size:18px">😊 +</span>
      </div>
      <div style="padding:4px 12px">
        <div style="background:${T.card};border:1px solid ${T.border};border-radius:6px;padding:6px 10px;color:${T.dim};font-size:13px">搜索...</div>
      </div>
      <div style="padding:10px 16px 4px;display:flex;align-items:center">
        <span style="font-weight:600;font-size:13px;color:${T.accent}">需要注意</span>
        <span style="margin-left:auto;color:${T.dim};font-size:12px">▼</span>
      </div>
      <div style="padding:2px 16px 8px;color:${T.dim};font-size:12px">没有工作区</div>
      <div style="padding:6px 16px 4px;display:flex;align-items:center">
        <span style="font-weight:600;font-size:13px">空闲</span>
        <span style="margin-left:auto;color:${T.dim};font-size:12px">▼</span>
      </div>
      ${items}
    </div>`, 460, 600);
}

function commandBarHtml() {
  const actions = [
    ['＋', '新建工作空间'], ['</>', '在编辑器中打开'], ['📋', '复制路径'],
    ['▶', '启动开发服务器'], ['↗', '在旧版UI中打开'], ['⚙', '工作空间操作'], ['🔀', 'Git 操作'],
  ];
  const rows = actions.map(([icon, label], i) => `
    <div style="display:flex;align-items:center;padding:10px 16px;gap:12px;${i === 0 ? `background:${T.card}` : ''};cursor:pointer;border-radius:4px">
      <span style="width:20px;text-align:center;color:${T.dim}">${icon}</span>
      <span>${label}</span>
    </div>`).join('');
  return wrap(`
    <div class="card" style="width:560px;padding:0;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="padding:12px 16px;border-bottom:1px solid ${T.border};display:flex;align-items:center;gap:8px">
        <span style="color:${T.dim}">🔍</span>
        <span style="color:${T.dim}">输入命令或搜索...</span>
      </div>
      <div style="padding:8px">
        <div style="padding:4px 16px;font-size:11px;color:${T.dim};text-transform:uppercase;letter-spacing:0.5px">操作</div>
        ${rows}
        <div style="padding:8px 16px 4px;font-size:11px;color:${T.dim};text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid ${T.border};margin-top:4px">视图</div>
        <div style="display:flex;align-items:center;padding:10px 16px;gap:12px;cursor:pointer;border-radius:4px">
          <span style="width:20px;text-align:center;color:${T.dim}">⊞</span>
          <span>视图选项</span>
        </div>
      </div>
    </div>`, 1280, 800);
}

function multiRepoHtml() {
  const repoRoot = process.env.UTOPIA_REPO_ROOT || '<workspace-root>/projects/digital-utopia';
  const repos = [
    { name: 'digital-utopia', path: repoRoot, branch: 'main' },
    { name: 'utopia-engine', path: `${repoRoot}/engine`, branch: 'dev' },
  ];
  const items = repos.map(r => `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:16px;font-weight:500">${r.name}</span>
        <span style="color:${T.dim};cursor:pointer;font-size:18px">×</span>
      </div>
      <div style="color:${T.dim};font-size:13px;margin-bottom:8px">${r.path}</div>
      <div style="background:${T.card};border:1px solid ${T.border};border-radius:6px;padding:8px 12px;display:flex;align-items:center;gap:8px">
        <span style="color:${T.accent}">🔀</span>
        <span>${r.branch}</span>
        <span style="margin-left:auto;color:${T.dim}">▼</span>
      </div>
    </div>`).join('');
  return wrap(`
    <div style="width:520px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;padding-left:4px;border-left:3px solid ${T.accent}">
        <span style="font-size:18px;font-weight:600">代码仓库</span>
        <span style="margin-left:auto;color:${T.dim}">▼</span>
      </div>
      ${items}
    </div>`, 1280, 800);
}

function diffsHtml() {
  const lines = [
    { type: 'ctx', num: [138, 138], code: '  return {' },
    { type: 'ctx', num: [139, 139], code: '    config: {' },
    { type: 'del', num: [140, ''], code: `      language: 'EN',` },
    { type: 'add', num: ['', 140], code: `      language: 'ZH_HANS',` },
    { type: 'ctx', num: [141, 141], code: `      theme: 'DARK',` },
    { type: 'ctx', num: [142, 142], code: '      disclaimer_acknowledged: true,' },
    { type: 'ctx', num: [143, 143], code: '      onboarding_acknowledged: true,' },
  ];
  const rows = lines.map(l => {
    const bg = l.type === 'add' ? 'rgba(74,222,128,0.08)' : l.type === 'del' ? 'rgba(248,113,113,0.08)' : 'transparent';
    const prefix = l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ';
    const prefixColor = l.type === 'add' ? T.green : l.type === 'del' ? T.red : 'transparent';
    return `<div style="display:flex;background:${bg};font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.7">
      <span style="width:40px;text-align:right;padding-right:8px;color:${T.dim};user-select:none">${l.num[0]}</span>
      <span style="width:40px;text-align:right;padding-right:8px;color:${T.dim};user-select:none">${l.num[1]}</span>
      <span style="width:16px;color:${prefixColor};text-align:center">${prefix}</span>
      <span style="flex:1;padding-left:4px"><code>${l.code.replace(/</g,'&lt;')}</code></span>
    </div>`;
  }).join('');

  return wrap(`
    <div class="card" style="width:720px;overflow:hidden">
      <div style="padding:8px 16px;border-bottom:1px solid ${T.border};display:flex;align-items:center;gap:8px;font-size:13px">
        <span style="color:${T.blue}">TS</span>
        <span>/digital-utopia/engine/src/adapter.ts</span>
        <span class="green" style="margin-left:auto;font-size:12px">+1</span>
        <span class="red" style="font-size:12px">-1</span>
      </div>
      <div style="padding:0">${rows}</div>
      <div style="margin:12px 16px;padding:12px 16px;background:${T.surface};border-radius:8px;border-left:3px solid ${T.accent}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="width:24px;height:24px;border-radius:50%;background:${T.accent};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold">H</div>
          <span style="font-weight:500">Helios</span>
          <span class="dim" style="font-size:12px">2小时前</span>
        </div>
        <div style="font-size:13px">默认语言改成中文，这样用户首次进入就是中文界面 👍</div>
      </div>
    </div>`, 1280, 800);
}

function projectsKanbanHtml() {
  const cols = [
    { title: '待办', color: T.dim, tasks: [
      { id: 'DU-18', title: '居民记忆系统升级', tags: ['后端'], priority: '◈' },
      { id: 'DU-17', title: '世界地图可视化', tags: ['前端'], priority: '◇' },
      { id: 'DU-16', title: '居民间交易协议', tags: ['架构'], priority: '◈' },
    ]},
    { title: '进行中', color: T.accent, tasks: [
      { id: 'DU-12', title: '世界引擎性能优化', tags: ['后端'], priority: '◆', urgent: true },
      { id: 'DU-14', title: '前端国际化支持', tags: ['前端'], priority: '◈' },
    ]},
    { title: '审核中', color: T.purple, tasks: [
      { id: 'DU-09', title: '居民对话系统', tags: ['AI'], priority: '◈' },
    ]},
    { title: '已完成', color: T.green, tasks: [
      { id: 'DU-01', title: '基础架构搭建', tags: ['架构'], priority: '◇' },
      { id: 'DU-03', title: '数据库设计', tags: ['后端'], priority: '◇' },
      { id: 'DU-05', title: '用户认证系统', tags: ['后端'], priority: '◇' },
    ]},
  ];
  const colsHtml = cols.map(col => {
    const tasks = col.tasks.map(t => `
      <div class="card" style="padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span class="dim" style="font-size:12px">${t.id}</span>
          ${t.urgent ? '<span class="badge badge-red">紧急</span>' : ''}
        </div>
        <div style="font-size:13px;font-weight:500;margin-bottom:8px">${t.title}</div>
        <div style="display:flex;gap:4px">
          ${t.tags.map(tag => `<span class="badge badge-blue">${tag}</span>`).join('')}
          <span style="margin-left:auto;font-size:18px">🤖</span>
        </div>
      </div>`).join('');
    return `
      <div style="flex:1;min-width:200px">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;margin-bottom:8px">
          <div style="width:8px;height:8px;border-radius:50%;background:${col.color}"></div>
          <span style="font-weight:600;font-size:13px">${col.title}</span>
          <span class="dim" style="font-size:12px">${col.tasks.length}</span>
        </div>
        ${tasks}
      </div>`;
  }).join('');
  return wrap(`
    <div style="width:95%;display:flex;gap:16px;padding:16px">${colsHtml}</div>`, 1280, 720);
}

function projectsIssueHtml() {
  const subtasks = [
    ['DU-13', '内存泄漏排查与修复', '进行中', '2天'],
    ['DU-14', '决策树缓存优化', '已完成', '1天'],
    ['DU-15', '并发压力测试（50居民）', '待办', '3天'],
    ['DU-16', 'WebSocket连接池优化', '待办', '2天'],
  ];
  const subHtml = subtasks.map(([id, title, status, est]) => {
    const badge = status === '已完成' ? 'badge-green' : status === '进行中' ? 'badge-orange' : 'badge-blue';
    return `<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid ${T.border};gap:8px;font-size:13px">
      <input type="checkbox" ${status === '已完成' ? 'checked' : ''} style="accent-color:${T.accent}">
      <span class="dim">${id}</span>
      <span class="badge ${badge}" style="font-size:11px">${status}</span>
      <span style="flex:1">${title}</span>
      <span class="dim">${est}</span>
      <span>🤖</span>
    </div>`;
  }).join('');

  return wrap(`
    <div class="card" style="width:560px;max-height:700px;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid ${T.border}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-weight:600;color:${T.dim}">DU-12</span>
          <span style="color:${T.dim}">🔗</span>
          <span style="margin-left:auto;color:${T.dim}">···</span>
          <span style="color:${T.dim};cursor:pointer">×</span>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <span class="badge badge-orange">● 进行中</span>
          <span class="badge badge-red">◈ 紧急</span>
          <span>🤖</span>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:16px">
          <span class="badge badge-blue">后端</span>
          <span style="color:${T.dim};cursor:pointer">+</span>
        </div>
        <h3 style="font-size:18px;font-weight:600;margin-bottom:12px">世界引擎性能优化</h3>
        <ul style="padding-left:20px;color:${T.dim};font-size:13px;line-height:2">
          <li style="color:${T.text}">优化居民 AI 决策循环延迟（目标 &lt;100ms）</li>
          <li style="color:${T.text}">减少引擎内存占用（目标 &lt;500MB）</li>
          <li style="color:${T.text}">支持 50+ 居民并发运行</li>
        </ul>
      </div>
      <div style="padding:12px 20px;border-bottom:1px solid ${T.border}">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px">子任务</div>
        ${subHtml}
      </div>
    </div>`, 1280, 800);
}

function projectsWorkspacesHtml() {
  const workspaces = [
    { title: '优化居民 AI 决策延迟，减少循环等待...', time: '2小时前', files: 8, add: 245, del: 89, status: '进行中' },
    { title: '实现世界经济系统基础模块...', time: '1天前', files: 12, add: 1024, del: 56, status: '进行中' },
    { title: '添加多语言支持到前端界面...', time: '3天前', files: 15, add: 432, del: 128, status: '进行中' },
  ];
  const items = workspaces.map(w => `
    <div class="card" style="padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span class="badge badge-orange">${w.status}</span>
        <span style="flex:1;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w.title}</span>
        <span>🤖</span>
        <span class="dim">···</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:${T.dim}">
        <span>${w.time}</span>
        <span>·</span>
        <span>${w.files} 文件</span>
        <span>·</span>
        <span class="green">+${w.add}</span>
        <span class="red">-${w.del}</span>
        <span style="margin-left:auto">未创建 PR</span>
      </div>
    </div>`).join('');

  return wrap(`
    <div style="width:520px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="font-size:16px;font-weight:600">工作空间</span>
        <span style="margin-left:auto;color:${T.dim}">+ 🔗 ▼</span>
      </div>
      ${items}
    </div>`, 1280, 800);
}

function projectsOrgSettingsHtml() {
  return wrap(`
    <div class="card" style="width:720px;display:flex;overflow:hidden;height:480px">
      <div style="width:180px;padding:20px 0;border-right:1px solid ${T.border};flex-shrink:0">
        <div style="font-size:16px;font-weight:600;padding:0 20px;margin-bottom:16px">设置</div>
        ${['常规', '代码仓库', '组织设置', '项目', 'Agent', 'MCP 服务器'].map((item, i) =>
          `<div style="padding:8px 20px;font-size:14px;${i === 2 ? `color:${T.accent};border-left:2px solid ${T.accent};font-weight:500` : `color:${T.dim}`};cursor:pointer">${item}</div>`
        ).join('')}
      </div>
      <div style="flex:1;padding:24px 28px;overflow-y:auto">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:20px;font-weight:600">组织设置</span>
          <span style="background:${T.accent};color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer">创建组织 +</span>
        </div>
        <div class="dim" style="font-size:13px;margin-bottom:20px">管理组织成员和权限</div>
        <div style="font-size:13px;margin-bottom:6px">选择组织</div>
        <div style="background:${T.card};border:1px solid ${T.border};border-radius:6px;padding:10px 14px;display:flex;align-items:center;margin-bottom:6px">
          <span>乌托邦世界</span><span style="margin-left:auto;color:${T.dim}">▼</span>
        </div>
        <div class="dim" style="font-size:12px;margin-bottom:24px">选择组织来查看和管理成员</div>
        <div style="border-top:1px solid ${T.border};padding-top:16px;margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:600">成员</span>
            <span style="background:${T.accent};color:#fff;padding:4px 12px;border-radius:6px;font-size:12px;cursor:pointer">邀请成员 🔗</span>
          </div>
          <div class="dim" style="font-size:12px;margin-bottom:16px">管理乌托邦世界中的成员和角色</div>
          ${[
            { name: 'Helios', sub: '@helios', role: '管理员', you: true },
            { name: '陈伟', sub: '@chenwei', role: '成员', you: false },
            { name: '徐弘', sub: '@xuhong', role: '成员', you: false },
          ].map(m => `
            <div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid ${T.border};gap:12px">
              <div style="width:36px;height:36px;border-radius:50%;background:${T.card};display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px">${m.name[0]}</div>
              <div style="flex:1">
                <div style="font-weight:500;font-size:14px">${m.name}</div>
                <div class="dim" style="font-size:12px">${m.sub}</div>
              </div>
              <span class="badge badge-blue">${m.role}</span>
              ${m.you ? '<span class="dim" style="font-size:12px">你</span>' : `<span style="color:${T.dim};cursor:pointer">🗑</span>`}
            </div>`).join('')}
        </div>
      </div>
    </div>`, 1280, 800);
}

// ── Main ──
async function main() {
  const browser = await chromium.launch({ headless: true });

  const mockups = [
    ['sidebar.png', sidebarHtml, 460, 600],
    ['command-bar.png', commandBarHtml, 1280, 800],
    ['multi-repo.png', multiRepoHtml, 1280, 800],
    ['diffs.png', diffsHtml, 1280, 800],
    ['projects-kanban.png', projectsKanbanHtml, 1280, 720],
    ['projects-issue.png', projectsIssueHtml, 1280, 800],
    ['projects-workspaces.png', projectsWorkspacesHtml, 1280, 800],
    ['projects-org-settings.png', projectsOrgSettingsHtml, 1280, 800],
  ];

  for (const [filename, htmlFn, w, h] of mockups) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(htmlFn(), { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(OUT, filename), type: 'png' });
    await page.close();
    console.log(`✓ ${filename}`);
  }

  await browser.close();
  console.log(`\nDone! ${mockups.length} images generated in ${OUT}`);
}

main().catch(console.error);
