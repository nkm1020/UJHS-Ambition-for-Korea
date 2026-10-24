"use client";

import { useState } from "react";
import { VoiceSetup } from "@/components/VoiceSetup";
import { loadVoice, saveVoice, type SavedVoice } from "@/lib/voice";
import { ALL_ROOMS, FRIENDS } from "@/data/social";
import { MeProvider } from "@/lib/me";
import { unlockAudio } from "@/lib/player/audio";
import { MyRoom } from "@/components/myroom/MyRoom";
import { RoomView } from "@/components/room/RoomView";

export default function App() {
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [voice, setVoice] = useState<SavedVoice>(loadVoice);
  const room = ALL_ROOMS.find((r) => r.id === openRoomId) ?? null;

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
            <RoomView key={room.id} room={room} voiceId={voice.voiceId} onBack={() => setOpenRoomId(null)} />
          ) : (
            <MyRoom chats={ALL_ROOMS} friends={FRIENDS} visited={visited} onOpen={open} />
          )}
          {!voice.done && (
            <VoiceSetup
              onFinish={(voiceId) => {
                const next = { done: true, voiceId };
                saveVoice(next);
                setVoice(next);
              }}
            />
          )}
        </main>
      </div>
    </MeProvider>
  );
}
