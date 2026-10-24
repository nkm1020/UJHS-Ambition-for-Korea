"use client";

import type { Room } from "@/lib/types";

interface RoomCardProps {
  room: Room;
  unread: number;
  hint: boolean;
  onOpen: (roomId: string) => void;
}

// One row per room: friends as small heads (sitting up = watching,
// face-down = away), the last line, and who is here.

export function RoomCard({ room, unread, hint, onOpen }: RoomCardProps) {
  const others = room.members.filter((m) => m.id !== "me");
  const watching = others.filter((m) => m.startsAs === "watching").length;
  const away = others.length - watching;

  return (
    <button className="chat-row" onClick={() => onOpen(room.id)}>
      <span className="heads" aria-hidden>
        {others.slice(0, 3).map((m) => (
          <span
            key={m.id}
            className={`head ${m.startsAs === "watching" ? "" : "is-away"}`}
            style={{ "--c": m.avatar.body } as React.CSSProperties}
          />
        ))}
      </span>
      <span className="chat-body">
        <span className="chat-top">
          <strong>
            {room.title} <span aria-hidden>{room.emoji}</span>
          </strong>
          {unread > 0 && <span className="unread">{unread}</span>}
        </span>
        <span className="chat-preview">{room.preview}</span>
        <span className="chat-meta">
          <i className="live-dot" /> {watching} watching
          <span className="sep">·</span>
          {away} away
        </span>
      </span>
      {hint && <span className="row-hint">Start here</span>}
    </button>
  );
}
