import { useEffect, useRef, useState } from "react";

const TYPE_SPEED = 34;
const SWITCH_DELAY = 150;

/**
 * 逐字显示文字。
 * reducedMotion 为 true 时直接显示完整文字，避免无障碍设置失效。
 */
function TypewriterText({ text, speed, reducedMotion }) {
  const [visibleLength, setVisibleLength] = useState(
    reducedMotion ? text.length : 0,
  );

  useEffect(() => {
    if (reducedMotion || !text) {
      return undefined;
    }

    let currentLength = 0;

    const timer = window.setInterval(() => {
      currentLength += 1;
      setVisibleLength(currentLength);

      if (currentLength >= text.length) {
        window.clearInterval(timer);
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [reducedMotion, speed, text]);

  const renderedLength = reducedMotion
    ? text.length
    : Math.min(visibleLength, text.length);
  const isTyping = renderedLength < text.length;

  return (
    <p
      className="min-h-[7rem] whitespace-pre-wrap text-base leading-8 tracking-wide text-cyan-50/90 sm:text-lg"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.slice(0, renderedLength)}</span>
      <span
        aria-hidden="true"
        className={`ml-1 inline-block h-[1.05em] w-[0.13em] translate-y-[0.16em] bg-cyan-300 shadow-[0_0_9px_#22d3ee] ${
          isTyping ? "animate-pulse" : "animate-pulse opacity-60"
        }`}
      />
    </p>
  );
}

/**
 * 系统穿越弹窗。
 *
 * 该组件由父组件决定是否挂载：
 * {isOpen && (
 *   <SystemModal
 *     title={event.title}
 *     content={event.rpgContext}
 *     options={event.options}
 *     onClose={() => setActiveEvent(null)}
 *   />
 * )}
 */
function SystemModalView({
  title,
  content,
  options,
  onOptionSelect,
  onClose,
  backgroundEffect,
}) {
  const safeOptions = Array.isArray(options) ? options : [];

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  });
  const switchTimerRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(mediaQuery.matches);

    mediaQuery.addEventListener?.("change", syncPreference);

    return () => {
      mediaQuery.removeEventListener?.("change", syncPreference);
    };
  }, []);

  useEffect(
    () => () => {
      if (switchTimerRef.current) {
        window.clearTimeout(switchTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return undefined;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => dialog.focus(), 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && onCloseRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        !dialog.contains(activeElement) ||
        activeElement === dialog
      ) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (
        event.shiftKey &&
        activeElement === firstElement
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        activeElement === lastElement
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const selectedOption =
    selectedIndex === null ? null : safeOptions[selectedIndex];
  const visibleText = String(selectedOption?.result ?? content ?? "");
  const visibleTitle = title || "系统提示";

  const handleSelect = (index) => {
    const option = safeOptions[index];

    if (isSwitching || !option) {
      return;
    }

    onOptionSelect?.(option, index);

    if (switchTimerRef.current) {
      window.clearTimeout(switchTimerRef.current);
    }

    setIsSwitching(true);

    switchTimerRef.current = window.setTimeout(
      () => {
        setSelectedIndex(index);
        setIsSwitching(false);
      },
      reducedMotion ? 0 : SWITCH_DELAY,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-modal-title"
      aria-describedby="system-modal-description"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-black/80 backdrop-blur-md"
      />

      {backgroundEffect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
        >
          {backgroundEffect}
        </div>
      )}

      <section
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-20 w-full max-w-2xl overflow-hidden rounded-lg border border-cyan-300/80 bg-[#050505]/95 focus:outline-none"
        aria-label={visibleTitle}
        style={{
          boxShadow:
            "0 0 12px rgba(34, 211, 238, 0.72), 0 0 38px rgba(34, 211, 238, 0.34), inset 0 0 32px rgba(34, 211, 238, 0.08)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[length:100%_5px]"
        />

        <span
          aria-hidden="true"
          className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-cyan-200"
        />
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-cyan-200"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-cyan-200"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-cyan-200"
        />

        <div className="relative max-h-[90vh] overflow-y-auto p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-cyan-400/25 pb-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]"
              />
              <p className="font-mono text-[11px] tracking-[0.35em] text-cyan-400/80">
                SYSTEM // TIME-DRIFT LINK
              </p>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭系统弹窗"
                className="rounded border border-cyan-400/35 px-2.5 py-1 font-mono text-sm text-cyan-300/70 transition-colors hover:border-cyan-200 hover:bg-cyan-400/10 hover:text-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                ×
              </button>
            )}
          </div>

          <h2
            id="system-modal-title"
            className="mb-4 text-xl font-bold tracking-widest text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)] sm:text-2xl"
          >
            {visibleTitle}
          </h2>

          <div
            id="system-modal-description"
            className={`transition-[opacity,transform] duration-200 ease-out ${
              isSwitching
                ? "translate-y-1 opacity-0"
                : "translate-y-0 opacity-100"
            }`}
          >
            <TypewriterText
              key={`${selectedIndex ?? "situation"}-${visibleText}`}
              text={visibleText}
              speed={TYPE_SPEED}
              reducedMotion={reducedMotion}
            />
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {safeOptions.map((option, index) => {
              const isSelected = selectedIndex === index;

              return (
                <button
                  key={`${option?.text ?? "option"}-${index}`}
                  type="button"
                  onClick={() => handleSelect(index)}
                  disabled={isSwitching}
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-16 items-center gap-3 overflow-hidden rounded border px-4 py-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                    isSelected
                      ? "border-cyan-200 bg-cyan-400/15 text-cyan-50"
                      : "border-cyan-500/40 bg-cyan-950/20 text-cyan-100/80 hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-400/10"
                  } disabled:cursor-wait disabled:opacity-60`}
                  style={{
                    boxShadow: isSelected
                      ? "0 0 10px rgba(34,211,238,0.72), inset 0 0 18px rgba(34,211,238,0.12)"
                      : "0 0 7px rgba(34,211,238,0.2)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-mono text-xs text-cyan-500"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium leading-6 tracking-wide sm:text-base">
                    {option?.text ?? "未命名选项"}
                  </span>
                </button>
              );
            })}
          </div>

          {safeOptions.length === 0 && (
            <p className="mt-7 rounded border border-rose-400/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
              系统未检测到可用选项。
            </p>
          )}

          {selectedOption && onClose && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-cyan-300/70 bg-cyan-400/10 px-5 py-2.5 font-mono text-sm tracking-[0.2em] text-cyan-100 transition-all hover:border-cyan-100 hover:bg-cyan-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                style={{
                  boxShadow: "0 0 12px rgba(34, 211, 238, 0.35)",
                }}
              >
                结束穿越
              </button>
            </div>
          )}

          <div
            aria-hidden="true"
            className="mt-6 flex items-center justify-between border-t border-cyan-400/20 pt-3 font-mono text-[10px] tracking-[0.2em] text-cyan-500/60"
          >
            <span>{selectedOption ? "TIMELINE MODIFIED" : "AWAITING CHOICE"}</span>
            <span className="flex items-center gap-2">
              LINK STABLE
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SystemModal({
  title,
  content = "",
  options = [],
  onOptionSelect,
  onClose,
  backgroundEffect,
}) {
  const safeOptions = Array.isArray(options) ? options : [];
  const optionsKey = safeOptions
    .map((option) => `${option?.text ?? ""}\u0000${option?.result ?? ""}`)
    .join("\u0001");

  return (
    <SystemModalView
      key={`${title ?? ""}\u0000${content ?? ""}\u0000${optionsKey}`}
      title={title}
      content={content}
      options={safeOptions}
      onOptionSelect={onOptionSelect}
      onClose={onClose}
      backgroundEffect={backgroundEffect}
    />
  );
}
