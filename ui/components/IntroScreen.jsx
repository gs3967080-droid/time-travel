import { useEffect, useState } from 'react';
import { useTypewriter } from '../../frontend/src/hooks/useTypewriter.js';

/**
 * 开场页（我的版本）
 *
 * 赛博古风：扫描线、网格、衬线大标题 + 逐字系统开场白，
 * 点「接入时间线」进入历史枢纽。
 * 字体沿用主设计的衬线 / 等宽两套，不跟 A 的楷体方案。
 */
export default function IntroScreen({ copy, onEnter }) {
  const { output, done, skip } = useTypewriter(copy.opening, 38);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="intro-screen">
      <div className="intro-screen__seal" aria-hidden="true">史</div>
      <div className="intro-screen__grid" aria-hidden="true" />
      <div className="intro-screen__glow" aria-hidden="true" />
      <div className="intro-screen__ring" aria-hidden="true">
        <span className="intro-screen__ring-arc" />
        <span className="intro-screen__ring-arc intro-screen__ring-arc--inner" />
        <span className="intro-screen__ring-node" />
      </div>

      <section className={`intro-screen__content ${revealed ? 'is-revealed' : ''}`} onClick={skip}>
        <p className="top-bar__tag">{copy.systemTag}</p>

        <h1 className="intro-screen__title glitch-text" data-text="时空跃迁">
          时空跃迁
        </h1>
        <p className="intro-screen__subtitle">历史枢纽</p>

        <div className="intro-screen__rule" aria-hidden="true" />

        <p className="intro-screen__copy">
          {output}
          {!done && <span className="typewriter-caret" />}
        </p>

        <button
          className="neon-button intro-screen__enter"
          type="button"
          onClick={(event) => { event.stopPropagation(); onEnter(); }}
        >
          {copy.enterLabel}
        </button>

        <p className="intro-screen__meta">DATA SOURCE · {copy.dataSource || '历史枢纽档案'}</p>
        <p className="intro-screen__hint">滚动时间轴定位朝代 · 点击发光坐标进入现场</p>
      </section>
    </main>
  );
}
