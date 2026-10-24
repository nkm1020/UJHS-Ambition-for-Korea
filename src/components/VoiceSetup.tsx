"use client";

import { useEffect, useRef, useState } from "react";
import { canRecord, startRecording, type Recorder } from "@/lib/recorder";
import { unlockAudio } from "@/lib/player/audio";
import { VOICE_LINE, cloningAvailable, enrollVoice, speakAs } from "@/lib/voice";
import { IconMic, IconStop } from "@/components/icons";

// First run: read one line out loud, and your avatar speaks your typed
// messages in that voice. Every step can be skipped; nothing here can strand
// the visitor.

type Step = "intro" | "record" | "review" | "cloning" | "done";

interface VoiceSetupProps {
  onFinish: (voiceId: string | null) => void;
}

const MIN_SEC = 3;

export function VoiceSetup({ onFinish }: VoiceSetupProps) {
  const [step, setStep] = useState<Step>("intro");
  const [recUrl, setRecUrl] = useState<string | null>(null);
  const [recSec, setRecSec] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const micOk = canRecord();

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 100);
    return () => clearInterval(t);
  }, [startedAt]);

  const stop = async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    const clip = await r.stop();
    setStartedAt(null);
    if (!clip || clip.durationSec < MIN_SEC) {
      setNote(`Keep going a bit longer: at least ${MIN_SEC} seconds.`);
      return;
    }
    setNote(null);
    setRecUrl(clip.url);
    setRecSec(clip.durationSec);
    setStep("review");
  };

  const toggle = async () => {
    unlockAudio();
    if (recorder.current) {
      void stop();
      return;
    }
    try {
      const r = await startRecording();
      recorder.current = r;
      r.onAutoStop(() => void stop());
      setElapsed(0);
      setStartedAt(Date.now());
      setNote(null);
    } catch {
      setNote("No microphone access. You can skip and set your voice later.");
    }
  };

  const clone = async () => {
    if (!recUrl) return;
    setStep("cloning");
    const available = await cloningAvailable();
    let id: string | null = null;
    if (available) {
      const blob = await (await fetch(recUrl)).blob();
      id = await enrollVoice(blob);
    }
    if (id) {
      setVoiceId(id);
      const hello = await speakAs(id, "Hi! It's me. This is how I sound in Scene.", 15000);
      if (hello) void new Audio(hello).play().catch(() => {});
      setNote(null);
    } else {
      setNote("Voice cloning isn't reachable right now. Your mic messages still use your real voice.");
    }
    setStep("done");
  };

  return (
    <div className="voice-setup" role="dialog" aria-modal="true" aria-label="Set up your voice">
      <header className="modal-bar">
        <span />
        <h2>Your voice</h2>
        {step !== "done" ? (
          <button className="text-btn strong" onClick={() => onFinish(null)}>
            Skip
          </button>
        ) : (
          <span />
        )}
      </header>

      <div className="voice-body">
        {step === "intro" && (
          <>
            <h1 className="voice-title">Give your avatar your voice</h1>
            <p className="voice-copy">
              Read one line out loud. When you type a message, your avatar says it in your voice.
            </p>
            <button
              className="primary-btn"
              disabled={!micOk}
              onClick={() => {
                unlockAudio();
                setStep("record");
              }}
            >
              {micOk ? "Start" : "No microphone on this device"}
            </button>
          </>
        )}

        {step === "record" && (
          <>
            <p className="voice-copy">Tap the mic and read this out loud:</p>
            <blockquote className="voice-line">{VOICE_LINE}</blockquote>
            <button
              className={`record-btn ${startedAt !== null ? "is-rec" : ""}`}
              aria-label={startedAt !== null ? "Stop recording" : "Start recording"}
              onClick={toggle}
            >
              {startedAt !== null ? <IconStop size={30} /> : <IconMic size={30} />}
            </button>
            <p className="voice-meta">{startedAt !== null ? `${elapsed.toFixed(1)}s · tap to stop` : "3–12 seconds"}</p>
          </>
        )}

        {step === "review" && recUrl && (
          <>
            <h1 className="voice-title">Sounds good?</h1>
            <audio className="voice-audio" src={recUrl} controls />
            <p className="voice-meta">{recSec.toFixed(1)} seconds</p>
            <div className="voice-actions">
              <button
                className="secondary-btn"
                onClick={() => {
                  setRecUrl(null);
                  setStep("record");
                }}
              >
                Redo
              </button>
              <button className="primary-btn" onClick={clone}>
                Use this voice
              </button>
            </div>
          </>
        )}

        {step === "cloning" && (
          <>
            <div className="spinner" aria-hidden />
            <h1 className="voice-title">Teaching your avatar your voice…</h1>
            <p className="voice-copy">This takes a few seconds.</p>
          </>
        )}

        {step === "done" && (
          <>
            <h1 className="voice-title">{voiceId ? "That's you." : "You're set."}</h1>
            <p className="voice-copy">
              {voiceId ? "Your typed messages will be spoken in your voice." : note}
            </p>
            <button className="primary-btn" onClick={() => onFinish(voiceId)}>
              Continue
            </button>
          </>
        )}

        {note && step === "record" && <p className="voice-note">{note}</p>}
      </div>
    </div>
  );
}
