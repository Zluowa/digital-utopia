#!/usr/bin/env node
// @input: CLI args (--from, --subject, --body, --priority)
// @output: POST to /api/escalate, prints result
// @position: 替代curl的UTF-8安全升级脚本，解决Windows GBK乱码

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const from = getArg('from') || 'atlas';
const subject = getArg('subject');
const body = getArg('body');
const priority = getArg('priority') || 'normal';

if (!subject || !body) {
  console.error('Usage: node escalate.mjs --from atlas --subject "问题" --body "详情" [--priority high]');
  process.exit(1);
}

const resp = await fetch('http://localhost:4000/api/escalate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ from, subject, body, priority }),
});

const result = await resp.json();
console.log(JSON.stringify(result, null, 2));
