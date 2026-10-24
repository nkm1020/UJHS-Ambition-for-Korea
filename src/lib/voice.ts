"use client";

// Client side of voice cloning. Talks only to our own /api/voice routes.
// Every call has a timeout and returns null on failure, so callers fall back
// to text bubbles instead of waiting.

const KEY = "scene.voice.v1";

export const VOICE_LINE = "Hey, it's me. Pizza at eight? I'm totally in.";

export interface SavedVoice {
  done: boolean; // finished or skipped onboarding
  voiceId: string | null;
}

export function loadVoice(): SavedVoice {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as SavedVoice | null;
    if (v && typeof v.done === "boolean") return v;
  } catch {}
  return { done: false, voiceId: null };
}

export function saveVoice(v: SavedVoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await run(ctrl.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function cloningAvailable(): Promise<boolean> {
  const r = await withTimeout(4000, async (signal) => {
    const res = await fetch("/api/voice/enroll", { signal });
    return res.ok ? ((await res.json()) as { configured: boolean }).configured : false;
  });
  return r ?? false;
}

export async function enrollVoice(recording: Blob, text = VOICE_LINE): Promise<string | null> {
  return withTimeout(45000, async (signal) => {
    const form = new FormData();
    form.append("file", recording, "voice");
    form.append("text", text);
    form.append("lang", "en");
    const res = await fetch("/api/voice/enroll", { method: "POST", body: form, signal });
    if (!res.ok) return null;
    return ((await res.json()) as { voiceId?: string }).voiceId ?? null;
  });
}

/** Returns a blob URL of the line in the cloned voice, or null. */
export async function speakAs(voiceId: string, text: string, timeoutMs = 15000): Promise<string | null> {
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetch("/api/voice/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voiceId, text }),
      signal,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? URL.createObjectURL(blob) : null;
  });
}
