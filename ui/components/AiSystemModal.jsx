import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { simulateChoice, npcTalk } from '../../frontend/src/data/apiClient.js';
import { buildScene } from '../../frontend/src/data/sceneProfiles.js';

/**
 * 系统穿越面板（AI 版）
 *
 * 沿用 A 的弹窗设计（SYSTEM TRANSMISSION / 终端框 / 选项按钮），
 * 把原来的「二选一 + 静态结果」升级成 AI 现场推演：
 *
 *   「对话」—— 自由输入想说的话，AI 扮演现场人物回应，并给出情绪 / 线索 / 影响
 *   「行动」—— 选一个行动，AI 写「此刻」发生了什么，再给新的行动
 *   行动累计到第 9 幕，时间线崩溃，进入结局
 */

const QUICK_LINES = ['你刚才说的，是什么意思？', '这里最近发生了什么？', '我凭什么信你？'];

function toTone(tone) {
  return tone === 'stable' || tone === 'safe' ? 'safe' : 'danger';
}

export default function AiSystemModal({ event, dynasty, onClose, onRecordChoice }) {
  const npc = useMemo(() => buildScene(event).npc, [event]);
  const [tab, setTab] = useState('action');
  const [log, setLog] = useState(() => [
    { id: 0, kind: 'action', role: 'system', text: event.rpgContext },
  ]);
  const [choices, setChoices] = useState(() =>
    event.options.map((option, index) => ({
      id: `origin-${index}`,
      text: option.text,
      tone: toTone(option.tone),
    })),
  );
  const [phase, setPhase] = useState('ready');
  const [turn, setTurn] = useState(0);
  const [talkTurn, setTalkTurn] = useState(0);
  const [entropy, setEntropy] = useState(0);
  const [ending, setEnding] = useState(null);
  const [draft, setDraft] = useState('');
  const [meters, setMeters] = useState({ stability: 62, alert: 18 });

  const idRef = useRef(1);
  const dialogRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  const push = useCallback((entry) => {
    setLog((prev) => [...prev, { id: idRef.current++, ...entry }]);
  }, []);

  const historyText = useCallback(
    () => log.slice(-14).map((item) => {
      if (item.role === 'player') return `宿主：${item.text}`;
      if (item.role === 'npc') return `${npc.name}：${item.text}`;
      return `系统：${item.text}`;
    }),
    [log, npc.name],
  );

  // 打开时锁住页面滚动，避免背后的主界面跟着滚
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKeyDown = (keyEvent) => {
      if (keyEvent.key === 'Escape') onClose();
    };
    dialogRef.current?.addEventListener('keydown', onKeyDown);
    return () => dialogRef.current?.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length, tab, phase]);

  const applyEffects = useCallback((effects = {}, entropyDelta = 0) => {
    const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
    setMeters((prev) => ({
      stability: clamp(prev.stability + (effects.stability || 0)),
      alert: clamp(prev.alert + (effects.alert || 0)),
    }));
    if (entropyDelta) setEntropy((prev) => clamp(prev + entropyDelta));
  }, []);

  const sendTalk = useCallback(async (text) => {
    const playerText = String(text || '').trim();
    if (!playerText || phase === 'thinking' || phase === 'collapse') return;
    setDraft('');
    setPhase('thinking');
    push({ kind: 'talk', role: 'player', text: playerText });

    try {
      const result = await npcTalk({
        event,
        dynasty: { dynasty: dynasty.dynasty, yearStart: dynasty.yearStart },
        npc: { name: npc.name, title: npc.title },
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
  }, [phase, push, event, dynasty, npc, talkTurn, historyText, applyEffects]);

  const pickChoice = useCallback(async (choice, index) => {
    if (phase === 'thinking' || phase === 'collapse') return;
    setPhase('thinking');
    push({ kind: 'action', role: 'player', text: choice.text });
    onRecordChoice?.(choice, index, event);

    try {
      const result = await simulateChoice({
        event,
        option: { text: choice.text, tone: choice.tone },
        dynasty: { dynasty: dynasty.dynasty, yearStart: dynasty.yearStart },
        npc: { name: npc.name, title: npc.title },
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
        push({ kind: 'action', role: 'system', text: result.narrator });
        if (result.npcLine) push({ kind: 'action', role: 'npc', text: result.npcLine });
        setEnding(result.ending);
        setEntropy(100);
        setPhase('collapse');
        return;
      }
      push({ kind: 'action', role: 'system', text: result.narrator });
      if (result.npcLine) push({ kind: 'action', role: 'npc', text: result.npcLine });
      setChoices((result.choices || []).map((item, choiceIndex) => ({
        id: item.id || `ai-${turn}-${choiceIndex}`,
        text: item.text,
        tone: item.tone,
      })));
      applyEffects(result.effects, result.entropyDelta);
      setTurn((prev) => prev + 1);
      setPhase('ready');
    } catch (error) {
      push({ kind: 'action', role: 'system', text: `推演失败：${error.message || '网络异常'}，请重试` });
      setPhase('ready');
    }
  }, [phase, push, onRecordChoice, event, dynasty, npc, turn, entropy, historyText, applyEffects]);

  const talkLog = log.filter((item) => item.kind === 'talk');
  const actionLog = log.filter((item) => item.kind === 'action');
  const busy = phase === 'thinking';

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={`system-modal system-modal--ai system-modal--${phase === 'collapse' ? 'unstable' : 'idle'}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${event.title} · 系统穿越面板`}
        ref={dialogRef}
        onMouseDown={(modalEvent) => modalEvent.stopPropagation()}
      >
        <button className="system-modal__close" type="button" aria-label="关闭系统面板" onClick={onClose}>
          ×
        </button>

        <p className="system-modal__eyebrow">SYSTEM TRANSMISSION / {event.year}</p>
        <h2>{event.title}</h2>
        <p className="system-modal__location">
          {event.locationName} · {event.lat} / {event.lng} · {npc.name}（{npc.title}）
        </p>

        <div className="ai-status-row" aria-hidden="true">
          <span>稳定度 {meters.stability}</span>
          <span>警觉度 {meters.alert}</span>
          <span className={entropy > 60 ? 'ai-status-row__danger' : ''}>崩坏度 {entropy}/100</span>
          <span>第 {turn + 1} 幕</span>
        </div>

        <div className="ai-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'talk'}
            className={`ai-tab ${tab === 'talk' ? 'ai-tab--active' : ''}`}
            onClick={() => setTab('talk')}
          >
            对话 <span>{talkLog.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'action'}
            className={`ai-tab ${tab === 'action' ? 'ai-tab--active' : ''}`}
            onClick={() => setTab('action')}
          >
            行动 <span>{actionLog.length}</span>
          </button>
        </div>

        <div className="ai-log" ref={logRef}>
          {(tab === 'talk' ? talkLog : actionLog).map((item) => {
            if (item.role === 'system') {
              return (
                <p key={item.id} className="ai-line ai-line--system">
                  <span className="terminal-prompt">&gt;</span> {item.text}
                </p>
              );
            }
            if (item.role === 'player') {
              return (
                <p key={item.id} className="ai-line ai-line--player">
                  <span>宿主</span>
                  {item.text}
                </p>
              );
            }
            return (
              <div key={item.id} className="ai-line ai-line--npc">
                <p className="ai-line__name">
                  {npc.name}
                  {item.mood ? <em>· {item.mood}</em> : null}
                </p>
                <p>{item.text}</p>
                {item.info ? <p className="ai-line__info">◈ 线索：{item.info}</p> : null}
              </div>
            );
          })}

          {tab === 'talk' && talkLog.length === 0 && !busy && (
            <p className="ai-line ai-line--system" style={{ opacity: 0.65 }}>
              {npc.name}还没开口。你可以先问他一句。
            </p>
          )}

          {busy && (
            <p className="ai-line ai-line--pending">
              <span className="terminal-prompt">&gt;</span> {tab === 'talk' ? '他在斟酌怎么回你…' : '正在推演此刻…'}
            </p>
          )}
        </div>

        {phase === 'collapse' && ending ? (
          <div className="ai-collapse" role="alert">
            <p className="ai-collapse__eyebrow">TIMELINE COLLAPSED</p>
            <h3>{ending.title}</h3>
            <p>{ending.text}</p>
            {ending.epitaph ? <em>「{ending.epitaph}」</em> : null}
            <p className="ai-collapse__meta">共 {turn} 次干预 · 世界线崩坏度 {entropy}/100</p>
            <button className="neon-button" type="button" onClick={onClose}>
              返回校正台
            </button>
          </div>
        ) : null}

        {phase !== 'collapse' ? (
          tab === 'talk' ? (
            <div className="ai-compose">
              <div className="ai-quick">
                {QUICK_LINES.map((line) => (
                  <button key={line} type="button" disabled={busy} onClick={() => sendTalk(line)}>
                    {line}
                  </button>
                ))}
              </div>
              <div className="ai-input-row">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(inputEvent) => setDraft(inputEvent.target.value)}
                  onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter') sendTalk(draft); }}
                  disabled={busy}
                  placeholder="你想对他说什么…"
                  aria-label="对人物说话"
                />
                <button className="neon-button" type="button" disabled={busy || !draft.trim()} onClick={() => sendTalk(draft)}>
                  说
                </button>
              </div>
            </div>
          ) : (
            <div className="system-modal__options">
              {choices.map((choice, index) => (
                <button
                  className={`choice-button choice-button--${choice.tone}`}
                  type="button"
                  key={choice.id || `${choice.text}-${index}`}
                  disabled={busy}
                  onClick={() => pickChoice(choice, index)}
                >
                  {choice.text}
                </button>
              ))}
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
