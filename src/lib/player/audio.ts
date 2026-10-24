"use client";

// All playback goes through one Web Audio context. It is unlocked inside a
// click handler (unlockAudio), so later playback is not blocked by autoplay
// rules, iOS included. Sources feed an analyser before the mute gain, so the
// mouth keeps moving when muted.

type Ctx = { ctx: AudioContext; analyser: AnalyserNode; gain: GainNode };

let engine: Ctx | null = null;
let muted = false;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function create(): Ctx | null {
  if (engine) return engine;
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const gain = ctx.createGain();
  gain.gain.value = muted ? 0 : 1;
  analyser.connect(gain);
  gain.connect(ctx.destination);
  engine = { ctx, analyser, gain };
  return engine;
}

/** Call synchronously inside a user gesture (click / tap). */
export function unlockAudio(): void {
  try {
    const e = create();
    if (!e) return;
    if (e.ctx.state === "suspended") void e.ctx.resume();
    const silent = e.ctx.createBuffer(1, 1, 22050);
    const src = e.ctx.createBufferSource();
    src.buffer = silent;
    src.connect(e.ctx.destination);
    src.start(0);
  } catch {
    // no audio on this device; bubbles still play
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  if (engine) engine.gain.gain.value = value ? 0 : 1;
}

export function loadBuffer(url: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(url);
  if (cached) return cached;
  const job = (async () => {
    const e = create();
    if (!e) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      return await e.ctx.decodeAudioData(data);
    } catch {
      return null;
    }
  })();
  buffers.set(url, job);
  return job;
}

export interface Playback {
  done: Promise<void>;
  stop: () => void;
}

/** Plays a buffer and reports a 0..1 loudness every frame. */
export function playBuffer(buffer: AudioBuffer, onLevel: (level: number) => void): Playback {
  const e = create();
  if (!e) return { done: Promise.resolve(), stop: () => {} };
  if (e.ctx.state === "suspended") void e.ctx.resume();

  const src = e.ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(e.analyser);

  const samples = new Uint8Array(e.analyser.fftSize);
  let frame = 0;
  let finished = false;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(cap);
    onLevel(0);
    try {
      src.disconnect();
    } catch {}
    resolve();
  };

  const tick = () => {
    e.analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = (samples[i] - 128) / 128;
      sum += v * v;
    }
    onLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
    frame = requestAnimationFrame(tick);
  };

  // Upper bound in case "ended" never fires.
  const cap = setTimeout(finish, buffer.duration * 1000 + 1000);
  src.onended = finish;
  src.start();
  frame = requestAnimationFrame(tick);

  return {
    done,
    stop: () => {
      try {
        src.stop();
      } catch {}
      finish();
    },
  };
}
