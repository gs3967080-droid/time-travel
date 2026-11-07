/**
 * 场景配置：把「历史锚点」扩展成可沉浸探索的落地场景。
 *
 * 设计原则与 dataContract 一致：
 *   - 缺字段不崩：所有字段都有默认值，事件里没写 scene 也能生成完整场景；
 *   - 数据可覆盖：mockData.json 里给某个 event 加 scene 字段，会覆盖这里的默认配置；
 *   - 零外部素材：场景、人物、天气全部用 SVG / CSS 程序化生成。
 */

const DYNASTY_ENV = {
  秦朝: {
    accent: '#e7c071',
    sky: ['#08070a', '#241a08', '#3a2a0d'],
    ground: ['#0b0906', '#141008'],
    fog: 'rgba(231, 192, 113, 0.16)',
    weather: 'dust',
    torches: 2,
  },
  唐朝: {
    accent: '#36f5e6',
    sky: ['#03080c', '#072630', '#0a3a44'],
    ground: ['#04090b', '#061418'],
    fog: 'rgba(54, 245, 230, 0.14)',
    weather: 'ash',
    torches: 3,
  },
  清朝: {
    accent: '#9b6dff',
    sky: ['#070410', '#1a0c2a', '#2a1440'],
    ground: ['#08060d', '#0e0916'],
    fog: 'rgba(155, 109, 255, 0.16)',
    weather: 'snow',
    torches: 2,
  },
}

const DEFAULT_ENV = {
  accent: '#36f5e6',
  sky: ['#04060a', '#0a1a22', '#12303a'],
  ground: ['#05080a', '#0a1014'],
  fog: 'rgba(54, 245, 230, 0.12)',
  weather: 'ash',
  torches: 2,
}

/** 事件级场景脚本：人物、可交互热点、登场旁白 */
const SCENE_SCRIPTS = {
  qin_unification: {
    npc: {
      name: '史官 · 李斯',
      title: '咸阳宫 · 殿前',
      lines: [
        '（竹简的墨迹还没干）陛下在等一个答案——天下，究竟该用郡县，还是分封？',
        '你我都是这局棋里的字。说吧，你想让这行字怎么落笔？',
      ],
    },
    hotspots: [
      { id: 'jade', label: '案上的六国玺印', x: 0.28, y: 0.58, text: '六枚玺印被凿去旧文，玉屑还嵌在案面的沟痕里。你伸手，指尖发凉。' },
      { id: 'map', label: '摊开的舆图', x: 0.5, y: 0.66, text: '三十六个郡的墨线在绢上延展，像刚缝合的伤口。' },
      { id: 'guard', label: '殿外的甲士', x: 0.78, y: 0.5, text: '甲片碰撞如潮水。他们不看你的脸，只看你腰间的令牌。' },
    ],
    ambient: 'dust',
  },
  qin_burn: {
    npc: {
      name: '书吏 · 无名',
      title: '骊山 · 焚书场',
      lines: [
        '（火光映得他半张脸发红）再往里投一捆，百家就真的只剩一种声音了。',
        '你也是来见证的？还是……来抢的？',
      ],
    },
    hotspots: [
      { id: 'flame', label: '卷曲的竹简', x: 0.3, y: 0.62, text: '竹片在火里爆开，露出半句「民为贵」。火光一闪，字就没了。' },
      { id: 'crowd', label: '围观的人群', x: 0.72, y: 0.55, text: '没有人说话，但你能听见很多人大口呼吸的声音。' },
    ],
    ambient: 'ash',
  },
  qin_dze: {
    npc: {
      name: '戍卒 · 吴广',
      title: '大泽乡 · 雨夜',
      lines: [
        '（雨水顺着戟杆往下淌）失期，法皆斩。你说，我们还有别的路吗？',
        '要么死在这片芦苇荡里，要么……把这天捅个窟窿。',
      ],
    },
    hotspots: [
      { id: 'rain', label: '没膝的积水', x: 0.38, y: 0.72, text: '水面上浮着被冲散的竹简，字迹正在化开。' },
      { id: 'torch', label: '芦苇间的火把', x: 0.7, y: 0.48, text: '火把一盏接一盏亮起来，像大地睁开了眼睛。' },
    ],
    ambient: 'rain',
  },
  tang_anshi: {
    npc: {
      name: '驿卒 · 陈九',
      title: '长安 · 朱雀门',
      lines: [
        '（他背上的驿传旗已经散了线）潼关告急！哥舒翰兵败的消息，比我还快一步进了城。',
        '贵人说，今夜宫里还在排《霓裳》。你说……这消息，我该往哪儿递？',
      ],
    },
    hotspots: [
      { id: 'lantern', label: '檐下的宫灯', x: 0.22, y: 0.4, text: '灯笼映着朱漆，红光里浮着细灰。远处隐约传来琵琶声。' },
      { id: 'letter', label: '驿卒背上的急报', x: 0.56, y: 0.6, text: '封泥已裂，露出「范阳」二字。纸边被雨浸得发软。' },
      { id: 'crowd', label: '街角的流民', x: 0.82, y: 0.58, text: '他们裹着旧毡，看着宫墙的方向，没有人哭。' },
    ],
    ambient: 'ash',
  },
  tang_fanyang: {
    npc: {
      name: '传令兵 · 阿史那',
      title: '范阳 · 军营',
      lines: [
        '（他把军令按在胸口）三镇合兵，只等一声号令。你若是从长安来的——最好别多说。',
        '这封信我送出去，北边就再没有回头路了。',
      ],
    },
    hotspots: [
      { id: 'banner', label: '风里的旌旗', x: 0.24, y: 0.38, text: '旌旗猎猎，旗角的「安」字被风扯成一道口子。' },
      { id: 'horse', label: '待发的战马', x: 0.74, y: 0.62, text: '马鼻喷着白气，蹄铁在冻土上刨出浅坑。' },
    ],
    ambient: 'snow',
  },
  tang_yangzhou: {
    npc: {
      name: '船工 · 老周',
      title: '扬州港 · 渡口',
      lines: [
        '（他望着海的方向）第六次了。前五次不是船沉，就是人没能回来。',
        '大师说，总得有人把经书送过去。可送过去的人，自己也回不来了。',
      ],
    },
    hotspots: [
      { id: 'ship', label: '待发的海船', x: 0.48, y: 0.52, text: '船身被海风磨得发白，帆上补丁叠着补丁。' },
      { id: 'scroll', label: '经卷木箱', x: 0.28, y: 0.66, text: '木箱上写着「唐·大和」。你不知道这个箱子里装着多少个夜晚。' },
    ],
    ambient: 'rain',
  },
  qing_junjichu: {
    npc: {
      name: '章京 · 和珅',
      title: '京师 · 养心殿外',
      lines: [
        '（他手里攥着一封密折，指节发白）这道折子，只到皇上眼前，不走军机。',
        '大人若肯在此签押，往后这帝国的每一笔，都从这里过。',
      ],
    },
    hotspots: [
      { id: 'lamp', label: '值房的长明灯', x: 0.7, y: 0.4, text: '灯芯挑得很短，是要坐守整夜的意思。' },
      { id: 'seal', label: '黄绫封套', x: 0.34, y: 0.6, text: '封套上盖着「密」字，红得像刚干的血。' },
    ],
    ambient: 'snow',
  },
  qing_humen: {
    npc: {
      name: '差役 · 林伯',
      title: '虎门 · 海滩',
      lines: [
        '（盐卤池的白气扑在他脸上）两万箱，今天就都要化了。',
        '大人说这是给天下人看的一把火。可海面上的船，一条也没走。',
      ],
    },
    hotspots: [
      { id: 'pool', label: '翻涌的盐卤池', x: 0.42, y: 0.66, text: '黑膏在水面化开，空气里是又甜又呛的味道。' },
      { id: 'ship', label: '远处的洋船', x: 0.84, y: 0.36, text: '桅杆的影子在海平线上晃。它们没有靠近，也没有离开。' },
    ],
    ambient: 'rain',
  },
  qing_wuchang: {
    npc: {
      name: '新军士兵 · 张彪',
      title: '武昌 · 楚望台',
      lines: [
        '（他左臂缠着白布）枪已经分了，人也齐了。就差有人喊第一声。',
        '你说，两千年了……今晚真的能翻过去吗？',
      ],
    },
    hotspots: [
      { id: 'rifle', label: '发下的枪械', x: 0.62, y: 0.62, text: '枪油味混着夜露。每一支都擦得很亮，像知道今晚要做什么。' },
      { id: 'flag', label: '卷起的旗帜', x: 0.32, y: 0.5, text: '旗还没展开，从布缝里透出一点红。' },
    ],
    ambient: 'ash',
  },
}

const DEFAULT_SCRIPT = {
  npc: {
    name: '无名者',
    title: '时间线缝隙',
    lines: ['（他抬起头，像早就知道你会来）你也听见了吧？历史正在这里拐弯。'],
  },
  hotspots: [
    { id: 'air', label: '空气里的尘埃', x: 0.4, y: 0.5, text: '尘埃在光里缓缓翻卷，像一段还没写下的文字。' },
  ],
  ambient: 'ash',
}

/** 把事件 + 朝代合并成一份可直接渲染的场景配置 */
export function buildScene(event = {}, dynasty = {}) {
  const script = SCENE_SCRIPTS[event.id] || DEFAULT_SCRIPT
  const env = DYNASTY_ENV[dynasty.dynasty] || DEFAULT_ENV
  const override = event.scene && typeof event.scene === 'object' ? event.scene : {}

  return {
    accent: override.accent || dynasty.color || env.accent,
    sky: override.sky || env.sky,
    ground: override.ground || env.ground,
    fog: override.fog || env.fog,
    weather: override.weather || script.ambient || env.weather,
    torches: override.torches ?? env.torches,
    npc: {
      ...script.npc,
      ...(override.npc || {}),
    },
    hotspots: Array.isArray(override.hotspots) ? override.hotspots : script.hotspots,
  }
}

/** 天气粒子参数（数量、速度、样式） */
export const WEATHER_STYLE = {
  ash: { count: 26, glyph: '·', duration: [9, 18], color: 'rgba(200,240,255,0.5)', drift: 'drift-down' },
  dust: { count: 22, glyph: '·', duration: [10, 20], color: 'rgba(255,220,150,0.45)', drift: 'drift-down' },
  snow: { count: 30, glyph: '❊', duration: [8, 16], color: 'rgba(235,245,255,0.6)', drift: 'drift-down' },
  rain: { count: 34, glyph: '|', duration: [1.4, 2.6], color: 'rgba(170,225,255,0.4)', drift: 'drift-rain' },
}
