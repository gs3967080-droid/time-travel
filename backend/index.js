/**
 * 轻量全栈服务（零额外依赖，只用 Node 内置模块）：
 *   - REST API：朝代 / 事件 / 开场白 / 会话 / 抉择 / 统计
 *   - SQLite 持久化（node:sqlite，不可用时自动降级 JSON 文件）
 *   - 顺带托管 dist/，构建完成后「一个端口 = 完整 Web 产品」
 *
 * 前端不依赖它：不启动本服务，页面照样用本地 mock 跑完整演示路线。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createStore } from '../database/store.js';
import { DIST_DIR, ROOT } from '../database/seed.js';
import { loadEnvFile } from './env.js';
import { simulateWithAI, npcWithAI, aiConfig } from './ai.js';
import { COLLAPSE_TURN } from '../shared/simulator.js';

// 先载入 .env（存在才读），AI 配置会在每次调用时读取环境变量
loadEnvFile(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const store = await createStore();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, status, data, ok = true) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(ok ? { ok: true, data } : { ok: false, error: data }));
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('请求体不是合法 JSON')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(DIST_DIR, relative);
  const inside = target === DIST_DIR || target.startsWith(DIST_DIR + path.sep);
  if (!inside) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const file = fs.existsSync(target) && fs.statSync(target).isFile()
    ? target
    : path.join(DIST_DIR, 'index.html'); // SPA fallback

  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>时空跃迁 · 服务已启动</title>
      <body style="background:#050505;color:#bffcff;font-family:monospace;padding:48px;line-height:2">
      <h2>API 服务已启动，但前端产物尚未构建</h2>
      <p>开发模式：另开一个终端运行 <code>npm run dev</code>，访问 http://localhost:5173</p>
      <p>一体演示：运行 <code>npm run build && npm run server</code>，再访问 http://localhost:${PORT}</p>
      <p>接口自检：<a style="color:#00ffff" href="/api/health">/api/health</a></p>
      </body></html>`);
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const stream = fs.createReadStream(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  stream.pipe(res);
  stream.on('error', () => res.end());
}

async function handleApi(req, res, url) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (method === 'GET' && pathname === '/api/health') {
    const meta = store.getMeta();
    sendJson(res, 200, {
      status: 'ok',
      engine: store.engine,
      database: path.relative(ROOT, store.path),
      seededAt: meta.seededAt,
      dataSource: meta.dataSource,
      anchors: store.getStats().anchors,
      uptime: Math.round(process.uptime()),
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const meta = store.getMeta();
    sendJson(res, 200, {
      dynasties: store.getDynasties(),
      intro: meta.intro || '',
      dataSource: meta.dataSource || '数据库',
      meta: { engine: store.engine, seededAt: meta.seededAt, isFallback: meta.isFallback === 'true' },
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/dynasties') {
    sendJson(res, 200, store.getDynasties());
    return;
  }

  if (method === 'GET' && pathname === '/api/events') {
    sendJson(res, 200, store.getEvents(url.searchParams.get('dynasty')));
    return;
  }

  if (method === 'GET' && pathname.startsWith('/api/events/')) {
    const id = decodeURIComponent(pathname.slice('/api/events/'.length));
    const event = store.getEvent(id);
    if (!event) { sendJson(res, 404, '未找到该历史锚点', false); return; }
    sendJson(res, 200, event);
    return;
  }

  if (method === 'POST' && pathname === '/api/sessions') {
    const body = await readBody(req);
    const session = store.createSession(body.userAgent || req.headers['user-agent']);
    sendJson(res, 201, session);
    return;
  }

  if (pathname === '/api/choices') {
    if (method === 'POST') {
      const body = await readBody(req);
      if (!body.eventId) { sendJson(res, 400, '缺少 eventId', false); return; }
      const choice = store.addChoice(body);
      sendJson(res, 201, choice);
      return;
    }
    if (method === 'GET') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
      sendJson(res, 200, store.listChoices(url.searchParams.get('sessionId'), limit));
      return;
    }
  }

  if (method === 'GET' && pathname === '/api/choices/stats') {
    sendJson(res, 200, store.getStats());
    return;
  }

  // AI 是否可用（前端据此显示「AI 生成 / 未配置」）
  if (method === 'GET' && pathname === '/api/ai/status') {
    const config = aiConfig();
    sendJson(res, 200, {
      enabled: config.enabled,
      model: config.model,
      baseUrl: config.baseUrl,
      collapseTurn: COLLAPSE_TURN,
    });
    return;
  }

  // 时间线推演：由 AI 生成；多轮之后世界线崩溃
  if (method === 'POST' && pathname === '/api/simulate') {
    const body = await readBody(req);
    if (!body.option && !body.event) {
      sendJson(res, 400, '缺少推演上下文', false);
      return;
    }
    const payload = {
      event: body.event || {},
      option: body.option || {},
      dynasty: body.dynasty || {},
      npc: body.npc || null,
      turn: Number.isInteger(body.turn) ? body.turn : 0,
      entropy: Number.isFinite(body.entropy) ? body.entropy : 0,
      history: Array.isArray(body.history) ? body.history.slice(-12) : [],
    };
    const sim = await simulateWithAI(payload);
    if (!sim.ok) {
      sendJson(res, 200, { kind: 'error', error: sim.error });
      return;
    }
    sendJson(res, 200, {
      ...sim.data,
      source: 'ai',
      turn: payload.turn + 1,
      collapseTurn: COLLAPSE_TURN,
    });
    return;
  }

  // 人物对话：玩家自由输入，AI 推演回应与影响
  if (method === 'POST' && pathname === '/api/npc/talk') {
    const body = await readBody(req);
    const payload = {
      event: body.event || {},
      dynasty: body.dynasty || {},
      npc: body.npc || {},
      turn: Number.isInteger(body.turn) ? body.turn : 0,
      history: Array.isArray(body.history) ? body.history.slice(-12) : [],
      playerText: String(body.playerText || '').slice(0, 200),
    };
    const result = await npcWithAI(payload);
    if (!result.ok) {
      sendJson(res, 200, { kind: 'error', error: result.error });
      return;
    }
    sendJson(res, 200, {
      kind: 'line',
      ...result.data,
      source: 'ai',
      turn: payload.turn + 1,
    });
    return;
  }

  sendJson(res, 404, `未知接口 ${method} ${pathname}`, false);
}

const server = http.createServer(async (req, res) => {
  setCors(res);
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    sendJson(res, 400, '非法请求地址', false);
    return;
  }
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(url.pathname, res);
  } catch (error) {
    console.error('[api] 请求处理失败：', error);
    if (!res.headersSent) sendJson(res, 500, error.message || '服务器内部错误', false);
    else res.end();
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。先关闭旧服务，或用 PORT=8788 npm run server 换端口。`);
    process.exit(1);
  }
  console.error('[api] 服务异常：', error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  时空跃迁 · 历史枢纽  API  http://localhost:${PORT}`);
  console.log(`  引擎 ${store.engine} · 数据 ${path.relative(ROOT, store.path)}`);
  console.log(`  健康检查 /api/health · 全量数据 /api/bootstrap · 抉择统计 /api/choices/stats`);
  if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.log(`  前端产物已托管：http://localhost:${PORT} 直接可演示\n`);
  } else {
    console.log(`  尚未构建前端：先 npm run build，或另开终端 npm run dev\n`);
  }
});

function shutdown() {
  console.log('\n[api] 正在关闭…');
  server.close(() => { store.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
