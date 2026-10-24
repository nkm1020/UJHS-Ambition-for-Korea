"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import type { AvatarConfig, Room } from "@/lib/types";
import type { Friend } from "@/data/social";
import { useMe } from "@/lib/me";
import { useWeather } from "@/lib/weather";
import { AvatarStand } from "@/components/avatar";
import { BottomSheet } from "@/components/sheet/BottomSheet";
import { RoomCard } from "@/components/sheet/RoomCard";
import { FriendRow } from "@/components/sheet/FriendRow";
import { FriendRoom } from "./FriendRoom";
import { Wardrobe } from "./Wardrobe";

interface MyRoomProps {
  /** Groups and 1:1s together, newest message first. */
  chats: Room[];
  friends: Friend[];
  visited: string[];
  onOpen: (roomId: string) => void;
}

type Tab = "chats" | "friends";

// Editing the look happens in the room itself: the sheet drops away, the
// camera dollies in on the figure, and the color panel rises. Leaving runs it
// backwards; "closing" holds the sheet down until the camera is mostly out.
type EditPhase = "off" | "on" | "closing";
const SHEET_RETURN_MS = 480;

// Enter finishes the edit. Skip it mid-composition so a Korean syllable
// being typed isn't cut off.
function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur();
}

export function MyRoom({ chats, friends, visited, onOpen }: MyRoomProps) {
  const { me, avatar, setAvatar, setName, setStatus } = useMe();
  const weather = useWeather();
  const [phase, setPhase] = useState<EditPhase>("off");
  const [draft, setDraft] = useState<AvatarConfig>(avatar);
  const [tab, setTab] = useState<Tab>("chats");
  const [visiting, setVisiting] = useState<Friend | null>(null);
  const watchingNow = friends.filter((f) => f.presence === "watching").length;

  useEffect(() => {
    if (phase !== "closing") return;
    const t = setTimeout(() => setPhase("off"), SHEET_RETURN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const startEdit = () => {
    setDraft(avatar);
    setPhase("on");
  };
  const endEdit = (save: boolean) => {
    if (save) setAvatar(draft);
    setPhase("closing");
  };

  return (
    <div className="home">
      <div className="home-space">
        <AvatarStand avatar={phase === "on" ? draft : avatar} focus={phase === "on"} />
      </div>

      <header className={`home-bar ${phase !== "off" ? "is-hidden" : ""}`} inert={phase !== "off"}>
        <div className="home-id">
          <input
            className="home-name"
            value={me.name}
            placeholder="Your name"
            aria-label="Your name"
            maxLength={16}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => setName(e.target.value.trim())}
            onKeyDown={blurOnEnter}
          />
          {weather && (
            <p className="home-weather">
              {Math.round(weather.tempC)}° · {weather.label}
            </p>
          )}
          <input
            className="home-status"
            value={me.status}
            placeholder="Add a one-line intro"
            aria-label="One-line intro"
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setStatus(e.target.value)}
            onBlur={(e) => setStatus(e.target.value.trim())}
            onKeyDown={blurOnEnter}
          />
        </div>
        <button className="glass-btn" onClick={startEdit}>
          Edit look
        </button>
      </header>

      <BottomSheet
        title={tab === "chats" ? "Chats" : "Friends"}
        subtitle={`${watchingNow} watching now`}
        hidden={phase !== "off"}
      >
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
          <div className="list">
            {chats.map((room, i) => (
              <RoomCard
                key={room.id}
                room={room}
                unread={visited.includes(room.id) ? 0 : room.unread}
                hint={i === 0 && visited.length === 0}
                onOpen={onOpen}
              />
            ))}
          </div>
        ) : (
          <>
            <h3 className="list-label">
              {watchingNow} watching · {friends.length - watchingNow} away
            </h3>
            <div className="list">
              {friends.map((f) => (
                <FriendRow key={f.id} friend={f} onSelect={setVisiting} />
              ))}
            </div>
          </>
        )}
      </BottomSheet>

      {visiting && <FriendRoom friend={visiting} onBack={() => setVisiting(null)} onOpen={onOpen} />}

      <Wardrobe open={phase === "on"} draft={draft} onChange={setDraft} onCancel={() => endEdit(false)} onDone={() => endEdit(true)} />
    </div>
  );
}
