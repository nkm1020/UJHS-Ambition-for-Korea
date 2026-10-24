"use client";

import { useEffect, useRef, useState } from "react";

// Apple Maps style sheet: peek -> half -> full. Drag the header, or tap it to
// step up. The list scrolls only when fully open.

const PEEK = 172;
const SNAPS = [PEEK, 0.56, 0.9] as const; // px for peek, fractions of the frame after

interface BottomSheetProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function BottomSheet({ title, subtitle, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [frameH, setFrameH] = useState(0);
  const [snap, setSnap] = useState(0);
  const [dragY, setDragY] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startT: number; lastY: number; lastT: number; moved: boolean } | null>(null);

  useEffect(() => {
    const parent = sheetRef.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(([entry]) => setFrameH(entry.contentRect.height));
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const heights = SNAPS.map((s, i) => (i === 0 ? s : Math.max(PEEK + 40, s * frameH)));
  const fullH = heights[2];
  const restT = fullH - heights[snap];
  const translate = dragY ?? restT;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startT: translate, lastY: e.clientY, lastT: e.timeStamp, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    setDragY(Math.min(fullH - PEEK, Math.max(0, d.startT + dy)));
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setSnap((s) => (s + 1) % SNAPS.length);
      setDragY(null);
      return;
    }
    const velocity = (e.clientY - d.lastY) / Math.max(1, e.timeStamp - d.lastT); // px/ms, + is down
    const shownH = fullH - (dragY ?? restT) - velocity * 180;
    let best = 0;
    heights.forEach((h, i) => {
      if (Math.abs(h - shownH) < Math.abs(heights[best] - shownH)) best = i;
    });
    setSnap(best);
    setDragY(null);
  };

  return (
    <div
      ref={sheetRef}
      className={`sheet ${dragY !== null ? "is-dragging" : ""} ${snap === 2 ? "is-full" : ""}`}
      style={{ height: fullH || "90%", transform: `translateY(${frameH ? translate : 0}px)` }}
    >
      <div
        className="sheet-grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet-handle" />
        <div className="sheet-title">
          <h2>{title}</h2>
          {subtitle && <span>{subtitle}</span>}
        </div>
      </div>
      <div className="sheet-body">{children}</div>
    </div>
  );
}
