/**
 * 一条命令起全栈：npm run dev:all
 * 同时拉起 Vite（5173）与 API（8787），Ctrl+C 一起退出。
 * 不引入 concurrently 之类的额外依赖。
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(viteBin)) {
  console.error('未找到 vite，请先运行 npm install');
  process.exit(1);
}

const children = [];

function start(label, args) {
  const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  children.push(child);
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[${label}] 退出，code=${code}`);
  });
  return child;
}

console.log('启动全栈开发环境：Vite http://localhost:5173 · API http://localhost:8787\n');
start('API', ['--experimental-sqlite', path.join(ROOT, 'backend', 'index.js')]);
// 通过统一包装器启动 Vite（root = frontend/），复用临时目录重定向逻辑
start('WEB', [path.join(ROOT, 'scripts', 'run.js'), viteBin, 'frontend', '--host', '0.0.0.0']);

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGINT');
  }
  setTimeout(() => process.exit(0), 300).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
