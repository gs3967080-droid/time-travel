/**
 * 统一启动包装器（零依赖）。
 *
 * 本机工作区的系统临时目录被 ACL 限制，esbuild 往 %TEMP% 写中间文件会报
 * "Access is denied"。这里把 TEMP/TMP/TMPDIR 重定向到项目内 .tmp/，
 * 让 npm run dev / build / preview 在受限环境下也能稳定跑起来。
 * 参数：node scripts/run.js <要执行的 js 文件> [参数...]
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localTmp = path.join(ROOT, '.tmp');
fs.mkdirSync(localTmp, { recursive: true });

const [target, ...args] = process.argv.slice(2);
if (!target) {
  console.error('用法：node scripts/run.js <脚本路径> [参数...]');
  process.exit(1);
}
const script = path.isAbsolute(target) ? target : path.resolve(ROOT, target);
if (!fs.existsSync(script)) {
  console.error(`找不到脚本：${script}`);
  process.exit(1);
}

const child = spawn(process.execPath, [script, ...args], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, TEMP: localTmp, TMP: localTmp, TMPDIR: localTmp },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
