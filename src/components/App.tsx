"use client";

import { useState } from "react";
import { ROOMS } from "@/data/rooms";
import { MeProvider } from "@/lib/me";
import { unlockAudio } from "@/lib/player/audio";
import { MyRoom } from "@/components/myroom/MyRoom";
import { RoomView } from "@/components/room/RoomView";

export default function App() {
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const room = ROOMS.find((r) => r.id === openRoomId) ?? null;

  const open = (id: string) => {
    unlockAudio(); // must run inside the tap, before the room starts playing
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    setOpenRoomId(id);
  };

  return (
    <MeProvider>
      <div className="app-shell">
        <main className="app-frame">
          {room ? (
            <RoomView key={room.id} room={room} onBack={() => setOpenRoomId(null)} />
          ) : (
            <MyRoom rooms={ROOMS} visited={visited} onOpen={open} />
          )}
        </main>
      </div>
    </MeProvider>
  );
}
