/**
 * 全栈共享数据契约（纯 ESM，零浏览器 API、零 Vite API、零 Node 依赖）
 *
 * 前端 src/data/loadData.js 与后端 server/seed.js 都调用这里，
 * 保证「A 交付的一份 JSON」在浏览器和 SQLite 里得到完全一致的归一化结果。
 *
 * 铁律（策划书第 5 节）：空数据 / 假数据 / 字段缺失 / 语法错误都不能让任何一端崩掉。
 */

import { FALLBACK_DYNASTIES, FALLBACK_INTRO } from './fallback.js';

export { FALLBACK_DYNASTIES, FALLBACK_INTRO };

const PALETTE = ['#D4AF37', '#00FFFF', '#8A2BE2', '#FF3B3B'];
const DEFAULT_CENTER = { lat: 35, lng: 105 };

function num(value, fallback = NaN) {
  if (value === null || value === undefined || value === '') return fallback;
  const raw = typeof value === 'string' ? Number.parseFloat(value.replace(/[^\d.+-]/g, '')) : Number(value);
  return Number.isFinite(raw) ? raw : fallback;
}

function str(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[\da-f]{3,8}$/i.test(value.trim());
}

function coordsOf(source) {
  if (!source || typeof source !== 'object') return {};
  const pick = (obj) => ({
    lat: num(obj.lat ?? obj.latitude ?? obj.Lat, NaN),
    lng: num(obj.lng ?? obj.lon ?? obj.long ?? obj.longitude ?? obj.Lng, NaN),
  });
  if (Array.isArray(source.coords)) {
    return { lat: num(source.coords[0], NaN), lng: num(source.coords[1], NaN) };
  }
  if (source.coordinates) return pick(source.coordinates);
  return pick(source);
}

function guessTone(result, index) {
  if (/崩溃|警告|失败|偏移|战乱|熄灭|断裂|不可逆|锁定|异常|坍缩|撤回/.test(result)) return 'danger';
  if (/稳定|成功|完成|续命|归档|加固|韧性|生效|保存|通过/.test(result)) return 'safe';
  return index === 0 ? 'danger' : 'safe';
}

function normalizeOption(option, index) {
  if (typeof option === 'string') {
    return {
      text: str(option, `指令 ${index + 1}`),
      result: '系统提示：该分支剧情尚未写入数据，时间线保持原状。',
      tone: index === 0 ? 'danger' : 'safe',
    };
  }
  const o = option && typeof option === 'object' ? option : {};
  const text = str(o.text ?? o.label ?? o.option ?? o.title, `指令 ${index + 1}`);
  const result = str(o.result ?? o.outcome ?? o.description ?? o.desc, '系统提示：该分支剧情尚未写入数据，时间线保持原状。');
  const rawTone = o.tone;
  const tone = rawTone === 'safe' || rawTone === 'green'
    ? 'safe'
    : rawTone === 'danger' || rawTone === 'red'
      ? 'danger'
      : guessTone(result, index);
  return { text, result, tone };
}

function normalizeEvent(event, index, dynastyColor) {
  const e = event && typeof event === 'object' ? event : {};
  const { lat, lng } = coordsOf(e);
  const options = Array.isArray(e.options) && e.options.length
    ? e.options.slice(0, 4).map(normalizeOption)
    : [
        { text: '接入该时间线', result: '系统判定：分支已归档，等待后续剧情写入。', tone: 'safe' },
        { text: '撤回干预指令', result: '系统警告：指令已撤回，历史不为你停留。', tone: 'danger' },
      ];
  return {
    id: str(e.id, `event_${index}`),
    title: str(e.title ?? e.name, `未命名事件 ${index + 1}`),
    year: num(e.year ?? e.yearStart, NaN),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    locationName: str(e.locationName ?? e.location ?? e.place, '坐标未知'),
    rpgContext: str(e.rpgContext ?? e.context ?? e.description ?? e.desc, '叮！该节点的剧情数据尚未接入，系统只能读到一片噪声……'),
    options,
    color: isHexColor(e.color) ? e.color : dynastyColor,
  };
}

function normalizeDynasty(dynasty, index) {
  const d = dynasty && typeof dynasty === 'object' ? dynasty : {};
  const color = isHexColor(d.color) ? d.color : PALETTE[index % PALETTE.length];
  const rawEvents = Array.isArray(d.events) ? d.events : [];
  const events = rawEvents.map((event, i) => normalizeEvent(event, i, color));
  const geoEvents = events.filter((e) => e.lat !== null && e.lng !== null);
  const customCenter = coordsOf(d.center ?? d.capital ?? {});
  const center = Number.isFinite(customCenter.lat) && Number.isFinite(customCenter.lng)
    ? { lat: customCenter.lat, lng: customCenter.lng }
    : geoEvents.length
      ? {
          lat: geoEvents.reduce((sum, e) => sum + e.lat, 0) / geoEvents.length,
          lng: geoEvents.reduce((sum, e) => sum + e.lng, 0) / geoEvents.length,
        }
      : DEFAULT_CENTER;
  return {
    key: str(d.key ?? d.id, `${str(d.dynasty ?? d.name, 'dynasty')}_${index}`),
    dynasty: str(d.dynasty ?? d.name ?? d.title, `朝代 ${index + 1}`),
    yearStart: num(d.yearStart ?? d.start ?? d.from, NaN),
    yearEnd: num(d.yearEnd ?? d.end ?? d.to, NaN),
    color,
    caption: str(d.caption ?? d.subtitle ?? d.motto, ''),
    center,
    events,
  };
}

/** 把 A 可能给出的各种外壳结构拍平成一维朝代数组 */
export function toDynastyArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  for (const key of ['dynasties', 'eras', 'data', 'items', 'list', 'timeline']) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  if (Array.isArray(raw.events) || raw.dynasty || raw.name) return [raw];
  return [];
}

function extractIntro(raw) {
  if (!raw || typeof raw !== 'object') return '';
  return str(raw.intro ?? raw.opening ?? raw.openingLine ?? raw.prologue);
}

/**
 * 归一化单份数据（后端 API 响应也走这里）。
 * @returns {{ dynasties: Array, intro: string, hasData: boolean }}
 */
export function normalizeData(raw) {
  const list = toDynastyArray(raw);
  const dynasties = list
    .map(normalizeDynasty)
    .filter((d) => d.events.length > 0)
    .sort((a, b) => (a.yearStart || 0) - (b.yearStart || 0));
  return { dynasties, intro: extractIntro(raw), hasData: dynasties.length > 0 };
}

/**
 * 从若干文件条目里挑出最合适的一份数据。
 * @param {Array<{name: string, content: string, kind?: 'json'|'txt'}>} entries
 * @returns {{dynasties, intro, dataSource, isFallback, notes}}
 */
export function parseDataFiles(entries = []) {
  const parsedObjects = [];
  const candidates = [];
  const texts = [];
  const notes = [];

  for (const entry of entries) {
    if (!entry || typeof entry.content !== 'string') continue;
    // 模板文件只给 A 参考，不参与数据源竞争
    if (/(\.sample|\.example)\.json$/i.test(entry.name)) continue;
    if (entry.kind === 'txt' || /\.txt$/i.test(entry.name)) {
      texts.push({ name: entry.name, content: entry.content });
      continue;
    }
    try {
      const parsed = JSON.parse(entry.content);
      parsedObjects.push(parsed);
      const normalized = normalizeData(parsed);
      if (normalized.hasData) {
        candidates.push({
          name: entry.name,
          dynasties: normalized.dynasties,
          score: normalized.dynasties.reduce((sum, d) => sum + d.events.length, 0),
          preferred: /mockdata\.json$/i.test(entry.name),
        });
      }
    } catch (error) {
      notes.push(`${entry.name} 解析失败，已忽略：${error.message}`);
    }
  }

  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.score - a.score);
  const chosen = candidates[0];
  // 内置兜底数据同样过一遍归一化，保证 key / center / options 结构与外部 JSON 完全一致
  const fallback = normalizeData({ dynasties: FALLBACK_DYNASTIES, intro: FALLBACK_INTRO });
  const dynasties = chosen ? chosen.dynasties : fallback.dynasties;
  const dataSource = chosen ? chosen.name : '内置演示数据';

  let intro = '';
  for (const obj of parsedObjects) {
    intro = extractIntro(obj);
    if (intro) break;
  }
  if (!intro) {
    const preferredText = texts.find((t) => /opening|intro|prologue|开场/i.test(t.name)) || texts[0];
    intro = preferredText ? str(preferredText.content, FALLBACK_INTRO) : FALLBACK_INTRO;
  }

  if (!chosen) notes.push('未发现可用 JSON，当前使用内置演示数据（不影响演示路线）');
  return { dynasties, intro, dataSource, isFallback: !chosen, notes };
}

/** 供 3D / 2D 地球共用：把朝代数据拍平成带朝代信息的发光点 */
export function flattenEvents(dynasties = FALLBACK_DYNASTIES) {
  return dynasties.flatMap((dynasty, dynastyIndex) =>
    dynasty.events
      .filter((event) => event.lat !== null && event.lng !== null)
      .map((event) => ({ ...event, dynastyIndex, dynastyName: dynasty.dynasty, dynastyColor: dynasty.color })),
  );
}

/** 年份格式化（支持公元前负数）；空值用于数据库 nullable 字段 */
export function formatYear(value) {
  if (!Number.isFinite(value)) return '年代未录入';
  return value < 0 ? `公元前 ${Math.abs(value)} 年` : `公元 ${value} 年`;
}

/** SQLite 不接受 NaN / Infinity，入库前统一转成 null */
export function nullableNumber(value) {
  return Number.isFinite(value) ? value : null;
}
