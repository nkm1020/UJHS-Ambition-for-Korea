"use client";

import type { Friend } from "@/data/social";

interface FriendRowProps {
  friend: Friend;
  onOpen: (roomId: string) => void;
}

// A friend: their head (up if watching, face-down if away), where they are,
// and a tap opens your 1:1 chat with them.

export function FriendRow({ friend, onOpen }: FriendRowProps) {
  const watching = friend.presence === "watching";
  return (
    <button className="chat-row friend-row" onClick={() => onOpen(friend.dmId)}>
      <span className="chat-ava is-solo" aria-hidden>
        <span className={`head ${watching ? "" : "is-away"}`} style={{ "--c": friend.avatar.body } as React.CSSProperties} />
      </span>
      <span className="chat-body">
        <span className="chat-top">
          <strong>{friend.name}</strong>
        </span>
        <span className="chat-meta">
          {watching ? <i className="live-dot" /> : <i className="away-dot" />}
          {watching ? `Watching in ${friend.where}` : `Away · last in ${friend.where}`}
        </span>
      </span>
      <span className="row-action">Chat</span>
    </button>
  );
}
