"use client";

import type { Friend } from "@/data/social";
import { AvatarStand } from "@/components/avatar";
import { IconBack } from "@/components/icons";

// A friend's room: their avatar standing in their own space, pushed in over
// My Room so Back lands you on the Friends list where you left it. Watching
// friends smile at you; away friends stare blankly. The one action is to go
// sit with them in the group they are in.

interface FriendRoomProps {
  friend: Friend;
  onBack: () => void;
  onOpen: (roomId: string) => void;
}

export function FriendRoom({ friend, onBack, onOpen }: FriendRoomProps) {
  const watching = friend.presence === "watching";
  return (
    <div
      className="friend-room"
      role="dialog"
      aria-modal="true"
      aria-label={`${friend.name}'s room`}
      style={{ background: friend.look?.wall }}
    >
      <div className="home-space">
        <AvatarStand avatar={friend.avatar} look={friend.look} face={watching ? "happy" : "blank"} />
      </div>

      <header className="home-bar">
        <button className="glass-btn is-icon" aria-label="Back to Friends" onClick={onBack}>
          <IconBack size={20} />
        </button>
      </header>

      <section className="friend-card">
        <div className="friend-card-top">
          <h2>{friend.name}&apos;s room</h2>
          <span className="chat-meta">
            {watching ? <i className="live-dot" /> : <i className="away-dot" />}
            {watching ? `Watching in ${friend.where}` : `Away · last in ${friend.where}`}
          </span>
        </div>
        <button className="primary-btn" onClick={() => onOpen(friend.roomId)}>
          {watching ? `Join ${friend.name} in ${friend.where}` : `Open ${friend.where}`}
        </button>
      </section>
    </div>
  );
}
