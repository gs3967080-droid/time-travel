# 时空跃迁 · 历史枢纽

赛博古风 + 网文系统穿越流的沉浸式 Web 体验：右侧时间轴滚动 → 左侧 3D 地球飞行定位 → 点击发光点 → 系统弹窗抉择。

> 数据层仍然本地优先：首屏零延迟，断网也能看到地球与时间轴。
> 但**落地后的对话与推演由 AI 实时生成**，需要后端 + 模型 Key —— 这是刻意的，不再用内置台词敷衍。

---

## 一、目录结构

只借鉴 A 的三样东西：**历史地图、人物关系星图、时间轴滑轨**。
开场页、事件列表、现场人物、系统面板、字体全部是我们原来的设计。

```
time-travel/
├─ frontend/                        前端工程（Vite root）
│  ├─ index.html                    页面入口
│  ├─ vite.config.js                Vite 配置（产物输出到根 dist/）
│  ├─ tailwind.config.js            Tailwind 配置（扫描 frontend + ui）
│  ├─ postcss.config.js
│  ├─ public/                       favicon、地球贴图
│  └─ src/
│     ├─ main.jsx                   React 挂载入口
│     ├─ App.jsx                    页面编排：开场 → 枢纽 → 落地场景 → 人物星图
│     └─ data/
│        ├─ mockData.json           ★ 三朝代内容、人物与关系（A 的数据）
│        ├─ appCopy.json            文案（开场白、标签）
│        ├─ historicalMaps.js       历史地图加载器
│        ├─ historicalMaps/         秦 / 唐 / 清 行政区划与疆域数据
│        └─ apiClient.js            后端适配器（推演 / 对话 / 抉择落库）
│
├─ ui/                              界面（沿用 A 的设计语言）
│  ├─ components/
│  │  ├─ IntroScreen.jsx            开场页
│  │  ├─ GlobeStage.jsx             3D 地球 + 历史地图 + 区划列表 / 2D 降级
│  │  ├─ Timeline.jsx               时间跃迁舱（A 的滑轨 + 我们的事件列表）
│  │  ├─ CharacterGraphModal.jsx    人物关系星图
│  │  ├─ LandingScene.jsx            ★ 落地场景：沉浸式现场 + 对话 / 行动 + AI 推演 + 崩坏结局
│  │  └─ TypewriterText.jsx         打字机
│  ├─ styles/index.css              全部视觉样式
│  └─ screenshots/                  预览截图
│
├─ backend/                         服务端
│  ├─ index.js                      HTTP 服务、REST 路由、静态托管 dist/
│  ├─ ai.js                         DeepSeek / OpenAI 兼容适配（推演 + 对话 + 崩坏）
│  ├─ env.js                        .env 读取
│  └─ dev.js                        一条命令拉起前后端
│
├─ database/                        数据层
│  ├─ store.js                      SQLite / JSON 双实现
│  ├─ seed.js                       读取 frontend/src/data 交给共享契约
│  ├─ reset.js                      重建数据库
│  └─ data/                         运行时数据库（已 gitignore）
│
├─ shared/                          前后端共享
│  ├─ simulator.js                  推演结构校验、崩溃阈值
│  └─ dataContract.js               数据归一化（后端 seed 用）
│
├─ scripts/run.js                   启动包装（TEMP 重定向到 .tmp/）
├─ docs/项目策划书.md                策划书原文
└─ dist/                            构建产物（已 gitignore）
```
---

## 二、快速开始

```bash
npm install                 # 安装依赖
npm run dev                 # 前端 5173（热更新；接口指向 8787）
npm run server              # 后端 8787（API + 已构建前端，一体演示）
npm run dev:all             # 一条命令起全栈：Vite 5173 + API 8787
npm run build               # 构建前端到 dist/
npm run db:reset            # 清库并重新 seed
```

**一体演示（推荐）**：`npm run build && npm run server` → 打开 `http://localhost:8787`，一个端口就是完整产品（页面 + API + SQLite）。

> 对话与推演需要模型：`.env` 里填好 `LLM_API_KEY`（当前已配置 DeepSeek）。
> 没配也能打开页面看地球与时间轴，但点击事件后会提示 AI 未就绪。

---

## 三、架构

```
浏览器（React 18 + Vite 5）
 ├─ frontend/src/App.jsx           编排：开场 → 枢纽 → 落地场景 → 人物星图
 ├─ ui/components/IntroScreen.jsx   开场页
 ├─ ui/components/GlobeStage.jsx    3D 地球 + 历史地图 + 区划列表（无 WebGL 时降级为平面点位）
 ├─ ui/components/Timeline.jsx      时间跃迁舱（拖动 / 滚轮 / 方向键切朝代）
 ├─ ui/components/CharacterGraphModal.jsx  人物关系星图
 ├─ ui/components/LandingScene.jsx 落地场景：现场环境 + 人物 + 对话 / 行动 + AI 推演 + 崩坏
 └─ frontend/src/data/apiClient.js  只负责调后端（推演 / 对话 / 落库）
                        │  HTTP /api/*
backend/index.js   Node 22+
 ├─ REST API + CORS + 静态托管 dist/
 ├─ ai.js          DeepSeek / OpenAI 兼容：推演、对话、崩坏结局
 └─ database/store.js → node:sqlite（真 SQLite）/ JSON 降级
                        │
shared/simulator.js  推演结构校验 + 崩溃阈值（前后端共用）
frontend/src/data/mockData.json  三朝代内容、人物与关系（A 交付）
```

**剧情必须联网**：地球、时间轴、人物关系、历史地图都能离线看；但人物对话与行动推演由 AI 实时生成，没有后端 / 没配 Key 时会提示失败，而不是用内置台词糊弄。

---

## 四、设计与数据来源

| 部分 | 来源 |
| --- | --- |
| **开场页** | 我们的版本（赛博古风、网格、衬线大标题 + 打字机开场白） |
| **字体** | 我们的方案：衬线 `Noto Serif SC / Songti SC / STSong`，等宽 `JetBrains Mono / Cascadia Code` |
| **历史地图** | 借鉴 A（疆域数据与地图刻画），并改成点亮大陆：朝代色发光填充 + 地球仪比例 |
| **人物关系星图** | 借鉴 A（5 人物 + 关系线 + 档案面板） |
| **时间轴滑轨** | 借鉴 A（拖动 / 滚轮 / 方向键切朝代） |
| **历史锚点列表** | 我们的设计：**只显示当前朝代的 3 个事件**，不混入其他朝代 |
| **现场人物** | 我们的设计：每个事件配一位 NPC（李斯 / 陈九 / 吴广 / 和珅 / 林伯…），AI 扮演他回应 |
| **落地场景** | 我们的玩法 + A 的版式：现场环境 + 人物 + 对话 / 行动两个标签，AI 推演 + 第 9 幕崩坏 |

数据文件：

- `frontend/src/data/mockData.json`：秦 / 唐 / 清，各含 `people`、`relations`、3 个 `events`
  - 秦：秦统六合（A） / 焚书坑儒 / 大泽乡起义
  - 唐：安史之乱（A） / 范阳起兵 / 鉴真东渡
  - 清：虎门销烟（A） / 军机处设立 / 武昌首义
- `frontend/src/data/sceneProfiles.js`：9 个事件的现场人物与台词
- `frontend/src/data/historicalMaps/{qin,tang,qing}.json`：历史地图
- `frontend/src/data/appCopy.json`：开场白与界面文案

要加朝代或事件，直接在 `mockData.json` 里加一项（`mapKey` 对应 `historicalMaps.js` 的键）；如果在 `sceneProfiles.js` 里加一条对应的人物脚本，落地场景就会用上。

---
## 五、REST API

统一响应：`{ ok: true, data: ... }` / `{ ok: false, error: "..." }`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 引擎、数据库路径、seed 时间、锚点数 |
| GET | `/api/bootstrap` | 一次性返回全部朝代 + 事件 + 开场白（前端首屏探测用） |
| GET | `/api/dynasties` | 朝代列表（含嵌套事件与选项） |
| GET | `/api/events?dynasty=<key>` | 事件列表，可按朝代过滤 |
| GET | `/api/events/:id` | 单个事件详情 |
| POST | `/api/sessions` | 创建一次跃迁会话，返回 `{ id }` |
| POST | `/api/choices` | 记录宿主抉择（eventId / optionIndex / tone / dynasty…） |
| GET | `/api/choices?sessionId=&limit=` | 抉择记录 |
| GET | `/api/choices/stats` | 总抉择数、时间线偏移率、按朝代/事件聚合 |

---

## 六、数据库

`database/data/time-travel.db`（SQLite，Node 22+ 内置 `node:sqlite`，无需编译任何原生模块；已加入 `.gitignore`）。

| 表 | 用途 |
| --- | --- |
| `dynasties` | 朝代、起止年、主题色、中心坐标、排序 |
| `events` | 历史锚点：经纬度、地点、RPG 剧情、所属朝代 |
| `options` | 每个锚点的抉择项与结果文案、tone |
| `sessions` | 每次跃迁会话 |
| `choices` | 用户抉择流水（冗余存事件标题/朝代，重刷内容不丢历史） |
| `meta` | 开场白、数据源标记、seed 时间 |

- 启动时**幂等 seed**：内容表按 `frontend/src/data` 最新 JSON 全量刷新，行为表（sessions/choices）保留。
- 若 `node:sqlite` 不可用（Node 版本过低），自动降级为 `database/data/store.json`，API 行为完全一致。
- 所有写入均使用参数化语句，请求体限 64 KB，输入做了长度截断。

---

## 七、降级策略

1. **无后端** → 开场页、地球、历史地图、时间轴、人物星图都能用；打开事件后点对话/行动会提示「AI 未就绪」，不会伪造剧情。
2. **无 WebGL** → `GlobeStage` 自动切到 `GlobeFallback`（网格地球 + 可点坐标），地图与点位照常。
3. **无 SQLite** → 抉择记录降级为 JSON 文件。
4. **模型超时 / 报错 / 余额不足** → 面板内提示「推演失败…请重试」，对话历史保留，可原地重试。

---

## 八、演示路线

开场页 → 点「接入时间线」→ 枢纽主界面（历史地图 + 时间轴 + 人物关系入口）→ 拖动时间轴切朝代（秦 / 唐 / 清，地球与地图同步切换）→ 点「已锁定」的事件或地球上的坐标点 → **落地场景** → 在「对话」里和现场人物说话 / 在「行动」里做干预 → AI 推演后果 → 一路推到第 9 幕，世界线崩溃，看到结局 → 返回校正台。

点击地图上的疆域色块会定位到最近的一级行政区；左下角「展开区划列表」可以浏览该朝代的全部郡 / 道 / 省，点列表项直接飞过去。

右上角「关系星图」可以看到该朝代的 5 位人物与 6 条关系。

---

## 九、落地场景（原来的沉浸式时间交互 + AI）

点历史锚点或地球坐标后，不再弹居中弹窗，而是整个视界沉入现场：程序化生成的 2.5D 场景（天幕 / 山峦 / 宫阙 / 火把 / 天气粒子 / 人物剪影），底部一块现场面板承接剧情。面板沿用我们的版式，内容由 AI 现场生成：

| 区域 | 内容 |
| --- | --- |
| 顶部 | 朝代、地点、事件标题与年份；右侧三条局势条 + 当前幕数 / 线索 |
| 现场 | 人物剪影（呼吸 / 火把光晕）、可点击的 ◇ 观察热点、雾与天气粒子 |
| **对话** 标签 | 自由输入想说的话；AI 扮演人物回应，附情绪（戒备 / 松动 / 回避）、线索、以及对局势的影响 |
| **行动** 标签 | 选一个行动 → AI 写「此刻」发生什么 → 同时给出 3 个新行动；可随时切回「继续和他说话」 |
| 崩坏 | 干预到第 9 幕，场景抖动、红闪，AI 生成结局（标题 / 经过 / 墓志铭） |

对话与行动分开记录、互不混排；两边产生的影响都会实时改动状态条。
## 十、AI 驱动剧情

### 玩法：对话与行动是两个独立功能

落地之后，剧情完全由 AI 现场生成，没有内置台词和 mock 数据。面板上分成两个互不干扰的标签页：

**「对话」—— 你自己决定说什么**

- 输入框自由输入（Enter 发送），也可以用上面三个快捷句
- AI 扮演场景人物回应你，并给出：情绪（戒备 / 松动 / 回避）、**这次对话透露的线索**、以及这次对话对局势的影响（稳定度 / 警觉度 / 崩坏度）
- 对话记录独立保留，可以一直聊下去，也可以来回翻

**「行动」—— 从 AI 给出的选项里选**

- 每次选择一个行动，AI 立刻写「此刻发生了什么」（只写当下几分钟）
- 同时生成 3 个新的可选行动（历史上没有的），接着选
- 行动记录独立保留，和对话互不混排

**两者的结果都会改变局势**：稳定度、警觉度、世界线崩坏度实时变化。行动累计到第 9 幕，时间线崩溃，AI 生成结局（标题 / 崩坏过程 / 墓志铭），然后返回时间线。

| 状态 | 含义 |
| --- | --- |
| 时间线稳定度 | 你的干预是在稳住局面还是在拆台 |
| 系统警觉度 | 周围的人对你起疑的程度 |
| 世界线崩坏度 | 累积到 100 或第 9 幕，世界线崩坏 |
### 接入 / 更换模型

`.env` 已经配置好 DeepSeek，换模型或换服务商只改这三行：

```ini
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-你的Key
LLM_MODEL=deepseek-chat
```

改完重启后端：`npm run server`。确认是否生效：

```bash
curl http://localhost:8787/api/ai/status
# { "ok": true, "data": { "enabled": true, "model": "deepseek-chat", ... } }
```

- Ollama 本地模型：`LLM_BASE_URL=http://127.0.0.1:11434/v1`、`LLM_API_KEY=ollama`、`LLM_MODEL=qwen2.5:7b`
- 需要代理访问模型接口：`.env` 里加 `HTTPS_PROXY=http://127.0.0.1:7897`，用 `npm run server:proxy` 启动
- 模型调用失败时，界面会提示"推演失败…请重试"，不会再伪造剧情

### 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/simulate` | 一次行动 → `{ kind:'continue', narrator, npcLine, choices, effects, entropyDelta }`；第 9 幕起返回 `{ kind:'collapse', narrator, ending }` |
| POST | `/api/npc/talk` | 玩家自由发言 → `{ kind:'line', line, mood, info, effects, entropyDelta }` |
| GET | `/api/ai/status` | AI 是否就绪（`enabled` / `model` / `collapseTurn`） |

---
## 十一、分工与状态

| 角色 | 状态 |
| --- | --- |
| A · 产品与设计 | **设计与数据已并入主线**：`IntroScreen` / `GlobeStage`（历史地图）/ `Timeline` / `CharacterGraphModal` / 全套 `styles.css` / `mockData.json`（含人物与关系） |
| B · 前端拼装 | 在 A 的设计上接入后端：`LandingScene` 承接对话与行动，`apiClient` 负责推演 / 对话 / 抉择落库 |
| C · 测试与演示 | 视觉特效沿用 A 的样式；AI 推演链路（对话 / 行动 / 崩坏）已实测 |

> 原始交付物保留在仓库外的 `v1/hks`（已清理依赖与缓存，仅保留源码与截图），便于对照。

**验证记录（本机实测，DeepSeek 真实接口）**：
- `npm run build` 通过（Vite 5）。
- 开场页 / 枢纽主界面（历史地图 / 时间轴 / 人物关系入口）渲染正常。
- 点「已锁定」事件 → 落地场景打开，「对话 / 行动」两个标签都在。
- 行动实测：选「奉玺推行郡县，令天下同轨」→ AI 写「玉玺落印的刹那，殿角六枚旧铜印同时震颤…」+ 李斯反应 + 3 个新行动（命人砸开旧印木匣 / 俯身听铜印鸣声 / 让李斯念出郡县名录）。
- 对话实测：输入「你老实说，这城里现在谁说了算？」→ 李斯（戒备）回应「明面上是陛下的玺说了算——可臣方才瞧着，那些旧印也在争着开口。」+ 线索「旧印暗中与玉玺争夺号令之权」。
- 连续 9 次行动后世界线崩溃，AI 生成结局（标题 / 经过 / 墓志铭），场景转红并给出「返回时间线」。
- 地图区划实测：点疆域色块会定位到最近的一级行政区（秦 33 郡 / 唐 13 道 / 清 26 省），左下角「展开区划列表」可浏览并点击飞往任意区划；选中区划会高亮并显示名称。
- 区划边界改为独立的深色细线（`pathsData`），不再叠加半透明区划多边形；朝代切换与区划选中改为即时刷新，修掉了切换时间轴 / 点区划时地图出现空洞、要等一会才恢复的问题。
- 选中区划用「朝代的提亮色填充 + 白色闭合边线」完整包围，再点一次或点「清除选区」取消；切换朝代会自动清掉旧选区，不会把上一张图的区划叠到新图上。
- 地球页右上角恢复 `DB · SQLite 在线 / 3D · WEBGL / 切 2D` 状态条，「切 2D」可直接切到全息网格地球；左上角地名、底部 `ALT` 读数与拖拽提示同步恢复。
- 开场页恢复绿色时空圆环（刻度 + 旋转光弧 + 发光节点），与打字机开场白同时出现。
- `/api/ai/status` 显示 `enabled: true · deepseek-chat · collapseTurn: 9`；`/api/simulate`、`/api/npc/talk` 正常返回中文。
- 地图渲染修复：GeoJSON 外环方向与 d3-geo 相反时，疆域会被填充成「整个球面」（看起来像一个巨大的绿球、比例完全不对）。已在 `GlobeStage` 里加 `normalizeWinding()` 统一方向，现在疆域按地球仪比例点亮。
- 开局页 / 落地场景恢复为原设计尺寸（不做放大），字体仍用衬线 + 等宽两套。
- 截图见 `ui/screenshots/`（`intro.png`、`map-qin.png`、`map-tang.png`、`map-qing.png`、`event-panel.png`、`region-panel.png`、`character-graph.png`）。
