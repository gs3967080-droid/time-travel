import { useEffect, useRef } from "react";
import "./MouseGridTrail.css";

export default function MouseGridTrail({
  enabled = true,
  radius = 95,
  cellSize = 22,
  lineColor = "rgba(34, 211, 238, 0.65)",
  opacity = 0.72,
  trailLifetime = 1600,
  sampleSpacing = 9,
  maxPoints = 360,
  zIndex = 5,
}) {
  const rootRef = useRef(null);
  const headRef = useRef(null);

  useEffect(() => {
    if (!enabled || !rootRef.current || !headRef.current) {
      return undefined;
    }

    const root = rootRef.current;
    const head = headRef.current;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const activeLifetime = reducedMotion ? 260 : trailLifetime;
    const cells = [];
    let lastSample = null;

    const positionPatch = (element, x, y) => {
      const left = x - radius;
      const top = y - radius;
      element.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      element.style.backgroundPosition = `${-left}px ${-top}px`;
    };

    const removeCell = (cell) => {
      const index = cells.indexOf(cell);

      if (index >= 0) {
        cells.splice(index, 1);
      }

      cell.remove();
    };

    const addTrailCell = (x, y) => {
      const cell = document.createElement("div");
      cell.className =
        "mouse-grid-trail__patch mouse-grid-trail__history";
      cell.setAttribute("aria-hidden", "true");
      cell.style.animationDuration = `${activeLifetime}ms`;
      positionPatch(cell, x, y);
      cell.addEventListener(
        "animationend",
        () => removeCell(cell),
        { once: true },
      );
      root.append(cell);
      cells.push(cell);

      if (cells.length > maxPoints) {
        removeCell(cells[0]);
      }
    };

    const appendPath = (x, y) => {
      if (!lastSample) {
        addTrailCell(x, y);
        lastSample = { x, y };
        return;
      }

      const distanceX = x - lastSample.x;
      const distanceY = y - lastSample.y;
      const distance = Math.hypot(distanceX, distanceY);

      if (distance < 0.5) {
        return;
      }

      const steps = Math.max(
        1,
        Math.min(80, Math.ceil(distance / sampleSpacing)),
      );

      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        addTrailCell(
          lastSample.x + distanceX * progress,
          lastSample.y + distanceY * progress,
        );
      }

      lastSample = { x, y };
    };

    const handlePointerMove = (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      positionPatch(head, event.clientX, event.clientY);
      root.dataset.active = "true";
      appendPath(event.clientX, event.clientY);
    };

    const hideTrail = () => {
      root.dataset.active = "false";
      lastSample = null;

      cells.splice(0).forEach((cell) => cell.remove());
    };

    const handlePointerOut = (event) => {
      if (!event.relatedTarget) {
        hideTrail();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerout", handlePointerOut);
    window.addEventListener("blur", hideTrail);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerOut);
      window.removeEventListener("blur", hideTrail);
      cells.splice(0).forEach((cell) => cell.remove());
    };
  }, [
    cellSize,
    enabled,
    lineColor,
    maxPoints,
    radius,
    sampleSpacing,
    trailLifetime,
  ]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className="mouse-grid-trail"
      data-active="false"
      aria-hidden="true"
      style={{
        "--grid-radius": `${radius}px`,
        "--grid-size": `${cellSize}px`,
        "--grid-line-color": lineColor,
        "--grid-opacity": opacity,
        zIndex,
      }}
    >
      <div
        ref={headRef}
        className="mouse-grid-trail__patch mouse-grid-trail__head"
      />
    </div>
  );
}
