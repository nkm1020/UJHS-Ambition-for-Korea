"use client";

import { useEffect, useRef, useState } from "react";
import { canRecord, startRecording, type Recorder } from "@/lib/recorder";
import { startSTT } from "@/lib/stt";
import { unlockAudio } from "@/lib/player/audio";
import type { UserMessage } from "@/lib/player/usePlayer";
import { IconClose, IconMic, IconSend } from "@/components/icons";
import { speakAs } from "@/lib/voice";

interface ComposerProps {
  onSend: (msg: UserMessage) => void;
  voiceId?: string | null;
  nudge: boolean;
}

// A floating bar over the room. One action button changes with context:
// the mic while the field is empty, send once there is text, and send again
// while recording (tap to stop and send). Recording swaps the field for a
// live readout with a way to throw the clip away.

function clock(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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

  const reset = () => {
    stt.current = null;
    setRecStartedAt(null);
    setElapsed(0);
  };

  const finish = async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    const [clip, said] = await Promise.all([r.stop(), stt.current?.stop() ?? Promise.resolve(null)]);
    reset();
    if (clip) onSend({ audioUrl: clip.url, text: said ?? undefined });
    else setToast("Didn't catch that. Try again?");
  };

  const discard = async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    const [clip] = await Promise.all([r.stop(), stt.current?.stop()]);
    if (clip) URL.revokeObjectURL(clip.url);
    reset();
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
  const hasText = text.trim().length > 0;
  const chip = toast
    ? { kind: "toast", text: toast }
    : speaking
      ? { kind: "nudge", text: "Saying it in your voice…" }
      : nudge && !recording
        ? { kind: "nudge", text: micOk ? "Your turn. Tap the mic and say something." : "Your turn. Type something." }
        : null;

  return (
    <div className="composer">
      {chip && (
        <div key={chip.text} className={chip.kind} role="status">
          {chip.text}
        </div>
      )}
      <form className={`composer-bar ${recording ? "is-rec" : ""}`} onSubmit={submit}>
        {recording ? (
          <>
            <button type="button" className="rec-discard" aria-label="Discard recording" onClick={discard}>
              <IconClose />
            </button>
            <span className="rec-readout" role="status" aria-label={`Recording, ${Math.floor(elapsed)} seconds`}>
              <i className="rec-dot" aria-hidden />
              <span className="num">{clock(elapsed)}</span>
              <span className="rec-wave" aria-hidden>
                {Array.from({ length: 9 }, (_, i) => (
                  <i key={i} style={{ animationDelay: `${(i * 97) % 600}ms` }} />
                ))}
              </span>
              <span className="rec-hint">Tap to send</span>
            </span>
          </>
        ) : (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={micOk ? "Message" : "Type a message"}
            enterKeyHint="send"
            aria-label="Message"
          />
        )}
        {recording ? (
          <button type="button" className="action" aria-label="Stop and send" onClick={toggleMic}>
            <IconSend />
          </button>
        ) : micOk && !hasText ? (
          <button type="button" className="action is-mic" aria-label="Record a voice message" onClick={toggleMic}>
            <IconMic />
          </button>
        ) : (
          <button type="submit" className="action" aria-label="Send" disabled={!hasText || speaking}>
            {speaking ? <span className="mini-spinner" aria-hidden /> : <IconSend />}
          </button>
        )}
      </form>
    </div>
  );
}
