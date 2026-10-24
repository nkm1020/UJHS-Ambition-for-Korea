"use client";

import type { StageAnchor } from "@/lib/types";
import type { Bubble } from "@/lib/player/usePlayer";

interface BubbleLayerProps {
  bubbles: Record<string, Bubble | null>;
  anchors: Record<string, StageAnchor>;
  meId: string;
  width: number;
}

const TAIL = 36; // px from the bubble's edge to its tail when edge-aligned
const MARGIN = 8;

function formatSec(sec = 0): string {
  const s = Math.max(1, Math.round(sec));
  return `0:${String(s).padStart(2, "0")}`;
}

// Outer seats grow their bubble inward so it never runs off screen.
function placement(x: number, y: number, width: number): { align: string; style: React.CSSProperties } {
  if (x < width * 0.3) return { align: "align-left", style: { left: Math.max(MARGIN, x - TAIL), top: y } };
  if (x > width * 0.7) return { align: "align-right", style: { right: Math.max(MARGIN, width - x - TAIL), top: y } };
  return { align: "align-center", style: { left: x, top: y } };
}

export function BubbleLayer({ bubbles, anchors, meId, width }: BubbleLayerProps) {
  return (
    <div className="bubble-layer" aria-live="polite">
      {Object.entries(bubbles).map(([id, bubble]) => {
        if (!bubble) return null;
        const anchor = anchors[id];
        if (!anchor) return null;
        const { align, style } = placement(anchor.x, anchor.y, width);
        return (
          <div
            key={bubble.key}
            className={`bubble kind-${bubble.kind} ${align} ${id === meId ? "is-me" : ""}`}
            style={style}
          >
            {bubble.kind === "typing" && (
              <span className="typing" aria-label="typing">
                <i />
                <i />
                <i />
              </span>
            )}
            {bubble.kind === "voice" && (
              <span className="voice">
                <span aria-hidden>🎤</span>
                <span className="bars" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span>{formatSec(bubble.voiceSec)}</span>
              </span>
            )}
            {(bubble.kind === "text" || bubble.kind === "unsent") && <span className="text">{bubble.text}</span>}
            {bubble.kind === "unsent" && <span className="unsent-tag">unsent</span>}
          </div>
        );
      })}
    </div>
  );
}
