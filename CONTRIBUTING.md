# 团队协作说明

仓库：<https://github.com/gs3967080-droid/time-travel>

## 第一次拉项目

```bash
git clone https://github.com/gs3967080-droid/time-travel.git
cd time-travel
npm install
```

复制环境变量模板（**不要提交 `.env`**）：

```bash
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux
```

在 `.env` 里填 `LLM_API_KEY`。不填也能打开页面，只是对话 / 行动推演会提示 AI 未就绪。

## 本地运行

| 命令 | 作用 | 地址 |
| --- | --- | --- |
| `npm run dev` | 只起前端（热更新） | http://localhost:5173 |
| `npm run server` | 后端 + 已构建前端，一体演示 | http://localhost:8787 |
| `npm run dev:all` | 同时起 Vite 5173 + API 8787 | 5173 |
| `npm run build` | 构建前端到 `dist/` | — |
| `npm run db:reset` | 重建 SQLite 并重新 seed | — |

一体演示推荐：`npm run build && npm run server`。

## 目录分工

```
frontend/   前端工程（Vite root）：入口、App、数据、请求适配
ui/         界面组件与全部视觉样式、截图
backend/    HTTP API、AI 适配、开发服务器
database/   SQLite / JSON 存储与 seed
shared/     前后端共享的数据契约、推演校验
scripts/    启动包装
docs/       策划书
```

改 UI 看 `ui/components` + `ui/styles/index.css`；改内容看 `frontend/src/data`；改 AI 行为看 `backend/ai.js` 与 `shared/simulator.js`。

## 分支与提交

`main` 保持可运行。每个人从最新 `main` 拉分支：

```bash
git switch main
git pull --rebase
git switch -c feat/你的功能
# 改代码
git add -A
git commit -m "feat: 一句话说明"
git push -u origin feat/你的功能
```

然后在 GitHub 上开 Pull Request，至少一个人看过再合并。合并前先 `git pull --rebase origin main` 解决冲突。

## 不要提交的东西

已在 `.gitignore` 里忽略，别用 `git add -f` 强行加：

- `.env`（模型 Key）
- `node_modules/`
- `dist/`
- `database/data/*.db`、`store.json`
- `.tmp/`

## 数据和地图

- 朝代 / 事件 / 人物：`frontend/src/data/mockData.json`
- 现场人物与区划热点：`frontend/src/data/sceneProfiles.js`
- 历史地图：`frontend/src/data/historicalMaps/{qin,tang,qing}.json`
- 地图数据来源与许可证：根目录 `THIRD_PARTY_NOTICES.md`（GPL-3.0，改动地图数据时请保留声明）

改完数据后跑一次 `npm run db:reset`，后端统计和抉择记录会用新数据重新 seed。
