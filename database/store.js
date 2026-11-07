/**
 * 数据持久层：SQLite 优先，不可用时自动降级为 JSON 文件存储。
 * 两套实现暴露完全相同的方法，HTTP 层不关心底层引擎。
 *
 * 表设计：
 *   dynasties / events / options  —— 内容表，每次启动按 src/data 的最新 JSON 幂等重刷
 *   sessions  / choices           —— 用户行为表，跨重启保留（抉择不依赖外键，重刷内容不会丢历史）
 *   meta                         —— 开场白、数据源标记、seed 时间
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DB_PATH, JSON_STORE_PATH, ensureStoreDir, loadSeedData } from './seed.js';
import { nullableNumber } from '../shared/dataContract.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dynasties (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year_start INTEGER,
  year_end INTEGER,
  color TEXT,
  caption TEXT,
  center_lat REAL,
  center_lng REAL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  event_key TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  dynasty_key TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER,
  lat REAL,
  lng REAL,
  location_name TEXT,
  rpg_context TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_events_dynasty ON events(dynasty_key);
CREATE TABLE IF NOT EXISTS options (
  event_key TEXT NOT NULL,
  idx INTEGER NOT NULL,
  text TEXT NOT NULL,
  result TEXT NOT NULL,
  tone TEXT NOT NULL,
  PRIMARY KEY (event_key, idx)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE TABLE IF NOT EXISTS choices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  event_id TEXT NOT NULL,
  event_title TEXT,
  dynasty TEXT,
  option_index INTEGER NOT NULL,
  option_text TEXT,
  tone TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_choices_session ON choices(session_id);
`;

function now() {
  return new Date().toISOString();
}

function eventKey(dynastyKey, sourceId, index) {
  return `${dynastyKey}:${sourceId || `event_${index}`}`;
}

/* ---------------------------------- SQLite --------------------------------- */

function createSqliteStore(DatabaseSync, seed) {
  ensureStoreDir();
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);

  // 幂等 seed：内容表全量刷新，行为表保留
  const insDynasty = db.prepare(
    'INSERT INTO dynasties (key,name,year_start,year_end,color,caption,center_lat,center_lng,sort_order) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  const insEvent = db.prepare(
    'INSERT INTO events (event_key,source_id,dynasty_key,title,year,lat,lng,location_name,rpg_context,color,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
  );
  const insOption = db.prepare(
    'INSERT INTO options (event_key,idx,text,result,tone) VALUES (?,?,?,?,?)',
  );
  const insMeta = db.prepare(
    'INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM options');
    db.exec('DELETE FROM events');
    db.exec('DELETE FROM dynasties');
    seed.dynasties.forEach((dynasty, dIndex) => {
      insDynasty.run(
        dynasty.key,
        dynasty.dynasty,
        nullableNumber(dynasty.yearStart),
        nullableNumber(dynasty.yearEnd),
        dynasty.color || null,
        dynasty.caption || null,
        nullableNumber(dynasty.center?.lat),
        nullableNumber(dynasty.center?.lng),
        dIndex,
      );
      dynasty.events.forEach((event, eIndex) => {
        const key = eventKey(dynasty.key, event.id, eIndex);
        insEvent.run(
          key,
          event.id,
          dynasty.key,
          event.title,
          nullableNumber(event.year),
          nullableNumber(event.lat),
          nullableNumber(event.lng),
          event.locationName || null,
          event.rpgContext || null,
          event.color || null,
          eIndex,
        );
        event.options.forEach((option, oIndex) => {
          insOption.run(key, oIndex, option.text, option.result, option.tone || 'danger');
        });
      });
    });
    insMeta.run('intro', seed.intro || '');
    insMeta.run('dataSource', `${seed.dataSource} · SQLite`);
    insMeta.run('isFallback', String(seed.isFallback));
    insMeta.run('seededAt', now());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const selectDynasties = db.prepare('SELECT * FROM dynasties ORDER BY sort_order');
  const selectEvents = db.prepare('SELECT * FROM events WHERE dynasty_key = ? ORDER BY sort_order');
  const selectOptions = db.prepare('SELECT idx,text,result,tone FROM options WHERE event_key = ? ORDER BY idx');

  function shapeEvent(row) {
    return {
      id: row.source_id,
      title: row.title,
      year: row.year,
      lat: row.lat,
      lng: row.lng,
      locationName: row.location_name || '坐标未知',
      rpgContext: row.rpg_context || '',
      color: row.color,
      options: selectOptions.all(row.event_key).map((o) => ({
        text: o.text,
        result: o.result,
        tone: o.tone,
      })),
    };
  }

  function getDynasties() {
    return selectDynasties.all().map((row) => ({
      key: row.key,
      dynasty: row.name,
      yearStart: row.year_start,
      yearEnd: row.year_end,
      color: row.color,
      caption: row.caption || '',
      center: { lat: row.center_lat ?? 35, lng: row.center_lng ?? 105 },
      events: selectEvents.all(row.key).map(shapeEvent),
    }));
  }

  function getMeta() {
    const result = {};
    for (const row of db.prepare('SELECT key,value FROM meta').all()) result[row.key] = row.value;
    return result;
  }

  return {
    engine: 'sqlite',
    path: DB_PATH,
    getMeta,
    getDynasties,
    getEvents(dynastyKey) {
      const rows = dynastyKey
        ? db.prepare('SELECT * FROM events WHERE dynasty_key = ? ORDER BY sort_order').all(dynastyKey)
        : db.prepare('SELECT * FROM events ORDER BY sort_order').all();
      return rows.map(shapeEvent);
    },
    getEvent(id) {
      const row = db.prepare('SELECT * FROM events WHERE source_id = ? LIMIT 1').get(String(id || ''));
      return row ? shapeEvent(row) : null;
    },
    createSession(userAgent) {
      const session = { id: randomUUID(), createdAt: now(), userAgent: String(userAgent || '').slice(0, 200) };
      db.prepare('INSERT INTO sessions (id,created_at,user_agent) VALUES (?,?,?)')
        .run(session.id, session.createdAt, session.userAgent);
      return session;
    },
    addChoice(payload) {
      const choice = {
        sessionId: payload.sessionId ? String(payload.sessionId).slice(0, 100) : null,
        eventId: String(payload.eventId || 'unknown').slice(0, 120),
        eventTitle: String(payload.eventTitle || '').slice(0, 200),
        dynasty: String(payload.dynasty || '').slice(0, 80),
        optionIndex: Number.isInteger(payload.optionIndex) ? payload.optionIndex : 0,
        optionText: String(payload.optionText || '').slice(0, 300),
        tone: payload.tone === 'safe' ? 'safe' : 'danger',
        createdAt: now(),
      };
      const result = db.prepare(
        'INSERT INTO choices (session_id,event_id,event_title,dynasty,option_index,option_text,tone,created_at) VALUES (?,?,?,?,?,?,?,?)',
      ).run(
        choice.sessionId, choice.eventId, choice.eventTitle, choice.dynasty,
        choice.optionIndex, choice.optionText, choice.tone, choice.createdAt,
      );
      return { id: Number(result.lastInsertRowid), ...choice };
    },
    listChoices(sessionId, limit = 100) {
      const rows = sessionId
        ? db.prepare('SELECT * FROM choices WHERE session_id = ? ORDER BY id DESC LIMIT ?').all(sessionId, limit)
        : db.prepare('SELECT * FROM choices ORDER BY id DESC LIMIT ?').all(limit);
      return rows.map(rowToChoice);
    },
    getStats() {
      const totals = db.prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN tone='safe' THEN 1 ELSE 0 END),0) AS safe,
                COALESCE(SUM(CASE WHEN tone='danger' THEN 1 ELSE 0 END),0) AS danger
         FROM choices`,
      ).get();
      const sessions = db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;
      const anchors = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
      return {
        total: totals.total,
        safe: totals.safe,
        danger: totals.danger,
        deviationRate: totals.total ? Math.round((totals.danger / totals.total) * 100) : 0,
        sessions,
        anchors,
        byDynasty: db.prepare('SELECT dynasty AS name, COUNT(*) AS count FROM choices GROUP BY dynasty ORDER BY count DESC').all(),
        byEvent: db.prepare('SELECT event_title AS name, COUNT(*) AS count FROM choices GROUP BY event_title ORDER BY count DESC LIMIT 10').all(),
      };
    },
    close() {
      try { db.close(); } catch { /* 已关闭 */ }
    },
  };
}

function rowToChoice(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    dynasty: row.dynasty,
    optionIndex: row.option_index,
    optionText: row.option_text,
    tone: row.tone,
    createdAt: row.created_at,
  };
}

/* ------------------------------- JSON 降级存储 ------------------------------- */

function createJsonStore(seed) {
  ensureStoreDir();
  let state = { sessions: [], choices: [], seq: 0 };
  try {
    if (fs.existsSync(JSON_STORE_PATH)) {
      const saved = JSON.parse(fs.readFileSync(JSON_STORE_PATH, 'utf8'));
      state = { ...state, ...saved };
    }
  } catch (error) {
    console.warn('[db] store.json 读取失败，重建：', error.message);
  }

  const persist = () => {
    try { fs.writeFileSync(JSON_STORE_PATH, JSON.stringify(state, null, 2), 'utf8'); }
    catch (error) { console.warn('[db] 写入 store.json 失败：', error.message); }
  };
  const meta = {
    intro: seed.intro,
    dataSource: `${seed.dataSource} · JSON 降级`,
    isFallback: String(seed.isFallback),
    seededAt: now(),
  };
  const dynasties = seed.dynasties;
  const allEvents = () => dynasties.flatMap((d) => d.events);

  return {
    engine: 'json-file',
    path: JSON_STORE_PATH,
    getMeta: () => ({ ...meta }),
    getDynasties: () => dynasties,
    getEvents: (dynastyKey) => dynastyKey
      ? (dynasties.find((d) => d.key === dynastyKey)?.events || [])
      : allEvents(),
    getEvent: (id) => allEvents().find((e) => e.id === String(id)) || null,
    createSession(userAgent) {
      const session = { id: randomUUID(), createdAt: now(), userAgent: String(userAgent || '').slice(0, 200) };
      state.sessions.push(session);
      persist();
      return session;
    },
    addChoice(payload) {
      state.seq += 1;
      const choice = {
        id: state.seq,
        sessionId: payload.sessionId ? String(payload.sessionId).slice(0, 100) : null,
        eventId: String(payload.eventId || 'unknown').slice(0, 120),
        eventTitle: String(payload.eventTitle || '').slice(0, 200),
        dynasty: String(payload.dynasty || '').slice(0, 80),
        optionIndex: Number.isInteger(payload.optionIndex) ? payload.optionIndex : 0,
        optionText: String(payload.optionText || '').slice(0, 300),
        tone: payload.tone === 'safe' ? 'safe' : 'danger',
        createdAt: now(),
      };
      state.choices.push(choice);
      persist();
      return choice;
    },
    listChoices: (sessionId, limit = 100) => state.choices
      .filter((c) => !sessionId || c.sessionId === sessionId)
      .slice(-limit)
      .reverse(),
    getStats() {
      const total = state.choices.length;
      const safe = state.choices.filter((c) => c.tone === 'safe').length;
      const danger = total - safe;
      const group = (key) => Object.entries(
        state.choices.reduce((acc, c) => { acc[c[key]] = (acc[c[key]] || 0) + 1; return acc; }, {}),
      ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      return {
        total, safe, danger,
        deviationRate: total ? Math.round((danger / total) * 100) : 0,
        sessions: state.sessions.length,
        anchors: allEvents().length,
        byDynasty: group('dynasty'),
        byEvent: group('eventTitle').slice(0, 10),
      };
    },
    close() { persist(); },
  };
}

/** 自动选择可用引擎 */
export async function createStore() {
  const seed = loadSeedData();
  try {
    const sqlite = await import('node:sqlite');
    if (!sqlite.DatabaseSync) throw new Error('DatabaseSync 不可用');
    const store = createSqliteStore(sqlite.DatabaseSync, seed);
    console.log(`[db] SQLite 已就绪 → ${path.relative(process.cwd(), DB_PATH)}`);
    console.log(`[db] 数据源：${seed.dataSource} · ${seed.dynasties.length} 朝代 / ${seed.dynasties.reduce((n, d) => n + d.events.length, 0)} 锚点`);
    return store;
  } catch (error) {
    console.warn('[db] SQLite 初始化失败，降级为 JSON 文件存储：', error.message);
    console.warn(error.stack);
    return createJsonStore(seed);
  }
}
