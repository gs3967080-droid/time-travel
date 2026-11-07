/**
 * 可选后端适配器。
 *
 * 策划书要求「无后端请求，确保演示零延迟」，而 Web 产品又需要真实的前后端 / 数据库。
 * 折中方案：前端永远先用本地 mock 渲染，再用 1.2s 超时的探测去问后端；
 * 后端在线就用 SQLite 数据，不在线就静默继续用本地数据，用户全程无感。
 *
 * 开发环境默认指向 http://localhost:8787；构建后同源（后端会同时托管 dist）。
 * 需要自定义地址时设置 VITE_API_BASE。
 */

import { normalizeData } from '../../../shared/dataContract.js';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:8787' : '');
const PROBE_TIMEOUT = 1200;

async function request(path, { method = 'GET', body, timeout = PROBE_TIMEOUT } = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? window.setTimeout(() => controller.abort(), timeout) : null;
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.ok ? payload.data : null;
  } catch {
    return null; // 后端没起 / 超时 / 跨域失败 —— 一律当作离线
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

/** 一次性拿到朝代 + 事件 + 开场白，减少往返 */
export async function bootstrapFromApi() {
  const data = await request('/api/bootstrap');
  if (!data || !Array.isArray(data.dynasties) || !data.dynasties.length) return null;
  const normalized = normalizeData({ dynasties: data.dynasties, intro: data.intro });
  if (!normalized.hasData) return null;
  return {
    dynasties: normalized.dynasties,
    intro: normalized.intro || data.intro || '',
    dataSource: data.dataSource || 'SQLite API',
    meta: data.meta || null,
  };
}

export async function openSession() {
  const data = await request('/api/sessions', {
    method: 'POST',
    body: { userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown' },
  });
  return data?.id || null;
}

/** 抉择落库：fire-and-forget，失败静默 */
export function recordChoice(payload) {
  return request('/api/choices', { method: 'POST', body: payload, timeout: 2000 });
}

export function getHealth() {
  return request('/api/health');
}

export function getChoiceStats() {
  return request('/api/choices/stats');
}

/** AI 推演：后端有 Key 就返回模型结果，没有则返回本地引擎结果；网络失败返回 null */
export async function simulateChoice(payload) {
  return request('/api/simulate', { method: 'POST', body: payload, timeout: 20000 });
}

/** 人物下一句台词：AI 生成，失败返回 null（前端回退本地台词池） */
export async function npcTalk(payload) {
  return request('/api/npc/talk', { method: 'POST', body: payload, timeout: 20000 });
}

/** AI 是否配置（用于界面提示） */
export function getAiStatus() {
  return request('/api/ai/status');
}
