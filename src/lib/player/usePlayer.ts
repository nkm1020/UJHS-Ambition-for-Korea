"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionName, AvatarConfig, Beat, Presence, Room, Seat, StageBubble, StageCue, StageMember } from "@/lib/types";
import { loadBuffer, playBuffer, type Playback } from "./audio";

export type Bubble = StageBubble;

interface ActionState {
  name: ActionName | null;
  key: number; // kept when the action clears, so the avatar is not remounted
}

interface Live {
  presence: Record<string, Presence>;
  action: Record<string, ActionState>;
  look: Record<string, Seat | null>;
  bubbles: Record<string, Bubble | null>;
  caption: { text: string; key: number } | null;
  focus: string | null; // who the first-person camera turns to
  focusGroup: string[]; // everyone in this beat; two or more means a wide shot
  cuts: { key: number; text: string }[]; // captioned moments, newest last, at most 4
  peek: boolean; // Scene+: my head is down but I'm reading through half-closed eyes
  cue: Record<string, StageCue | null>; // one-off reactions outside the script
  busy: boolean;
  scriptDone: boolean;
}

export interface UserMessage {
  audioUrl?: string;
  text?: string;
}

/** A reply still being written (the AI room). Its actor shows "typing" until it lands. */
export interface PendingReply {
  actorId: string;
  beats: Promise<Beat[]>;
}

type QueueItem = Beat | PendingReply;
const isPending = (item: QueueItem): item is PendingReply => "beats" in item;

const ACTION_MS: Record<ActionName, number> = {
  walk_in: 2000,
  sit_up: 500,
  slump: 500,
  talk: 0,
  read_ignore: 1800,
  startle_up: 1200,
  stand_leave: 1800,
  cover_mouth: 1300,
  typing_stop: 1600,
  heart: 900,
  laugh: 1200,
  freeze: 0,
};

// Resting pose to switch to when the action starts / ends.
const PRESENCE_AT_START: Partial<Record<ActionName, Presence>> = {
  walk_in: "watching",
  sit_up: "watching",
  startle_up: "watching",
  talk: "watching",
  cover_mouth: "watching",
  slump: "away",
};
const PRESENCE_AT_END: Partial<Record<ActionName, Presence>> = {
  read_ignore: "away",
  typing_stop: "away",
  stand_leave: "gone",
};

const GAP_MS = 260;
const MIN_TYPING_MS = 700; // so a fast reply still reads as typing

// Scene+ peek: how long I get away with it before someone watching notices,
// how long they hold the look, and how long their 👀 stays after I sit up.
const PEEK_CAUGHT_MS = 2600;
const PEEK_HOLD_MS = 1700;
const CUE_FADE_MS = 1300;

function textMs(text?: string): number {
  return Math.max(1500, (text?.length ?? 0) * 60);
}

function initialLive(room: Room): Live {
  const presence: Record<string, Presence> = {};
  const action: Record<string, ActionState> = {};
  for (const m of room.members) {
    presence[m.id] = m.id === "me" ? "gone" : m.startsAs;
    action[m.id] = { name: null, key: 0 };
  }
  return {
    presence,
    action,
    look: {},
    bubbles: {},
    caption: null,
    focus: null,
    focusGroup: [],
    cuts: [],
    peek: false,
    cue: {},
    busy: false,
    scriptDone: false,
  };
}

export function usePlayer(room: Room, myAvatar: AvatarConfig) {
  const [live, setLive] = useState<Live>(() => initialLive(room));

  const presenceRef = useRef<Record<string, Presence>>(initialLive(room).presence);
  const levels = useRef(new Map<string, number>());
  const fakeTalk = useRef(new Set<string>());
  const queue = useRef<QueueItem[]>([]);
  const running = useRef(false);
  const generation = useRef(0);
  const keySeq = useRef(1);
  const lastSpeaker = useRef<string | null>(null);
  const playback = useRef<Playback | null>(null);
  const userMessages = useRef(0);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const seatOf = useMemo(() => {
    const map: Record<string, Seat> = {};
    for (const m of room.members) map[m.id] = m.seat;
    return map;
  }, [room]);

  const getTalkLevel = useCallback((id: string) => {
    if (fakeTalk.current.has(id)) return 0.3 + 0.5 * Math.abs(Math.sin(performance.now() / 85));
    return levels.current.get(id) ?? 0;
  }, []);

  const setPresence = useCallback((id: string, p: Presence) => {
    presenceRef.current = { ...presenceRef.current, [id]: p };
    setLive((s) => ({ ...s, presence: { ...s.presence, [id]: p } }));
  }, []);

  const playBeat = useCallback(
    async (beat: Beat, gen: number) => {
      const alive = () => gen === generation.current;
      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const actor = beat.actorId;
      const speaks = beat.action === "talk" || beat.action === "cover_mouth";

      // Anyone slumped sits up before talking.
      if (speaks && presenceRef.current[actor] === "away") {
        const key = keySeq.current++;
        setPresence(actor, "watching");
        setLive((s) => ({ ...s, action: { ...s.action, [actor]: { name: "sit_up", key } } }));
        await sleep(ACTION_MS.sit_up);
        if (!alive()) return;
      }

      // Start: clear last beat's one-shots, set this beat's actions.
      const look: Record<string, Seat | null> = {};
      if (beat.action === "read_ignore" && lastSpeaker.current && lastSpeaker.current !== actor) {
        look[actor] = seatOf[lastSpeaker.current];
      }
      if (beat.action === "walk_in") {
        for (const m of room.members) {
          if (m.id !== actor && presenceRef.current[m.id] === "watching") look[m.id] = seatOf[actor];
        }
      }

      const startPresence = PRESENCE_AT_START[beat.action];
      if (startPresence) setPresence(actor, startPresence);

      setLive((s) => {
        const action: Record<string, ActionState> = {};
        for (const id of Object.keys(s.action)) action[id] = { name: null, key: s.action[id].key };
        action[actor] = { name: beat.action, key: keySeq.current++ };
        for (const r of beat.reactions ?? []) action[r.actorId] = { name: r.action, key: keySeq.current++ };

        const bubbles = { ...s.bubbles };
        if (beat.action === "typing_stop") bubbles[actor] = { key: keySeq.current++, kind: "typing" };
        if (beat.action === "cover_mouth") bubbles[actor] = { key: keySeq.current++, kind: "unsent", text: beat.text };
        if (beat.action === "talk" && !beat.audio) bubbles[actor] = { key: keySeq.current++, kind: "text", text: beat.text };

        const caption = beat.caption ? { text: beat.caption, key: keySeq.current++ } : null;
        return {
          ...s,
          action,
          look,
          bubbles,
          caption,
          cuts: caption ? [...s.cuts, caption].slice(-4) : s.cuts,
          focus: beat.action === "walk_in" ? null : actor,
          focusGroup: groupFor(beat, room, presenceRef.current),
        };
      });

      // Wait for the action to play out.
      if (speaks && beat.audio) {
        const buffer = await loadBuffer(beat.audio);
        if (!alive()) return;
        if (buffer) {
          if (beat.action === "talk") {
            const kind = beat.text ? "text" : "voice";
            setLive((s) => ({
              ...s,
              bubbles: {
                ...s.bubbles,
                [actor]: { key: keySeq.current++, kind, text: beat.text, voiceSec: buffer.duration },
              },
            }));
          }
          playback.current = playBuffer(buffer, (level) => levels.current.set(actor, level));
          await playback.current.done;
          playback.current = null;
        } else {
          // Audio missing: show the text and fake the mouth.
          if (beat.action === "talk") {
            setLive((s) => ({
              ...s,
              bubbles: { ...s.bubbles, [actor]: { key: keySeq.current++, kind: "text", text: beat.text ?? "🎤" } },
            }));
          }
          fakeTalk.current.add(actor);
          await sleep(textMs(beat.text));
          fakeTalk.current.delete(actor);
        }
      } else if (beat.action === "talk") {
        fakeTalk.current.add(actor);
        await sleep(textMs(beat.text));
        fakeTalk.current.delete(actor);
      } else if (beat.action === "cover_mouth") {
        fakeTalk.current.add(actor);
        await sleep(450);
        fakeTalk.current.delete(actor);
        await sleep(ACTION_MS.cover_mouth - 450);
      } else {
        await sleep(beat.maxMs ?? ACTION_MS[beat.action]);
      }
      if (!alive()) return;

      // End: settle pose, drop bubbles and head turns.
      const endPresence = PRESENCE_AT_END[beat.action];
      if (endPresence) setPresence(actor, endPresence);
      if (speaks) lastSpeaker.current = actor;

      setLive((s) => {
        const action = { ...s.action, [actor]: { name: null, key: s.action[actor]?.key ?? 0 } };
        const bubbles = { ...s.bubbles };
        if (beat.action !== "talk") bubbles[actor] = null;
        return { ...s, action, look: {}, bubbles };
      });
      if (beat.action === "talk") {
        // Let the bubble linger a moment after the voice ends.
        const lingering = keySeq.current;
        setTimeout(() => {
          if (!alive()) return;
          setLive((s) => {
            const b = s.bubbles[actor];
            if (!b || b.key >= lingering) return s;
            return { ...s, bubbles: { ...s.bubbles, [actor]: null } };
          });
        }, 900);
      }
      await sleep(GAP_MS);
    },
    [room, seatOf, setPresence],
  );

  // Show the actor typing until their reply arrives, then play it next.
  const awaitReply = useCallback(async (pending: PendingReply, gen: number) => {
    const actor = pending.actorId;
    const typing = keySeq.current++;
    setLive((s) => ({
      ...s,
      focus: actor,
      focusGroup: [actor],
      bubbles: { ...s.bubbles, [actor]: { key: typing, kind: "typing" } },
    }));
    const [beats] = await Promise.all([
      pending.beats,
      new Promise<void>((r) => setTimeout(r, MIN_TYPING_MS)),
    ]);
    if (gen !== generation.current) return;
    setLive((s) =>
      s.bubbles[actor]?.key === typing ? { ...s, bubbles: { ...s.bubbles, [actor]: null } } : s,
    );
    queue.current.unshift(...beats);
  }, []);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const gen = generation.current;
    setLive((s) => ({ ...s, busy: true }));
    while (queue.current.length > 0 && gen === generation.current) {
      const item = queue.current.shift()!;
      if (isPending(item)) await awaitReply(item, gen);
      else await playBeat(item, gen);
    }
    if (gen === generation.current) {
      running.current = false;
      setLive((s) => ({ ...s, busy: false, scriptDone: true, action: clearActions(s.action) }));
    }
  }, [playBeat, awaitReply]);

  const stop = useCallback(() => {
    generation.current++;
    running.current = false;
    queue.current = [];
    playback.current?.stop();
    playback.current = null;
    fakeTalk.current.clear();
    levels.current.clear();
    clearTimeout(peekTimer.current);
  }, []);

  const start = useCallback(() => {
    stop();
    const fresh = initialLive(room);
    presenceRef.current = fresh.presence;
    lastSpeaker.current = null;
    userMessages.current = 0;
    setLive(fresh);
    for (const beat of [...room.script, ...room.onUserMessage.flat()]) {
      if (beat.audio) void loadBuffer(beat.audio);
    }
    queue.current = [...room.script];
    void run();
  }, [room, run, stop]);

  /** Plays my message, then either `reply` (AI room) or the room's scripted reaction. */
  const send = useCallback(
    (msg: UserMessage, reply?: PendingReply) => {
      if (!msg.audioUrl && !msg.text) return;
      clearTimeout(peekTimer.current);
      setLive((s) => (s.peek ? { ...s, peek: false } : s));
      queue.current.push({ actorId: "me", action: "talk", audio: msg.audioUrl, text: msg.text });
      if (reply) {
        queue.current.push(reply);
      } else {
        const reactions = room.onUserMessage;
        const n = userMessages.current++;
        if (reactions.length > 0) queue.current.push(...reactions[Math.min(n, reactions.length - 1)]);
      }
      void run();
    },
    [room, run],
  );

  // Scene+ peek: put my head down (no read receipt) but keep reading. Anyone
  // still watching can catch me at it: they turn to me with 👀 and I give up
  // and sit up.
  const setPeek = useCallback(
    (on: boolean) => {
      if (presenceRef.current.me === "gone") return; // not at the table yet
      clearTimeout(peekTimer.current);
      setPresence("me", on ? "away" : "watching");
      setLive((s) => ({ ...s, peek: on }));
      if (!on) return;

      const gen = generation.current;
      peekTimer.current = setTimeout(() => {
        if (gen !== generation.current) return;
        const watchers = room.members.filter((m) => m.id !== "me" && presenceRef.current[m.id] === "watching");
        const catcher = watchers.find((m) => m.id === lastSpeaker.current) ?? watchers[0];
        if (!catcher) return; // nobody looking: a clean peek

        const key = keySeq.current++;
        const caption = { text: `${catcher.name} caught you peeking`, key };
        setLive((s) => ({
          ...s,
          cue: { ...s.cue, [catcher.id]: { emoji: "👀", face: "smirk", key } },
          look: { ...s.look, [catcher.id]: seatOf.me ?? null },
          caption,
          cuts: [...s.cuts, caption].slice(-4),
          focus: catcher.id,
          focusGroup: [catcher.id],
        }));

        peekTimer.current = setTimeout(() => {
          if (gen !== generation.current) return;
          setPresence("me", "watching");
          setLive((s) => ({ ...s, peek: false }));
          peekTimer.current = setTimeout(() => {
            if (gen !== generation.current) return;
            setLive((s) => {
              if (s.cue[catcher.id]?.key !== key) return s;
              const look = { ...s.look };
              delete look[catcher.id];
              return { ...s, cue: { ...s.cue, [catcher.id]: null }, look };
            });
          }, CUE_FADE_MS);
        }, PEEK_HOLD_MS);
      }, PEEK_CAUGHT_MS);
    },
    [room, seatOf, setPresence],
  );

  useEffect(() => stop, [stop]);

  const members: StageMember[] = useMemo(
    () =>
      room.members.map((m) => ({
        id: m.id,
        name: m.name,
        seat: m.seat,
        avatar: m.id === "me" ? myAvatar : m.avatar,
        isMe: m.id === "me",
        presence: live.presence[m.id] ?? "watching",
        action: live.action[m.id]?.name ?? null,
        actionKey: live.action[m.id]?.key ?? 0,
        lookAt: live.look[m.id] ?? null,
        cue: live.cue[m.id] ?? null,
      })),
    [room, myAvatar, live.presence, live.action, live.look, live.cue],
  );

  const watching = room.members.filter((m) => m.id !== "me" && live.presence[m.id] === "watching").length;

  return {
    members,
    bubbles: live.bubbles,
    caption: live.caption,
    focusId: live.focus,
    focusGroup: live.focusGroup,
    cuts: live.cuts,
    busy: live.busy,
    scriptDone: live.scriptDone,
    peeking: live.peek,
    setPeek,
    watching,
    getTalkLevel,
    start,
    stop,
    send,
  };
}

// Who belongs in frame for a beat: the actor and anyone reacting. When I
// talk, everyone still at the table is reacting to me, so frame them all.
function groupFor(beat: Beat, room: Room, presence: Record<string, Presence>): string[] {
  if (beat.action === "walk_in") return [];
  if (beat.actorId === "me") {
    return room.members.filter((m) => m.id !== "me" && presence[m.id] !== "gone").map((m) => m.id);
  }
  const ids = [beat.actorId, ...(beat.reactions ?? []).map((r) => r.actorId)].filter((id) => id !== "me");
  return [...new Set(ids)];
}

function clearActions(action: Record<string, ActionState>): Record<string, ActionState> {
  const out: Record<string, ActionState> = {};
  for (const id of Object.keys(action)) out[id] = { name: null, key: action[id].key };
  return out;
}
