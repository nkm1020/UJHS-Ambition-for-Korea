"use client";

import { useEffect, useRef, useState } from "react";
import type { CatchUp, Room, StageAnchor } from "@/lib/types";
import { useMe } from "@/lib/me";
import { usePlayer, type UserMessage } from "@/lib/player/usePlayer";
import { createAgentChat, fetchCatchUp, replyBeats } from "@/lib/ai";
import { setMuted } from "@/lib/player/audio";
import { AvatarStage, STAGE_MODE } from "@/components/avatar";
import { defaultAnchor } from "@/components/avatar/seatLayout";
import { IconBack, IconSound } from "@/components/icons";
import { BubbleLayer } from "./BubbleLayer";
import { CatchUpCard } from "./CatchUpCard";
import { Composer } from "./Composer";

interface RoomViewProps {
  room: Room;
  voiceId: string | null;
  onBack: () => void;
}

export function RoomView({ room, voiceId, onBack }: RoomViewProps) {
  const { avatar } = useMe();
  const player = usePlayer(room, avatar);
  const { start, stop } = player;
  const [anchors, setAnchors] = useState<Record<string, StageAnchor>>({});
  const [muted, setMutedState] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  const [agent] = useState(() => (room.agentId ? createAgentChat() : null));
  const [catchUp, setCatchUp] = useState<CatchUp | null>(null);
  const [catchUpOpen, setCatchUpOpen] = useState(true);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  // Ask for the summary on entry, so it is ready by the time the replay ends.
  useEffect(() => {
    const fallback = room.catchUp;
    if (!fallback) return;
    const ctrl = new AbortController();
    void fetchCatchUp(room.id, ctrl.signal).then((summary) => {
      if (!ctrl.signal.aborted) setCatchUp(summary ?? fallback);
    });
    return () => ctrl.abort();
  }, [room]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setStageBox({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const send = (msg: UserMessage) => {
    if (player.scriptDone) setCatchUpOpen(false); // make room for my bubble
    const agentId = room.agentId;
    if (!agent || !agentId) {
      player.send(msg);
      return;
    }
    const beats = agent.reply(msg.text).then((reply) => replyBeats(agentId, reply));
    player.send(msg, { actorId: agentId, beats });
  };

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
          focusGroup={player.focusGroup}
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
        {room.catchUp && player.scriptDone && (
          <CatchUpCard summary={catchUp} open={catchUpOpen} onOpenChange={setCatchUpOpen} />
        )}
        {player.caption && (
          <div key={player.caption.key} className="caption">
            {player.caption.text}
          </div>
        )}
      </div>

      <Composer onSend={send} voiceId={voiceId} nudge={player.scriptDone && !player.busy} />

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
