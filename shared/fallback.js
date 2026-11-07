// 内置演示数据：A 的 mockData.json 还没到、或者数据为空 / 格式不完整时，
// 整个应用依然能按「开场 -> 唐朝 -> 长安 -> 安史之乱 -> 选项交互」完整跑通。
// A 把 JSON 放进 src/data/ 后会自动接管，本文件只作为兜底，不会被渲染层直接引用。

export const FALLBACK_INTRO =
  '叮——时空锚点校准完成。宿主意识已接入「历史枢纽」，秦、唐、清三条时间线正在解算。滚动右侧跃迁舱，选择你的落点。';

export const FALLBACK_DYNASTIES = [
  {
    dynasty: '秦朝',
    yearStart: -221,
    yearEnd: -207,
    color: '#D4AF37',
    center: { lat: 34.33, lng: 108.72 },
    caption: '铁律初铸 · 天下归一',
    events: [
      {
        id: 'qin_unify',
        title: '六国归秦',
        year: -221,
        lat: 34.33,
        lng: 108.72,
        locationName: '咸阳',
        rpgContext:
          '叮！系统检测到宿主抵达公元前221年·咸阳宫。王翦的战报正堆满案头，六国玺印尚带余温。始皇帝问：天下该以何种律法缝合？',
        options: [
          { text: '推行郡县，书同文车同轨', result: '系统判定：时间线稳定度 +12%。帝国骨架铸成，但苛政的种子已埋进竹简。', tone: 'safe' },
          { text: '分封诸王，以血缘镇四方', result: '系统警告：时间线发生偏移！诸侯复起，烽火将在十二年后重燃。', tone: 'danger' },
        ],
      },
      {
        id: 'qin_burn',
        title: '焚书坑儒',
        year: -213,
        lat: 34.38,
        lng: 109.28,
        locationName: '骊山',
        rpgContext:
          '叮！咸阳北阙火光冲天，竹简在烈焰里卷曲成灰。系统提示：诸子百家的记忆正在从时间线上被抹除。',
        options: [
          { text: '拦下诏书，私藏百家典籍', result: '系统判定：文明火种已转移。宿主被标记为「时间线违逆者」。', tone: 'safe' },
          { text: '顺承旨意，令思想归于一统', result: '系统崩溃：思想维度坍缩，后世千年的注脚只剩一种笔迹。', tone: 'danger' },
        ],
      },
      {
        id: 'qin_dze',
        title: '大泽乡起义',
        year: -209,
        lat: 33.65,
        lng: 116.87,
        locationName: '大泽乡',
        rpgContext:
          '叮！大雨失期，戍卒的火把在芦苇荡里连成一线。系统检测到「王侯将相宁有种乎」正在改写帝国底层代码。',
        options: [
          { text: '揭竿而起，接入叛军时间线', result: '系统警告：帝国进程异常终止，宿主进入乱世分支。', tone: 'danger' },
          { text: '按律上报，尝试修补徭役参数', result: '系统判定：补丁无效。历史惯性不可覆写。', tone: 'danger' },
        ],
      },
    ],
  },
  {
    dynasty: '唐朝',
    yearStart: 618,
    yearEnd: 907,
    color: '#00FFFF',
    center: { lat: 34.26, lng: 108.94 },
    caption: '万国来朝 · 盛世将倾',
    events: [
      {
        id: 'tang_anshi',
        title: '安史之乱',
        year: 755,
        lat: 34.26,
        lng: 108.94,
        locationName: '长安',
        rpgContext:
          '叮！系统检测到宿主处于唐朝天宝年间，安禄山已在范阳起兵。潼关告急的驿马正冲向长安，盛世的霓虹开始闪烁不稳……请选择你的干预指令。',
        options: [
          { text: '听信杨国忠，立刻削藩', result: '系统警告：时间线发生偏移！盛世崩塌，渔阳鼙鼓提前撞破长安城门。', tone: 'danger' },
          { text: '继续信任安禄山', result: '系统崩溃：战乱爆发，宿主被迫转移……霓虹熄灭，此分支已锁定。', tone: 'danger' },
        ],
      },
      {
        id: 'tang_fanyang',
        title: '范阳起兵',
        year: 755,
        lat: 39.9,
        lng: 116.4,
        locationName: '范阳',
        rpgContext:
          '叮！三镇节度使的旌旗在北境展开，系统捕获到一段被加密的军令：「讨杨国忠」。这是时间线裂缝的起点。',
        options: [
          { text: '截获军令，提前布防潼关', result: '系统判定：防线加固，盛世续命十二年。但历史仍在向原终点滑落。', tone: 'safe' },
          { text: '放任军令抵达长安', result: '系统警告：哥舒翰出战，潼关失守。宿主已被卷入逃亡队伍。', tone: 'danger' },
        ],
      },
      {
        id: 'tang_yangzhou',
        title: '鉴真东渡',
        year: 753,
        lat: 32.39,
        lng: 119.42,
        locationName: '扬州',
        rpgContext:
          '叮！扬州港的第六次扬帆即将启航。系统提示：一段文明正准备跨海复制自己，而长安的灯火还不知道北方的风声。',
        options: [
          { text: '护航东渡，保住这条文化支线', result: '系统判定：跨海备份完成。时间线韧性 +8%。', tone: 'safe' },
          { text: '调船北上，支援潼关防线', result: '系统警告：文化支线断裂，但战争参数未改变。', tone: 'danger' },
        ],
      },
    ],
  },
  {
    dynasty: '清朝',
    yearStart: 1636,
    yearEnd: 1912,
    color: '#8A2BE2',
    center: { lat: 39.9, lng: 116.4 },
    caption: '紫禁落日 · 千年变局',
    events: [
      {
        id: 'qing_junjichu',
        title: '军机处设立',
        year: 1729,
        lat: 39.9,
        lng: 116.4,
        locationName: '京师',
        rpgContext:
          '叮！养心殿外的值房亮起一盏不灭的灯。系统检测到帝国的决策链路正在被压缩成一条极细的线。',
        options: [
          { text: '保留议政王大臣会议', result: '系统判定：权力未被完全收束，时间线出现微弱分叉。', tone: 'safe' },
          { text: '密折直达，一切归于一人', result: '系统警告：效率峰值达成，系统弹性归零。', tone: 'danger' },
        ],
      },
      {
        id: 'qing_humen',
        title: '虎门销烟',
        year: 1839,
        lat: 22.8,
        lng: 113.67,
        locationName: '虎门',
        rpgContext:
          '叮！海滩上的盐卤池正吞没两万余箱鸦片。系统捕获到远洋舰队的坐标信号，正在向珠江口逼近。',
        options: [
          { text: '加固炮台，重写海防参数', result: '系统判定：局部防线生效，但时代差值无法用炮台抹平。', tone: 'safe' },
          { text: '闭关自守，切断一切外洋信号', result: '系统崩溃：信号并未消失，只是换了一艘船抵达。', tone: 'danger' },
        ],
      },
      {
        id: 'qing_wuchang',
        title: '武昌首义',
        year: 1911,
        lat: 30.55,
        lng: 114.31,
        locationName: '武昌',
        rpgContext:
          '叮！楚望台军械库的枪声撕开夜幕。系统提示：帝制进程即将退出，两千年的时间轴正在合拢。',
        options: [
          { text: '接入新纪元，保存全部记忆', result: '系统判定：跃迁完成。历史枢纽归档，宿主可返回时间线。', tone: 'safe' },
          { text: '试图回滚到上一个王朝', result: '系统警告：回滚失败。时间不可逆。', tone: 'danger' },
        ],
      },
    ],
  },
];
