"use client";

import { useState } from "react";
import type { Room } from "@/lib/types";
import { useMe } from "@/lib/me";
import { AvatarStand } from "@/components/avatar";
import { BottomSheet } from "@/components/sheet/BottomSheet";
import { RoomCard } from "@/components/sheet/RoomCard";
import { Wardrobe } from "./Wardrobe";

interface MyRoomProps {
  rooms: Room[];
  visited: string[];
  onOpen: (roomId: string) => void;
}

export function MyRoom({ rooms, visited, onOpen }: MyRoomProps) {
  const { avatar, setAvatar } = useMe();
  const [editing, setEditing] = useState(false);
  const firstUnvisited = rooms.find((r) => !visited.includes(r.id))?.id;
  const watchingNow = rooms.reduce(
    (n, r) => n + r.members.filter((m) => m.id !== "me" && m.startsAs === "watching").length,
    0,
  );

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

      <BottomSheet title="Chats" subtitle={`${watchingNow} friends watching`}>
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
