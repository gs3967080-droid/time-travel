/**
 * 推演数据结构与校验（前后端共用，纯 ESM、零依赖）
 *
 * 本版本移除了「内置剧情 / 本地台词池」：剧情一律由 AI 生成。
 * 这里只保留：
 *   - 崩溃规则常量（第几幕之后世界线撑不住）
 *   - 模型返回结果的校验与裁剪（防止模型乱返回把前端搞崩）
 */

/** 走到第几幕之后，时间线开始崩溃 */
export const COLLAPSE_TURN = 9;

/** 崩坏度上限 */
export const MAX_ENTROPY = 100;

/** 校验一次推演结果：continue（继续）或 collapse（崩坏结局） */
export function normalizeSimulation(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const narrator = String(raw.narrator || raw.narration || '').trim();
  if (!narrator) return null;

  const kind = raw.kind === 'collapse' || raw.ending ? 'collapse' : 'continue';

  if (kind === 'collapse') {
    const ending = raw.ending && typeof raw.ending === 'object' ? raw.ending : {};
    const text = String(ending.text || '').trim();
    if (!text) return null;
    return {
      kind: 'collapse',
      narrator: narrator.slice(0, 400),
      npcLine: String(raw.npcLine || '').slice(0, 220),
      ending: {
        title: String(ending.title || '时间线崩坏').slice(0, 40),
        text: text.slice(0, 400),
        epitaph: String(ending.epitaph || '').slice(0, 40),
      },
      choices: [],
      effects: { stability: -40, alert: 40 },
      entropyDelta: 100,
    };
  }

  const choices = Array.isArray(raw.choices)
    ? raw.choices
        .filter((item) => item && typeof item.text === 'string' && item.text.trim())
        .slice(0, 4)
        .map((item, index) => ({
          id: String(item.id || `ai-${index}`),
          text: String(item.text).slice(0, 60),
          tone: item.tone === 'danger' ? 'danger' : 'safe',
        }))
    : [];
  if (choices.length < 2) return null;

  return {
    kind: 'continue',
    narrator: narrator.slice(0, 400),
    npcLine: String(raw.npcLine || '').slice(0, 220),
    choices,
    effects: {
      stability: Number.isFinite(raw.effects?.stability) ? Math.max(-30, Math.min(30, raw.effects.stability)) : 0,
      alert: Number.isFinite(raw.effects?.alert) ? Math.max(-30, Math.min(30, raw.effects.alert)) : 0,
    },
    entropyDelta: Number.isFinite(raw.entropyDelta) ? Math.max(0, Math.min(12, raw.entropyDelta)) : 8,
  };
}

/** 校验人物台词（含这次对话带来的影响） */
export function normalizeNpcResponse(raw) {
  if (!raw) return null;
  const line = String(raw.line || raw.text || '').trim();
  if (!line) return null;
  const clamp = (value, min, max) => (Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : 0);
  return {
    line: line.slice(0, 400),
    mood: String(raw.mood || '').slice(0, 24),
    info: String(raw.info || '').slice(0, 160),
    effects: {
      stability: clamp(raw.effects?.stability, -15, 15),
      alert: clamp(raw.effects?.alert, -15, 15),
    },
    entropyDelta: clamp(raw.entropyDelta, 0, 6),
  };
}

/** 兼容旧调用 */
export function normalizeNpcLine(raw) {
  const result = normalizeNpcResponse(raw);
  return result ? { line: result.line } : null;
}
