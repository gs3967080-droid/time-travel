/**
 * 服务端数据装载：读取 src/data/ 下 A 交付的 JSON / 文案，
 * 交给与前端共用的 shared/dataContract.js 归一化，再交给 store 入库。
 *
 * A 的数据只放一处（src/data/mockData.json），浏览器和 SQLite 读到的内容完全一致。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDataFiles } from '../shared/dataContract.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..');
export const DATA_DIR = path.join(ROOT, 'frontend', 'src', 'data');
export const STORE_DIR = path.join(ROOT, 'database', 'data');
export const DIST_DIR = path.join(ROOT, 'dist');
export const DB_PATH = path.join(STORE_DIR, 'time-travel.db');
export const JSON_STORE_PATH = path.join(STORE_DIR, 'store.json');

export function loadSeedData() {
  const entries = [];
  try {
    for (const name of fs.readdirSync(DATA_DIR)) {
      if (!/\.(json|txt)$/i.test(name)) continue;
      const file = path.join(DATA_DIR, name);
      if (!fs.statSync(file).isFile()) continue;
      entries.push({
        name,
        content: fs.readFileSync(file, 'utf8'),
        kind: /\.txt$/i.test(name) ? 'txt' : 'json',
      });
    }
  } catch (error) {
    console.warn('[seed] 读取 src/data 失败，将使用内置演示数据：', error.message);
  }
  return parseDataFiles(entries);
}

export function ensureStoreDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}
