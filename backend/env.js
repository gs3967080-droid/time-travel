/**
 * 极简 .env 读取（零依赖，存在才读，不覆盖已设置的环境变量）
 * 这样接入 AI 时只要在项目根目录放一个 .env，不必改启动命令。
 */
import fs from 'node:fs';

export function loadEnvFile(file) {
  try {
    if (!fs.existsSync(file)) return false;
    const text = fs.readFileSync(file, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    return true;
  } catch (error) {
    console.warn('[env] .env 读取失败：', error.message);
    return false;
  }
}
