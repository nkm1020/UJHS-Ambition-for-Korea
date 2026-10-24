"use client";

const MAX_MS = 15000;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];

export function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined"
  );
}

export interface Recording {
  url: string;
  durationSec: number;
}

export interface Recorder {
  /** Resolves with the clip, or null if nothing was captured. */
  stop: () => Promise<Recording | null>;
  /** Fires once if the 15 s limit stops the recording on its own. */
  onAutoStop: (fn: () => void) => void;
}

/** Asks for the mic (first time only) and starts recording. Throws if denied. */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const startedAt = performance.now();
  let result: Promise<Recording | null> | null = null;
  let autoStop: (() => void) | null = null;

  const stop = () => {
    if (result) return result;
    clearTimeout(limit);
    result = new Promise<Recording | null>((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
        const durationSec = (performance.now() - startedAt) / 1000;
        resolve(blob.size > 0 && durationSec > 0.3 ? { url: URL.createObjectURL(blob), durationSec } : null);
      };
      try {
        rec.stop();
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        resolve(null);
      }
    });
    return result;
  };

  const limit = setTimeout(() => {
    void stop();
    autoStop?.();
  }, MAX_MS);

  rec.start();
  return { stop, onAutoStop: (fn) => (autoStop = fn) };
}
