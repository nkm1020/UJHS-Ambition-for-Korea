"use client";

import { useEffect, useRef, useState } from "react";
import type { Room, StageAnchor } from "@/lib/types";
import { useMe } from "@/lib/me";
import { usePlayer } from "@/lib/player/usePlayer";
import { setMuted } from "@/lib/player/audio";
import { AvatarStage, STAGE_MODE } from "@/components/avatar";
import { defaultAnchor } from "@/components/avatar/seatLayout";
import { IconBack, IconSound } from "@/components/icons";
import { BubbleLayer } from "./BubbleLayer";
import { Composer } from "./Composer";

interface RoomViewProps {
  room: Room;
  onBack: () => void;
}

export function RoomView({ room, onBack }: RoomViewProps) {
  const { avatar } = useMe();
  const player = usePlayer(room, avatar);
  const { start, stop } = player;
  const [anchors, setAnchors] = useState<Record<string, StageAnchor>>({});
  const [muted, setMutedState] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setStageBox({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const bubbleAnchors: Record<string, StageAnchor> = {};
  for (const m of room.members) {
    bubbleAnchors[m.id] = anchors[m.id] ?? defaultAnchor(m.seat, stageBox.w, stageBox.h);
  }
  const myBubble = player.bubbles.me ?? null;
  const othersBubbles = STAGE_MODE === "3d" ? player.bubbles : {};

  return (
    <div className="room">
      <header className="room-bar">
        <button className="icon-btn" aria-label="Back to My Room" onClick={onBack}>
          <IconBack />
        </button>
        <div className="room-title">
          <strong>
            {room.title} <span aria-hidden>{room.emoji}</span>
          </strong>
          <span className="presence-line">
            <i className="live-dot" /> {player.watching} watching
          </span>
        </div>
        <button className="icon-btn" aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
          <IconSound on={!muted} />
        </button>
      </header>


      <div className="room-stage" ref={stageRef}>
        <AvatarStage
          members={player.members}
          getTalkLevel={player.getTalkLevel}
          onAnchors={setAnchors}
          focusId={player.focusId}
          bubbles={othersBubbles}
        />
        {STAGE_MODE === "2d" && stageBox.w > 0 && (
          <BubbleLayer bubbles={player.bubbles} anchors={bubbleAnchors} meId="me" width={stageBox.w} />
        )}
        {STAGE_MODE === "3d" && myBubble && (
          <div key={myBubble.key} className={`my-bubble kind-${myBubble.kind}`}>
            {myBubble.kind === "voice" ? (
              <span className="voice">
                <span className="bars" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="num">0:{String(Math.max(1, Math.round(myBubble.voiceSec ?? 0))).padStart(2, "0")}</span>
              </span>
            ) : (
              myBubble.text
            )}
          </div>
        )}
        {player.caption && (
          <div key={player.caption.key} className="caption">
            {player.caption.text}
          </div>
        )}
      </div>

      <Composer onSend={player.send} nudge={player.scriptDone && !player.busy} />

      {!doorOpen && (
        <div className="door" aria-hidden onAnimationEnd={(e) => e.target === e.currentTarget && setDoorOpen(true)}>
          <div className="door-leaf l">
            <i className="knob" />
          </div>
          <div className="door-leaf r">
            <i className="knob" />
          </div>
          <span className="door-sign">{room.title}</span>
        </div>
      )}
    </div>
  );
}
