/** 清空数据库并重新 seed：npm run db:reset */
import fs from 'node:fs';
import { DB_PATH, JSON_STORE_PATH } from './seed.js';

const files = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`, JSON_STORE_PATH];
for (const file of files) {
  try {
    if (fs.existsSync(file)) {
      fs.rmSync(file);
      console.log(`已删除 ${file}`);
    }
  } catch (error) {
    console.warn(`删除失败 ${file}：${error.message}`);
  }
}

const { createStore } = await import('./store.js');
const store = await createStore();
const stats = store.getStats();
console.log(`重建完成：${stats.anchors} 个历史锚点，${stats.sessions} 个会话，${stats.total} 条抉择`);
store.close();
