"use client";

import type { Room } from "@/lib/types";

interface RoomCardProps {
  room: Room;
  unread: number;
  hint: boolean;
  onOpen: (roomId: string) => void;
}

// One row per chat, groups and 1:1s alike: friends as small heads (sitting up
// = watching, face-down = away), when the last message came, the last line,
// and who is here.

function ago(min?: number): string {
  if (min === undefined) return "";
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}h`;
  if (min < 48 * 60) return "Yesterday";
  return `${Math.floor(min / (24 * 60))}d`;
}

export function RoomCard({ room, unread, hint, onOpen }: RoomCardProps) {
  const others = room.members.filter((m) => m.id !== "me");
  const watching = others.filter((m) => m.startsAs === "watching").length;
  const away = others.length - watching;
  const dm = room.kind === "dm" || others.length === 1;

  return (
    <button className={`chat-row ${unread > 0 ? "is-unread" : ""}`} onClick={() => onOpen(room.id)}>
      <span className={`chat-ava ${dm ? "is-solo" : ""}`} aria-hidden>
        {(dm ? others.slice(0, 1) : others.slice(0, 3)).map((m) => (
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
            {room.title} {room.emoji && <span aria-hidden>{room.emoji}</span>}
          </strong>
          <span className="chat-time">{ago(room.lastActive)}</span>
        </span>
        <span className="chat-mid">
          <span className="chat-preview">{room.preview}</span>
          {unread > 0 && <span className="unread">{unread}</span>}
        </span>
        <span className="chat-meta">
          {dm ? (
            watching ? (
              <>
                <i className="live-dot" /> Watching now
              </>
            ) : (
              <>
                <i className="away-dot" /> Away
              </>
            )
          ) : (
            <>
              <i className="live-dot" /> {watching} watching
              <span className="sep">·</span>
              {away} away
            </>
          )}
          {hint && <span className="row-hint">Start here</span>}
        </span>
      </span>
    </button>
  );
}
