"use client";

// Browser speech recognition for bubble text. Returns null where it is not
// available. On phones it is off: running it next to MediaRecorder can leave
// the recording silent, and the voice bubble is a fine fallback.

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function isPhone(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function startSTT(): { stop: () => Promise<string | null> } | null {
  if (typeof window === "undefined" || isPhone()) return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.lang = navigator.language || "en-US";
  rec.continuous = true;
  rec.interimResults = true;

  let finalText = "";
  let interim = "";
  rec.onresult = (e) => {
    interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
  };
  rec.onerror = () => {};

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop: () =>
      new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve(`${finalText}${interim}`.trim() || null);
        };
        rec.onend = done;
        try {
          rec.stop();
        } catch {
          done();
        }
        setTimeout(done, 1200);
      }),
  };
}
