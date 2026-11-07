import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { buildScene, WEATHER_STYLE } from '../../frontend/src/data/sceneProfiles.js';
import { simulateChoice, npcTalk } from '../../frontend/src/data/apiClient.js';

/**
 * 落地场景（沉浸层）
 *
 * 两个独立功能，互不干扰，但都会影响局势：
 *   「对话」—— 玩家可以自由输入想说的话，AI 扮演人物回应，并推演这次对话带来的影响；
 *   「行动」—— 从 AI 给出的行动里选一个，AI 写「此刻」发生的后果，再给新的行动。
 *
 * 行动累计到第 9 幕，世界线崩溃，进入结局。
 * 剧情 100% 由 AI 生成，没有内置台词或 mock。
 */

const QUICK_LINES = [
  '你刚才说的，是什么意思？',
  '这里最近发生了什么？',
  '我凭什么信你？',
];

function hashSeed(text) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return Math.abs(seed);
}

function seeded(seed, count, min, max) {
  let value = seed;
  return Array.from({ length: count }, (_, i) => {
    value = (value * 1103515245 + 12345 + i) % 2147483647;
    const unit = (value % 10000) / 10000;
    return min + unit * (max - min);
  });
}

const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

function WeatherLayer({ kind, seed }) {
  const style = WEATHER_STYLE[kind] || WEATHER_STYLE.ash;
  const items = useMemo(() => {
    const xs = seeded(seed, style.count, 0, 100);
    const delays = seeded(seed + 7, style.count, 0, 12);
    const durations = seeded(seed + 13, style.count, style.duration[0], style.duration[1]);
    return xs.map((x, i) => ({ x, delay: delays[i], duration: durations[i], scale: 0.6 + (i % 5) * 0.16 }));
  }, [seed, style]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.map((item, index) => (
        <span
          key={index}
          className={`weather-particle ${style.drift}`}
          style={{
            left: `${item.x}%`,
            color: style.color,
            fontSize: `${10 + item.scale * 8}px`,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
          }}
        >
          {style.glyph}
        </span>
      ))}
    </div>
  );
}

function Backdrop({ scene, seed }) {
  const [top, mid, bottom] = scene.sky;
  const accent = scene.accent;
  const stars = useMemo(() => {
    const xs = seeded(seed + 31, 46, 0, 1440);
    const ys = seeded(seed + 37, 46, 0, 430);
    const rs = seeded(seed + 41, 46, 0.6, 1.9);
    return xs.map((x, i) => ({ x, y: ys[i], r: rs[i] }));
  }, [seed]);
  const flame = useMemo(() => seeded(seed + 53, 7, 0, 1), [seed]);

  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="58%" stopColor={mid} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
        <radialGradient id="scene-moon">
          <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="scene-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.ground[1]} />
          <stop offset="100%" stopColor={scene.ground[0]} />
        </linearGradient>
        <filter id="scene-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>

      <rect width="1440" height="900" fill="url(#scene-sky)" />
      {stars.map((star, index) => (
        <circle key={index} cx={star.x} cy={star.y} r={star.r} fill="#dff8ff" opacity={0.14 + (index % 5) * 0.07} />
      ))}

      <circle cx="1090" cy="196" r="220" fill="url(#scene-moon)" />
      <circle cx="1090" cy="196" r="26" fill={accent} opacity="0.8" filter="url(#scene-soft)" />
      <circle cx="1090" cy="196" r="13" fill="#f4fdff" opacity="0.95" />

      <path d="M0 640 L150 470 L286 566 L430 432 L560 566 L700 500 L840 600 L980 470 L1120 566 L1260 452 L1390 560 L1440 520 L1440 900 L0 900 Z" fill={mid} opacity="0.85" />
      <path d="M0 700 L120 590 L250 650 L392 560 L520 660 L660 600 L800 672 L940 590 L1080 660 L1240 586 L1440 668 L1440 900 L0 900 Z" fill={top} opacity="0.9" />

      <path d="M0 900 L0 704 L120 704 L120 682 L168 682 L168 704 L248 704 L248 682 L296 682 L296 704 L372 704 L372 682 L420 682 L420 704 L1440 704 L1440 900 Z" fill={scene.ground[0]} opacity="0.96" />

      <g opacity="0.98">
        <rect x="300" y="580" width="280" height="140" fill={scene.ground[0]} />
        <path d="M270 584 L440 500 L610 584 L600 598 L440 530 L280 598 Z" fill="#02030a" stroke={accent} strokeOpacity="0.45" strokeWidth="1.5" />
        <rect x="380" y="468" width="120" height="60" fill={scene.ground[0]} />
        <path d="M354 470 L440 412 L526 470 L518 484 L440 436 L362 484 Z" fill="#02030a" stroke={accent} strokeOpacity="0.5" strokeWidth="1.5" />
        <path d="M440 412 L440 384" stroke={accent} strokeOpacity="0.6" strokeWidth="2" />
        <circle cx="440" cy="380" r="4.5" fill={accent} opacity="0.85" />
        <path d="M404 720 L404 662 Q440 630 476 662 L476 720 Z" fill={accent} opacity="0.13" />
        <path d="M404 720 L404 662 Q440 630 476 662 L476 720" stroke={accent} strokeOpacity="0.5" strokeWidth="1.6" fill="none" />
        <circle cx="392" cy="668" r="5" fill={accent} opacity="0.85" />
        <circle cx="488" cy="668" r="5" fill={accent} opacity="0.85" />
      </g>

      <g opacity="0.85">
        <path d="M120 706 L180 672 L240 706 Z" fill={top} />
        <path d="M236 706 L288 678 L340 706 Z" fill={top} />
        <path d="M880 708 L934 678 L988 708 Z" fill={top} />
        <path d="M980 708 L1030 682 L1080 708 Z" fill={top} />
      </g>

      <g opacity="0.95">
        <rect x="1046" y="560" width="96" height="150" fill={scene.ground[0]} />
        <path d="M1026 566 L1094 486 L1162 566 Z" fill={scene.ground[0]} />
        <path d="M1040 566 L1094 504 L1148 566" stroke={accent} strokeOpacity="0.42" strokeWidth="2" fill="none" />
        <rect x="1080" y="620" width="28" height="46" fill={accent} opacity="0.14" />
      </g>

      <rect y="760" width="1440" height="140" fill="url(#scene-ground)" />
      <path d="M0 762 L1440 742 L1440 766 L0 786 Z" fill={accent} opacity="0.12" />

      {Array.from({ length: scene.torches }).map((_, index) => {
        const cx = 220 + index * 420;
        return (
          <g key={index} className="torch-glow" style={{ animationDelay: `${flame[index] * 2}s` }}>
            <circle cx={cx} cy="700" r="120" fill={accent} opacity="0.07" filter="url(#scene-soft)" />
            <circle cx={cx} cy="700" r="34" fill={accent} opacity="0.14" filter="url(#scene-soft)" />
            <rect x={cx - 3} y="690" width="6" height="70" fill={scene.ground[0]} />
            <circle cx={cx} cy="686" r="7" fill={accent} opacity="0.85" />
          </g>
        );
      })}
    </svg>
  );
}

function NpcFigure({ scene, talking }) {
  const accent = scene.accent;
  return (
    <div
      className="pointer-events-none absolute bottom-[15%] w-[240px] max-w-[24vw] -translate-x-1/2"
      style={{ left: `${(scene.npc.x ?? 0.74) * 100}%` }}
    >
      <div className="relative">
        <div className="absolute inset-x-0 bottom-0 mx-auto h-40 w-40 rounded-full blur-2xl" style={{ background: accent, opacity: talking ? 0.22 : 0.1 }} />
        <svg viewBox="0 0 200 470" className="npc-breathe relative w-full drop-shadow-[0_0_24px_rgba(0,0,0,0.6)]">
          <defs>
            <linearGradient id="npc-robe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.2" />
              <stop offset="55%" stopColor="#05070a" stopOpacity="0.97" />
              <stop offset="100%" stopColor="#010204" />
            </linearGradient>
            <linearGradient id="npc-rim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={accent} stopOpacity="0.75" />
              <stop offset="38%" stopColor={accent} stopOpacity="0.05" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M100 96 C78 96 62 112 58 140 C54 168 50 200 48 240 C46 300 44 360 46 434 L154 434 C156 360 154 300 152 240 C150 200 146 168 142 140 C138 112 122 96 100 96 Z" fill="url(#npc-robe)" stroke={accent} strokeOpacity="0.42" strokeWidth="1.4" />
          <path d="M78 210 C80 270 78 340 74 424" stroke={accent} strokeOpacity="0.16" strokeWidth="1.1" fill="none" />
          <path d="M100 200 L100 430" stroke={accent} strokeOpacity="0.12" strokeWidth="1" fill="none" />
          <path d="M122 210 C120 270 122 340 126 424" stroke={accent} strokeOpacity="0.16" strokeWidth="1.1" fill="none" />
          <path d="M62 268 L138 268" stroke={accent} strokeOpacity="0.5" strokeWidth="4" />
          <rect x="92" y="262" width="16" height="12" fill={accent} opacity="0.3" />
          <path d="M60 150 C40 190 36 240 40 300 C42 320 52 322 56 304 C60 268 62 220 70 176 Z" fill="#05070a" stroke={accent} strokeOpacity="0.28" strokeWidth="1.2" />
          <path d="M140 150 C160 190 164 240 160 300 C158 320 148 322 144 304 C140 268 138 220 130 176 Z" fill="#05070a" stroke={accent} strokeOpacity="0.28" strokeWidth="1.2" />
          <path d="M84 102 L100 132 L116 102" stroke={accent} strokeOpacity="0.55" strokeWidth="2" fill="none" />
          <rect x="93" y="84" width="14" height="16" fill="#05070a" />
          <ellipse cx="100" cy="62" rx="21" ry="24" fill="#05070a" stroke={accent} strokeOpacity="0.5" strokeWidth="1.4" />
          <path d="M78 54 C80 32 90 22 100 22 C110 22 120 32 122 54" stroke={accent} strokeOpacity="0.7" strokeWidth="2" fill="none" />
          <rect x="93" y="8" width="14" height="16" rx="2" fill={accent} opacity="0.3" />
          <path d="M110 56 C114 58 116 62 116 66" stroke={accent} strokeOpacity="0.6" strokeWidth="1.6" fill="none" />
          <path d="M100 96 C78 96 62 112 58 140 C54 168 50 200 48 240 C46 300 44 360 46 434" stroke="url(#npc-rim)" strokeWidth="2.2" fill="none" />
          <line x1="150" y1="250" x2="168" y2="300" stroke={accent} strokeOpacity="0.45" strokeWidth="2" />
          <g className="torch-glow">
            <circle cx="168" cy="306" r="22" fill={accent} opacity="0.12" />
            <circle cx="168" cy="306" r="7" fill={accent} opacity="0.75" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function Meter({ label, value, tone }) {
  return (
    <div>
      <div className="flex items-center justify-between font-system text-[9px] tracking-widest text-cyan-200/50">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-[3px] w-full bg-white/10">
        <div className="h-full transition-all duration-700" style={{ width: `${value}%`, background: tone, boxShadow: `0 0 10px ${tone}` }} />
      </div>
    </div>
  );
}

function DialogueBubble({ entry, npcName }) {
  if (entry.role === 'player') {
    return (
      <motion.div className="flex justify-end" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="max-w-[76%] border border-cyan-300/40 bg-cyan-500/10 px-3 py-1.5 text-right font-ancient text-[13px] leading-6 text-cyan-50/90">
          {entry.text}
        </div>
      </motion.div>
    );
  }
  if (entry.role === 'system') {
    return <p className="font-system text-[11px] leading-6 tracking-wide text-red-300/70">{entry.text}</p>;
  }
  return (
    <motion.div className="max-w-[86%]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <p className="font-system text-[9px] tracking-[0.25em] text-cyan-300/45">
        {npcName}
        {entry.mood && <span className="ml-2 text-violet-300/50">· {entry.mood}</span>}
      </p>
      <p className="mt-0.5 font-ancient text-[14px] leading-7 tracking-wide text-cyan-50/90">{entry.text}</p>
      {entry.info && (
        <p className="mt-1 font-system text-[10px] leading-5 tracking-wide text-amber-200/60">◈ 线索：{entry.info}</p>
      )}
    </motion.div>
  );
}

function ActionBlock({ entry }) {
  if (entry.role === 'player') {
    return (
      <motion.div className="flex items-start gap-2" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
        <span className="mt-1 font-system text-[9px] tracking-widest text-cyan-300/50">你</span>
        <p className="flex-1 font-ancient text-[14px] leading-7 text-cyan-50/90">{entry.text}</p>
      </motion.div>
    );
  }
  if (entry.role === 'narration') {
    return (
      <motion.div className="border-l-2 border-violet-400/50 pl-3" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
        <p className="font-system text-[9px] tracking-[0.3em] text-violet-300/60">此刻</p>
        <p className="mt-0.5 font-ancient text-[14px] leading-7 text-violet-50/85">{entry.text}</p>
      </motion.div>
    );
  }
  if (entry.role === 'system') {
    return <p className="font-system text-[11px] leading-6 tracking-wide text-red-300/70">{entry.text}</p>;
  }
  return (
    <motion.div className="pl-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <p className="font-system text-[9px] tracking-[0.25em] text-cyan-300/40">{entry.name}</p>
      <p className="mt-0.5 font-ancient text-[13px] leading-7 text-cyan-100/75">{entry.text}</p>
    </motion.div>
  );
}

export default function LandingScene({ event, dynasty, onClose, onRecordChoice }) {
  const scene = useMemo(() => buildScene(event, dynasty), [event, dynasty]);
  const seed = useMemo(() => hashSeed(`${event?.id || 'x'}-${dynasty?.dynasty || 'y'}`), [event, dynasty]);

  const [tab, setTab] = useState('talk');
  const [log, setLog] = useState(() => [
    { id: 0, kind: 'talk', role: 'npc', text: scene.npc.lines?.[0] || '（他看了你一眼，没有立刻开口。）' },
    ...(event?.rpgContext
      ? [{ id: 1, kind: 'action', role: 'system', text: event.rpgContext }]
      : []),
  ]);
  const [choices, setChoices] = useState(() => (event?.options || []).map((option, index) => ({
    id: `origin-${index}`,
    text: option.text,
    tone: option.tone,
  })));
  const [phase, setPhase] = useState('ready');
  const [turn, setTurn] = useState(0);
  const [talkTurn, setTalkTurn] = useState(0);
  const [entropy, setEntropy] = useState(0);
  const [ending, setEnding] = useState(null);
  const [discovered, setDiscovered] = useState([]);
  const [meters, setMeters] = useState({ stability: 62, alert: 18 });
  const [arrived, setArrived] = useState(true);
  const [draft, setDraft] = useState('');
  const idRef = useRef(2);
  const talkScrollRef = useRef(null);
  const actScrollRef = useRef(null);

  const push = useCallback((entry) => {
    setLog((prev) => [...prev, { id: idRef.current++, ...entry }]);
  }, []);

  const dialogues = useMemo(() => log.filter((item) => item.kind === 'talk'), [log]);
  const actions = useMemo(() => log.filter((item) => item.kind === 'action'), [log]);

  const historyText = useCallback(
    () => log.slice(-14).map((m) => {
      if (m.role === 'player') return `玩家：${m.text}`;
      if (m.role === 'npc') return `${scene.npc.name}：${m.text}`;
      return `旁白：${m.text}`;
    }),
    [log, scene.npc.name],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setArrived(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  // 沉浸层打开时锁住背后的页面滚动
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKeyDown = (keyEvent) => {
      if (keyEvent.key === 'Escape' && phase !== 'collapse') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, phase]);

  useEffect(() => {
    const el = tab === 'talk' ? talkScrollRef.current : actScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length, tab, phase]);

  const applyEffects = useCallback((effects = {}, entropyDelta = 0) => {
    setMeters((prev) => ({
      stability: clamp(prev.stability + (effects.stability || 0)),
      alert: clamp(prev.alert + (effects.alert || 0)),
    }));
    if (entropyDelta) setEntropy((prev) => clamp(prev + entropyDelta));
  }, []);

  // 对话：玩家自由输入
  const sendTalk = useCallback(async (text) => {
    const playerText = String(text || '').trim();
    if (!playerText || phase === 'thinking' || phase === 'collapse') return;
    setDraft('');
    setPhase('thinking');
    push({ kind: 'talk', role: 'player', text: playerText });

    try {
      const result = await npcTalk({
        event,
        dynasty,
        npc: scene.npc,
        turn: talkTurn,
        history: historyText(),
        playerText,
      });
      if (!result || result.kind === 'error') {
        push({ kind: 'talk', role: 'system', text: `对话失败：${result?.error || '网络或模型异常，请重试'}` });
        setPhase('ready');
        return;
      }
      push({ kind: 'talk', role: 'npc', text: result.line, mood: result.mood, info: result.info });
      applyEffects(result.effects, result.entropyDelta);
      setTalkTurn((prev) => prev + 1);
      setPhase('ready');
    } catch (error) {
      push({ kind: 'talk', role: 'system', text: `对话失败：${error.message || '网络异常'}，请重试` });
      setPhase('ready');
    }
  }, [phase, push, event, dynasty, scene.npc, talkTurn, historyText, applyEffects]);

  // 行动：从 AI 给出的行动里选
  const pickChoice = useCallback(async (choice, index) => {
    if (phase === 'thinking' || phase === 'collapse') return;
    setPhase('thinking');
    push({ kind: 'action', role: 'player', text: choice.text });
    onRecordChoice?.(choice, index, event);

    try {
      const result = await simulateChoice({
        event,
        option: choice,
        dynasty,
        npc: scene.npc,
        turn,
        entropy,
        history: historyText(),
      });
      if (!result || result.kind === 'error') {
        push({ kind: 'action', role: 'system', text: `推演失败：${result?.error || '网络或模型异常，请重试'}` });
        setPhase('ready');
        return;
      }
      if (result.kind === 'collapse') {
        push({ kind: 'action', role: 'narration', text: result.narrator });
        if (result.npcLine) push({ kind: 'action', role: 'npc', name: scene.npc.name, text: result.npcLine });
        setEnding(result.ending);
        setEntropy(100);
        setPhase('collapse');
        return;
      }
      push({ kind: 'action', role: 'narration', text: result.narrator });
      if (result.npcLine) push({ kind: 'action', role: 'npc', name: scene.npc.name, text: result.npcLine });
      setChoices(result.choices || []);
      applyEffects(result.effects, result.entropyDelta);
      setTurn((prev) => prev + 1);
      setPhase('ready');
    } catch (error) {
      push({ kind: 'action', role: 'system', text: `推演失败：${error.message || '网络异常'}，请重试` });
      setPhase('ready');
    }
  }, [phase, push, onRecordChoice, event, dynasty, scene.npc, turn, entropy, historyText, applyEffects]);

  const inspect = useCallback((hotspot) => {
    setTab('act');
    push({ kind: 'action', role: 'narration', text: hotspot.text });
    setDiscovered((prev) => (prev.includes(hotspot.id) ? prev : [...prev, hotspot.id]));
    setMeters((prev) => ({ stability: Math.max(0, prev.stability - 1), alert: Math.min(100, prev.alert + 2) }));
  }, [push]);

  const submitTalk = useCallback(() => {
    if (!draft.trim()) return;
    sendTalk(draft);
  }, [draft, sendTalk]);

  return (
    <motion.div
      className={`fixed inset-0 z-50 overflow-hidden bg-black ${phase === 'collapse' ? 'scene-collapse' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.18, filter: 'blur(14px)' }}
        animate={{ scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
      >
        <Backdrop scene={scene} seed={seed} />
        <WeatherLayer kind={scene.weather} seed={seed} />
        <div
          className="fog-drift pointer-events-none absolute inset-x-[-20%] bottom-[16%] h-[42%] blur-2xl"
          style={{ background: `radial-gradient(ellipse at 50% 60%, ${scene.fog}, transparent 70%)` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.82)_100%)]" />
      </motion.div>

      <NpcFigure scene={scene} talking={phase === 'thinking'} />

      {phase !== 'collapse' && scene.hotspots.map((hotspot) => {
        const seen = discovered.includes(hotspot.id);
        return (
          <button
            key={hotspot.id}
            type="button"
            onClick={() => inspect(hotspot)}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%` }}
            aria-label={`观察：${hotspot.label}`}
          >
            <span
              className="hotspot-core block h-3 w-3 rotate-45 transition-transform duration-300 group-hover:scale-150"
              style={{
                background: seen ? 'rgba(255,255,255,0.35)' : scene.accent,
                boxShadow: `0 0 14px ${scene.accent}, 0 0 34px ${scene.accent}66`,
                opacity: seen ? 0.45 : 1,
              }}
            />
            <span className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap border border-cyan-300/30 bg-black/80 px-2 py-1 font-system text-[10px] tracking-widest text-cyan-100 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {hotspot.label}
            </span>
          </button>
        );
      })}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <p className="label-caps">Landed · {event.dynastyName || dynasty?.dynasty}</p>
          <h2 className="mt-1 font-ancient text-2xl tracking-[0.25em] text-cyan-50 text-glow">{event.locationName}</h2>
          <p className="mt-1 font-system text-[11px] tracking-[0.25em] text-cyan-200/55">
            {event.title} · {Number.isFinite(event.year) ? (event.year < 0 ? `公元前 ${Math.abs(event.year)} 年` : `公元 ${event.year} 年`) : '年代未知'}
          </p>
        </div>
        <div className="w-44 space-y-2">
          <Meter label="时间线稳定度" value={meters.stability} tone="#39ffb0" />
          <Meter label="系统警觉度" value={meters.alert} tone="#ff5b5b" />
          <Meter label="世界线崩坏度" value={entropy} tone="#ffb03b" />
          <p className="font-system text-[10px] tracking-widest text-cyan-200/45">
            第 {turn + 1} 幕 · 线索 {discovered.length}/{scene.hotspots.length}
          </p>
        </div>
      </div>

      {arrived && phase !== 'collapse' && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-[30%] z-30 text-center"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <p className="font-ancient text-lg tracking-[0.6em] text-cyan-100/90 text-glow">空间折叠完成</p>
          <p className="mt-2 font-system text-[11px] tracking-[0.3em] text-cyan-200/50">
            已落地 · {event.locationName} · 请观察四周
          </p>
        </motion.div>
      )}

      <motion.div
        className="absolute inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-6"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      >
        <div className="scene-panel mx-auto flex max-h-[72vh] w-full max-w-5xl flex-col border border-cyan-400/30 bg-black/80 backdrop-blur-md">
          {/* 头部：人物 + 两个功能标签 */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-cyan-400/20 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: scene.accent, boxShadow: `0 0 10px ${scene.accent}` }} />
              <span className="font-system text-[11px] tracking-[0.25em] text-cyan-100">{scene.npc.name}</span>
              <span className="font-system text-[10px] tracking-widest text-cyan-300/40">{scene.npc.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex border border-cyan-400/25">
                <button
                  type="button"
                  onClick={() => setTab('talk')}
                  className={`px-3 py-1 font-system text-[10px] tracking-widest transition-colors ${
                    tab === 'talk' ? 'bg-cyan-400/15 text-cyan-100' : 'text-cyan-300/45 hover:text-cyan-100'
                  }`}
                >
                  对话 {dialogues.length}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('act')}
                  className={`border-l border-cyan-400/25 px-3 py-1 font-system text-[10px] tracking-widest transition-colors ${
                    tab === 'act' ? 'bg-violet-400/15 text-violet-100' : 'text-cyan-300/45 hover:text-cyan-100'
                  }`}
                >
                  行动 {actions.length}
                </button>
              </div>
              <span className="font-system text-[9px] tracking-widest text-cyan-200/35">AI 生成</span>
              <button
                type="button"
                onClick={onClose}
                className="font-system text-[10px] tracking-widest text-cyan-300/45 transition-colors hover:text-cyan-100"
              >
                Esc<span className="scene-return-extra"> · 返回地球</span>
              </button>
            </div>
          </div>

          {/* 对话面板 */}
          {tab === 'talk' && (
            <>
              <div ref={talkScrollRef} className="thin-scrollbar min-h-[160px] flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {dialogues.map((entry) => (
                  <DialogueBubble key={entry.id} entry={entry} npcName={scene.npc.name} />
                ))}
                {phase === 'thinking' && (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border border-cyan-400/30 border-t-cyan-300" />
                    <span className="font-system text-[10px] tracking-widest text-cyan-200/55">他在斟酌怎么回你…</span>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-cyan-400/15 px-4 py-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {QUICK_LINES.map((line) => (
                    <button
                      key={line}
                      type="button"
                      disabled={phase === 'thinking'}
                      onClick={() => sendTalk(line)}
                      className="border border-cyan-400/20 px-2 py-1 font-system text-[10px] tracking-wide text-cyan-300/60 transition-colors hover:border-cyan-300/50 hover:text-cyan-100 disabled:opacity-40"
                    >
                      {line}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitTalk(); }}
                    disabled={phase === 'thinking' || phase === 'collapse'}
                    placeholder="你想对他说什么…"
                    className="flex-1 border border-cyan-400/25 bg-black/40 px-3 py-2 font-ancient text-[14px] tracking-wide text-cyan-50 placeholder:text-cyan-200/25 focus:border-cyan-300/60 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={submitTalk}
                    disabled={phase === 'thinking' || !draft.trim()}
                    className="neon-btn px-4 py-2 text-[12px]"
                  >
                    说
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 行动面板 */}
          {tab === 'act' && (
            <>
              <div ref={actScrollRef} className="thin-scrollbar min-h-[160px] flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {actions.length === 0 && (
                  <p className="font-system text-[11px] leading-6 tracking-wide text-cyan-200/40">
                    还没有做出任何行动。选一个，看看会发生什么。
                  </p>
                )}
                {actions.map((entry) => <ActionBlock key={entry.id} entry={entry} />)}
                {phase === 'thinking' && (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border border-cyan-400/30 border-t-cyan-300" />
                    <span className="font-system text-[10px] tracking-widest text-cyan-200/55">AI 正在推演此刻…</span>
                  </div>
                )}
              </div>

              {phase !== 'collapse' && (
                <div className="shrink-0 border-t border-cyan-400/15 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="label-caps">{phase === 'thinking' ? '推演中…' : '你要做什么'}</p>
                    <button
                      type="button"
                      onClick={() => setTab('talk')}
                      className="font-system text-[10px] tracking-widest text-cyan-300/45 transition-colors hover:text-cyan-100"
                    >
                      ◈ 继续和他说话
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {choices.map((choice, index) => (
                      <motion.button
                        key={choice.id || `${choice.text}-${index}`}
                        type="button"
                        disabled={phase === 'thinking'}
                        onClick={() => pickChoice(choice, index)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 * index }}
                        className="neon-btn flex w-full items-center gap-2 py-2 text-[13px]"
                      >
                        <span className="font-system text-[10px] text-cyan-300/50">{String(index + 1).padStart(2, '0')}</span>
                        <span className="flex-1">{choice.text}</span>
                        <span className="font-system text-[10px] text-cyan-300/40">›</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* 世界线崩溃结局 */}
      {phase === 'collapse' && ending && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/88 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        >
          <div className="collapse-flash pointer-events-none absolute inset-0" />
          <motion.div
            className="relative max-w-xl border border-red-500/40 bg-black/70 p-6 text-center sm:p-10"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            style={{ boxShadow: '0 0 80px rgba(255,40,40,0.18)' }}
          >
            <p className="label-caps text-red-300/70">Timeline Collapsed</p>
            <h2 className="glitch-text mt-3 font-ancient text-3xl tracking-[0.25em] text-red-100" data-text={ending.title}>
              {ending.title}
            </h2>
            <div className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-red-400 to-transparent" />
            <p className="mt-5 font-ancient text-[15px] leading-8 tracking-wide text-red-50/85">{ending.text}</p>
            {ending.epitaph && (
              <p className="mt-6 font-ancient text-[13px] italic tracking-[0.2em] text-red-200/55">「{ending.epitaph}」</p>
            )}
            <p className="mt-6 font-system text-[10px] tracking-[0.25em] text-red-200/40">
              共 {turn} 次干预 · 世界线崩坏度 {entropy}/100
            </p>
            <button type="button" onClick={onClose} className="neon-btn mx-auto mt-7 block px-8 py-2.5 text-center text-[13px]">
              返回时间线
            </button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
