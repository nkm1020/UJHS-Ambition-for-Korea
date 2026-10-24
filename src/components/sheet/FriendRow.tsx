"use client";

import type { Friend } from "@/data/social";

interface FriendRowProps {
  friend: Friend;
  onSelect: (friend: Friend) => void;
}

// A friend: their head (up if watching, face-down if away), where they are,
// and a tap visits their room.

export function FriendRow({ friend, onSelect }: FriendRowProps) {
  const watching = friend.presence === "watching";
  return (
    <button className="chat-row friend-row" onClick={() => onSelect(friend)}>
      <span
        className={`head solo ${watching ? "" : "is-away"}`}
        style={{ "--c": friend.avatar.body } as React.CSSProperties}
        aria-hidden
      />
      <span className="chat-body">
        <span className="chat-top">
          <strong>{friend.name}</strong>
        </span>
        <span className="chat-meta">
          {watching ? <i className="live-dot" /> : <i className="away-dot" />}
          {watching ? `Watching in ${friend.where}` : `Away · last in ${friend.where}`}
        </span>
      </span>
      <span className="row-action">Visit</span>
    </button>
  );
}
