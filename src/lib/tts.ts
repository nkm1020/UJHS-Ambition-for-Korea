"use client";

import type { Beat, Room } from "@/lib/types";

// Friends' lines spoken by OpenAI text-to-speech (/api/tts). Scripted lines
// get a GET URL the player preloads on entry and the CDN keeps; the AI
// friend's live replies are fetched once into a blob URL. Any failure leaves
// the beat without audio, so it plays as a bubble like before.

const VERSION = "1"; // bump when the cast's voices change, so cached audio refreshes

export function ttsUrl(who: string, text: string): string {
  return `/api/tts?${new URLSearchParams({ who, text, v: VERSION })}`;
}

/** The room with every friend's spoken line pointed at /api/tts. My own lines keep my voice. */
export function withVoices(room: Room): Room {
  const voice = (b: Beat): Beat =>
    b.action === "talk" && b.text && b.actorId !== "me" ? { ...b, audio: ttsUrl(b.actorId, b.text) } : b;
  return { ...room, script: room.script.map(voice), onUserMessage: room.onUserMessage.map((r) => r.map(voice)) };
}

/** A live line (the AI friend's reply) as a playable blob URL, or null. */
export async function speakLine(who: string, text: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ who, text }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}
