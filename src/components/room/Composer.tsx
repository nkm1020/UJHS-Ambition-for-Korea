"use client";

import { useEffect, useRef, useState } from "react";
import { canRecord, startRecording, type Recorder } from "@/lib/recorder";
import { startSTT } from "@/lib/stt";
import { unlockAudio } from "@/lib/player/audio";
import type { UserMessage } from "@/lib/player/usePlayer";
import { IconMic, IconSend, IconStop } from "@/components/icons";
import { speakAs } from "@/lib/voice";

interface ComposerProps {
  onSend: (msg: UserMessage) => void;
  voiceId?: string | null;
  nudge: boolean;
}

export function Composer({ onSend, voiceId = null, nudge }: ComposerProps) {
  const [text, setText] = useState("");
  const [micOk, setMicOk] = useState(canRecord);
  const [recStartedAt, setRecStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const recorder = useRef<Recorder | null>(null);
  const stt = useRef<ReturnType<typeof startSTT>>(null);
  const starting = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (recStartedAt === null) return;
    const t = setInterval(() => setElapsed((Date.now() - recStartedAt) / 1000), 200);
    return () => clearInterval(t);
  }, [recStartedAt]);

  const finish = async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    const [clip, said] = await Promise.all([r.stop(), stt.current?.stop() ?? Promise.resolve(null)]);
    stt.current = null;
    setRecStartedAt(null);
    setElapsed(0);
    if (clip) onSend({ audioUrl: clip.url, text: said ?? undefined });
    else setToast("Didn't catch that. Try again?");
  };

  const toggleMic = async () => {
    unlockAudio();
    if (recorder.current) {
      void finish();
      return;
    }
    if (starting.current) return;
    starting.current = true;
    try {
      const r = await startRecording();
      recorder.current = r;
      r.onAutoStop(() => void finish());
      stt.current = startSTT();
      setRecStartedAt(Date.now());
    } catch {
      setMicOk(false);
      setToast("No mic? Type instead.");
    } finally {
      starting.current = false;
    }
  };

  // Typed text is spoken in my cloned voice when I have one; if cloning is
  // slow or down, the message still goes out as a bubble.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || speaking) return;
    unlockAudio();
    setText("");
    if (!voiceId) {
      onSend({ text: t });
      return;
    }
    setSpeaking(true);
    const audioUrl = await speakAs(voiceId, t);
    setSpeaking(false);
    onSend({ text: t, audioUrl: audioUrl ?? undefined });
  };

  const recording = recStartedAt !== null;

  return (
    <div className="composer">
      {toast && <div className="toast">{toast}</div>}
      {speaking && <div className="nudge">Saying it in your voice…</div>}
      {!toast && !speaking && nudge && !recording && (
        <div className="nudge">{micOk ? "Your turn. Tap the mic and say something." : "Your turn. Type something."}</div>
      )}
      <form className="composer-row" onSubmit={submit}>
        {micOk && (
          <button
            type="button"
            className={`mic ${recording ? "is-rec" : ""}`}
            aria-label={recording ? "Stop and send" : "Record a voice message"}
            onClick={toggleMic}
          >
            {recording ? <IconStop /> : <IconMic />}
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={recording ? `Recording ${elapsed.toFixed(0)}s · tap stop to send` : micOk ? "Message" : "Type a message"}
          disabled={recording}
          enterKeyHint="send"
          aria-label="Message"
        />
        <button type="submit" className="send" aria-label="Send" disabled={!text.trim() || recording}>
          <IconSend />
        </button>
      </form>
    </div>
  );
}
