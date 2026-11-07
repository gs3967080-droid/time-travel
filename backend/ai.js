/**
 * LLM 适配层（OpenAI 兼容协议，当前接 DeepSeek）
 *
 * 能力：
 *   1. simulateWithAI —— 一次行动之后的「此刻后果 + 新的行动」，或「世界线崩坏结局」
 *   2. npcWithAI      —— 人物下一句台词（带完整对话历史，能一直聊）
 *
 * 配置（.env 或环境变量）：
 *   LLM_BASE_URL  默认 https://api.deepseek.com/v1
 *   LLM_API_KEY   必填（也接受 DEEPSEEK_API_KEY / OPENAI_API_KEY）
 *   LLM_MODEL     默认 deepseek-chat
 *
 * 本版本不再提供内置剧情兜底：调用失败会返回结构化错误，由前端提示重试。
 */

import { normalizeSimulation, normalizeNpcResponse, COLLAPSE_TURN } from '../shared/simulator.js';

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 30000);

export function aiConfig() {
  const apiKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const model = process.env.LLM_MODEL || 'deepseek-chat';
  return { enabled: Boolean(apiKey), apiKey, baseUrl, model, collapseTurn: COLLAPSE_TURN };
}

const SIM_SYSTEM = `你是《时空跃迁·历史枢纽》的剧情推演引擎。玩家穿越到历史现场，刚做出一个行动，你负责立刻发生的后果。
硬性规则：
1. 只写「此刻、几分钟内」发生的事。禁止写多年以后、百年以后、历史评价、后世如何记载、后人怎么评价。
2. 后果要具体、可视、有现场感：谁动了、灯灭没灭、门开没开、谁在传话。不要空泛总结。
3. narrator 1-2 句；npcLine 1 句，以括号里的动作开头。
4. choices 给 3 个「玩家现在立刻可以做的事」，每条不超过 16 个汉字，具体可执行、彼此不同，至少有一个是追问/观察类。
5. effects.stability 与 effects.alert 为 -30 到 30 的整数；entropyDelta 是这次行动让世界线更不稳定的程度（0-12）。
6. 只输出 JSON，不要解释，不要 Markdown 代码块。`;

const COLLAPSE_SYSTEM = `你是《时空跃迁·历史枢纽》的剧情推演引擎。玩家的连续干预已经超出这条时间线能承载的极限，世界线正在崩溃。
要求：
1. narrator 写崩坏正在发生的过程，2-3 句，具体、有画面（光、声音、人、建筑如何消失或重复）。
2. ending.title 是一个短标题（不超过 8 个字）。
3. ending.text 用 2-3 句交代这条时间线最终变成了什么。
4. ending.epitaph 是一句墓志铭式的短句，不超过 14 个字。
5. 只输出 JSON，不要解释，不要 Markdown 代码块。`;

const NPC_SYSTEM = `你在扮演《时空跃迁·历史枢纽》中的一个历史现场人物。玩家在和你自由对话。
要求：
1. 用这个人物的身份、口吻说话，1-2 句，可带括号里的动作描写。
2. 必须直接回应玩家刚刚说的那句话，不要说重复的话，不要跳出角色。
3. 情绪随玩家的说法变化：被威胁会更谨慎或更冷，被示好会更坦诚，被戳中痛处会回避。
4. 同时判断这次对话对局势的影响：effects.stability（-15~15，局面对你有利还是恶化）、effects.alert（-15~15，对方对你的疑心）、entropyDelta（0~6，这次对话让世界线更不稳定的程度）。
5. info 是这次对话透露出的一个关键信息（不超过 30 字），没有就留空。
6. 只输出 JSON，形如 {"line":"...","mood":"戒备/松动/回避","info":"...","effects":{"stability":0,"alert":0},"entropyDelta":2}，不要解释，不要代码块。`;

function buildSimPrompt(payload) {
  const { event = {}, option = {}, dynasty = {}, turn = 0, entropy = 0, history = [] } = payload;
  return `场景：${dynasty.dynasty || ''} · ${event.locationName || ''} · ${event.year ?? ''} 年
事件：${event.title || ''}
现场：${event.rpgContext || ''}
人物：${payload.npc?.name || '现场的人'}

玩家刚做的事：${option.text || ''}
已发生的经过（按时间顺序，越靠后越近）：
${(history || []).slice(-10).map((h) => `- ${h}`).join('\n') || '-（刚刚抵达）'}

当前是第 ${turn + 1} 幕，崩坏度 ${entropy}/100。

输出 JSON：
{"narrator":"此刻发生了什么","npcLine":"（动作）人物反应","effects":{"stability":0,"alert":0},"entropyDelta":8,"choices":[{"text":"行动一","tone":"safe"},{"text":"行动二","tone":"danger"},{"text":"行动三","tone":"safe"}]}`;
}

function buildCollapsePrompt(payload) {
  const { event = {}, dynasty = {}, turn = 0, history = [] } = payload;
  return `场景：${dynasty.dynasty || ''} · ${event.locationName || ''} · ${event.year ?? ''} 年
事件：${event.title || ''}
玩家已经连续干预了 ${turn} 次，这条时间线再也承载不住。

已发生的经过：
${(history || []).slice(-12).map((h) => `- ${h}`).join('\n') || '-（无）'}

输出 JSON：
{"narrator":"崩坏正在发生的过程","ending":{"title":"短标题","text":"这条时间线最终变成了什么","epitaph":"墓志铭式短句"}}`;
}

function buildNpcPrompt(payload) {
  const { event = {}, dynasty = {}, npc = {}, turn = 0, history = [], playerText = '' } = payload;
  return `人物：${npc.name || '无名者'}（${npc.title || ''}）
地点：${event.locationName || ''}，${dynasty.dynasty || ''}，${event.year ?? ''}
现场：${event.rpgContext || ''}
已经聊了 ${turn} 轮。

此前的对话与行动（越靠后越近）：
${(history || []).slice(-12).map((h) => `- ${h}`).join('\n') || '-（刚见面）'}

玩家刚刚对他说：「${playerText || '（沉默，看着他）'}」

请给出这个人物接下来的一句台词，并判断这次对话对局势的影响。输出 JSON：
{"line":"...","mood":"...","info":"...","effects":{"stability":0,"alert":0},"entropyDelta":2}`;
}

async function requestCompletion(config, system, user, { temperature = 0.95, maxTokens = 700 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`模型返回 ${response.status}：${detail.slice(0, 200)}`);
    }
    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* 继续截取 */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
  }
  return null;
}

/**
 * 推演一次行动。
 * @returns {Promise<{ok:true, data:object} | {ok:false, error:string}>}
 */
export async function simulateWithAI(payload) {
  const config = aiConfig();
  if (!config.enabled) return { ok: false, error: '未配置 LLM_API_KEY（请在 .env 中填写）' };

  const collapse = (payload.turn || 0) >= COLLAPSE_TURN;
  try {
    const content = collapse
      ? await requestCompletion(config, COLLAPSE_SYSTEM, buildCollapsePrompt(payload), { temperature: 0.9, maxTokens: 500 })
      : await requestCompletion(config, SIM_SYSTEM, buildSimPrompt(payload), { temperature: 0.95, maxTokens: 600 });

    const parsed = extractJson(content);
    const normalized = normalizeSimulation({ ...parsed, kind: collapse ? 'collapse' : 'continue' });
    if (!normalized) return { ok: false, error: '模型返回的内容无法解析，请重试' };
    return { ok: true, data: normalized };
  } catch (error) {
    console.warn('[ai] 推演失败：', error.message);
    return { ok: false, error: error.message || '模型调用失败' };
  }
}

/** 生成人物下一句台词。 */
export async function npcWithAI(payload) {
  const config = aiConfig();
  if (!config.enabled) return { ok: false, error: '未配置 LLM_API_KEY（请在 .env 中填写）' };
  try {
    const content = await requestCompletion(config, NPC_SYSTEM, buildNpcPrompt(payload), { temperature: 1, maxTokens: 260 });
    const normalized = normalizeNpcResponse(extractJson(content));
    if (!normalized) return { ok: false, error: '模型返回的内容无法解析，请重试' };
    return { ok: true, data: normalized };
  } catch (error) {
    console.warn('[ai] 对话失败：', error.message);
    return { ok: false, error: error.message || '模型调用失败' };
  }
}
