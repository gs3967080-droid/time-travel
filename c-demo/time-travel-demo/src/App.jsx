import { useState } from "react";
import MouseGridTrail from "./components/MouseGridTrail";
import SystemModal from "./components/SystemModal";
import { mouseGridExperiment } from "./config/experiments";
import fallbackMockData from "./data/fallbackMockData.json";
import { longTextDemoEvent } from "./data/demoEvents";
import {
  findEventById,
  toSystemModalProps,
} from "./lib/eventAdapter";

const requestedFixture = new URLSearchParams(window.location.search).get(
  "fixture",
);
const demoEvent =
  requestedFixture === "long"
    ? longTextDemoEvent
    : findEventById(fallbackMockData, "tang_anshi");

function App() {
  const [activeEvent, setActiveEvent] = useState(demoEvent);
  const [warningId, setWarningId] = useState(0);

  const handleOptionSelect = (option) => {
    if (option?.tone === "error") {
      setWarningId((currentId) => currentId + 1);
    }
  };

  const handleClose = () => {
    setWarningId(0);
    setActiveEvent(null);
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#020204]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 35%, rgba(0, 255, 255, 0.11), transparent 32%), linear-gradient(rgba(34, 211, 238, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.035) 1px, transparent 1px)",
        backgroundSize: "auto, 42px 42px, 42px 42px",
      }}
    >
      {!activeEvent && <MouseGridTrail {...mouseGridExperiment} />}

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-xs tracking-[0.45em] text-cyan-400/70">
          TIME-DRIFT CONSOLE
        </p>
        <h1 className="mt-5 text-4xl font-black tracking-[0.2em] text-cyan-50 drop-shadow-[0_0_18px_rgba(34,211,238,0.55)] sm:text-6xl">
          时空跃迁
        </h1>
        <p className="mt-5 max-w-lg text-sm leading-7 tracking-widest text-cyan-100/45">
          历史枢纽已锁定。系统正在等待宿主作出选择。
        </p>

        {!activeEvent && (
          <button
            type="button"
            onClick={() => setActiveEvent(demoEvent)}
            className="mt-8 rounded border border-cyan-300/60 bg-cyan-400/10 px-6 py-3 font-mono text-sm tracking-[0.2em] text-cyan-100 transition-all hover:border-cyan-100 hover:bg-cyan-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            style={{
              boxShadow: "0 0 16px rgba(34, 211, 238, 0.28)",
            }}
          >
            重新进入历史节点
          </button>
        )}
      </div>

      {warningId > 0 && (
        <div
          key={warningId}
          className="danger-flash-overlay is-active"
          aria-hidden="true"
          onAnimationEnd={() => setWarningId(0)}
        />
      )}

      {activeEvent && (
        <SystemModal
          {...toSystemModalProps(activeEvent)}
          onOptionSelect={handleOptionSelect}
          onClose={handleClose}
          backgroundEffect={
            <MouseGridTrail {...mouseGridExperiment} />
          }
        />
      )}
    </main>
  );
}

export default App;
