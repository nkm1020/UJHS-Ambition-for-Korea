"use client";

import { useState } from "react";
import type { Room } from "@/lib/types";
import type { Friend } from "@/data/social";
import { useMe } from "@/lib/me";
import { AvatarStand } from "@/components/avatar";
import { BottomSheet } from "@/components/sheet/BottomSheet";
import { RoomCard } from "@/components/sheet/RoomCard";
import { FriendRow } from "@/components/sheet/FriendRow";
import { Wardrobe } from "./Wardrobe";

interface MyRoomProps {
  rooms: Room[];
  dms: Room[];
  friends: Friend[];
  visited: string[];
  onOpen: (roomId: string) => void;
}

type Tab = "chats" | "friends";

export function MyRoom({ rooms, dms, friends, visited, onOpen }: MyRoomProps) {
  const { avatar, setAvatar } = useMe();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>("chats");
  const firstUnvisited = rooms.find((r) => !visited.includes(r.id))?.id;
  const watchingNow = friends.filter((f) => f.presence === "watching").length;

  return (
    <div className="home">
      <div className="home-space">
        <AvatarStand avatar={avatar} />
      </div>

      <header className="home-bar">
        <span className="wordmark">Scene</span>
        <button className="glass-btn" onClick={() => setEditing(true)}>
          Edit look
        </button>
      </header>

      <BottomSheet title={tab === "chats" ? "Chats" : "Friends"} subtitle={`${watchingNow} watching now`}>
        <div className="seg" role="tablist" aria-label="Show">
          <button role="tab" aria-selected={tab === "chats"} className={tab === "chats" ? "is-on" : ""} onClick={() => setTab("chats")}>
            Chats
          </button>
          <button
            role="tab"
            aria-selected={tab === "friends"}
            className={tab === "friends" ? "is-on" : ""}
            onClick={() => setTab("friends")}
          >
            Friends
          </button>
        </div>

        {tab === "chats" ? (
          <>
            <h3 className="list-label">Groups</h3>
            <div className="list">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  unread={visited.includes(room.id) ? 0 : room.unread}
                  hint={room.id === firstUnvisited && visited.length === 0}
                  onOpen={onOpen}
                />
              ))}
            </div>
            <h3 className="list-label">Direct</h3>
            <div className="list">
              {dms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  unread={visited.includes(room.id) ? 0 : room.unread}
                  hint={false}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <h3 className="list-label">
              {watchingNow} watching · {friends.length - watchingNow} away
            </h3>
            <div className="list">
              {friends.map((f) => (
                <FriendRow key={f.id} friend={f} onOpen={onOpen} />
              ))}
            </div>
          </>
        )}
      </BottomSheet>

      {editing && (
        <Wardrobe
          avatar={avatar}
          onCancel={() => setEditing(false)}
          onDone={(next) => {
            setAvatar(next);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
