"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

/* Stepped pitch deck: one slide at a time — keys, wheel, buttons, dots.
   No free scrolling; the track translates between slides. */
export function Deck({ children }: { children: React.ReactNode }) {
  const slides = Children.toArray(children);
  const n = slides.length;
  const [i, setI] = useState(0);
  const lock = useRef(false);

  const go = useCallback(
    (d: number) => setI((v) => Math.max(0, Math.min(n - 1, v + d))),
    [n],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, n]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (lock.current || Math.abs(e.deltaY) < 24) return;
      lock.current = true;
      go(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => (lock.current = false), 800);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [go]);

  // basic swipe
  useEffect(() => {
    let y0 = 0;
    const start = (e: TouchEvent) => (y0 = e.touches[0]!.clientY);
    const end = (e: TouchEvent) => {
      const dy = y0 - e.changedTouches[0]!.clientY;
      if (Math.abs(dy) > 60) go(dy > 0 ? 1 : -1);
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchend", end);
    };
  }, [go]);

  return (
    <div className="deck deck-viewport">
      <div className="deck-track" style={{ transform: `translateY(-${i * 100}%)` }}>
        {slides.map((s, k) => (
          <div className="deck-slide" key={k} aria-hidden={k !== i}>
            {s}
          </div>
        ))}
      </div>

      <div className="deck-ctl">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="previous slide">
          ↑
        </button>
        <span className="mono">
          {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </span>
        <button onClick={() => go(1)} disabled={i === n - 1} aria-label="next slide">
          ↓
        </button>
      </div>

      <div className="deck-dots" role="tablist" aria-label="slides">
        {slides.map((_, k) => (
          <button
            key={k}
            className={k === i ? "on" : ""}
            onClick={() => setI(k)}
            aria-label={`slide ${k + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
