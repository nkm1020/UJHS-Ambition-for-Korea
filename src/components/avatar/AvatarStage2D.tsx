"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarStageProps, Seat, StageAnchor } from "@/lib/types";
import { FlatAvatar } from "./FlatAvatar";
import { SEAT_LAYOUT, avatarSize, defaultAnchor, lookDirection } from "./seatLayout";

// 2D placeholder for the round-table scene. The three.js stage replaces this
// through src/components/avatar/index.ts and keeps the same props.

export function AvatarStage2D({ members, getTalkLevel, onAnchors }: AvatarStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: width, h: height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const seatsKey = members.map((m) => `${m.id}:${m.seat}`).join(",");
  useEffect(() => {
    if (!onAnchors || box.w === 0) return;
    const anchors: Record<string, StageAnchor> = {};
    for (const m of members) anchors[m.id] = defaultAnchor(m.seat, box.w, box.h);
    onAnchors(anchors);
    // members only matter through their seats here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.w, box.h, seatsKey, onAnchors]);

  const size = avatarSize(box.w || 360);

  return (
    <div ref={rootRef} className="stage2d">
      <div className="stage2d-wall">
        <div className="stage2d-window" />
        <div className="stage2d-frame" />
        <div className="stage2d-plant" />
      </div>
      <div className="stage2d-floor" />

      {box.w > 0 &&
        members.map((m) => {
          const { x, y } = SEAT_LAYOUT[m.seat as Seat];
          const left = x * box.w;
          const top = y * box.h;
          const leaving = m.presence === "gone" || m.action === "stand_leave";
          const hidden = m.presence === "gone" && m.action !== "stand_leave" && m.action !== "walk_in";
          return (
            <div key={m.id}>
              <div
                className={`stage2d-chair ${leaving ? "is-pushed" : ""}`}
                style={{ left, top: top - size * 0.72, width: size * 0.92, height: size * 1.05 }}
              />
              {!hidden && (
                <div
                  className="stage2d-seat"
                  style={{ left, top: top - size * 1.08, zIndex: 10 + (m.seat === 2 ? 2 : m.seat % 2) }}
                >
                  <div key={m.actionKey} className="stage2d-actor">
                    <FlatAvatar
                      avatar={m.avatar}
                      pose="sit"
                      size={size}
                      presence={m.presence === "gone" ? "watching" : m.presence}
                      action={m.action}
                      look={lookDirection(m.seat, m.lookAt)}
                      talkId={m.id}
                      getTalkLevel={getTalkLevel}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

      <div className="stage2d-table" />

      {box.w > 0 &&
        members.map((m) => {
          if (m.presence === "gone" && m.action !== "walk_in") return null;
          const { x, y } = SEAT_LAYOUT[m.seat as Seat];
          return (
            <div
              key={`tag-${m.id}`}
              className={`stage2d-tag ${m.isMe ? "is-me" : ""} ${m.presence === "away" ? "is-away" : ""}`}
              style={{ left: x * box.w, top: y * box.h + size * 0.16 }}
            >
              {m.name}
            </div>
          );
        })}
    </div>
  );
}
