'use client';

import { useState } from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { AvatarStage } from '@/components/avatar/AvatarStage';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, randomAvatar } from '@/lib/avatar';
import { ACTION_POSES, ActionName, AvatarConfig, FaceName, PoseName } from '@/lib/types';

const POSES: PoseName[] = ['idle', 'walk', 'walkAway', 'sit', 'sitTalk', 'slump', 'stare', 'startle', 'coverMouth', 'heart', 'laugh'];
const FACES: FaceName[] = ['neutral', 'happy', 'shock', 'blank', 'sad', 'smirk'];
const ACTIONS = Object.keys(ACTION_POSES) as ActionName[];

/** 포즈·표정 확인용 화면. A의 재생기 참고서이기도 하다. */
export default function Preview() {
  const [cfg, setCfg] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [pose, setPose] = useState<PoseName>('idle');
  const [face, setFace] = useState<FaceName>('neutral');
  const [talking, setTalking] = useState(false);
  const [playing, setPlaying] = useState<ActionName | null>(null);

  /** ACTION_POSES 단계를 순서대로 재생 — A가 재생기에서 할 일과 같다. */
  const playAction = async (action: ActionName) => {
    setPlaying(action);
    for (const step of ACTION_POSES[action]) {
      setPose(step.pose);
      if (step.face) setFace(step.face);
      await new Promise((r) => setTimeout(r, step.ms || 1200));
    }
    setPlaying(null);
  };

  return (
    <main className="flex h-dvh flex-col bg-gradient-to-b from-sky-200 to-teal-50">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <AvatarStage spin camera={[0, 1.25, 4.6]} fov={30}>
            <Avatar config={cfg} pose={pose} face={face} talking={talking} seed={0} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[4.5, 56]} />
              <meshStandardMaterial color="#F0E6D2" roughness={1} />
            </mesh>
          </AvatarStage>
        </div>
        <div className="pointer-events-none absolute left-4 top-4 font-mono text-[12px] font-bold text-slate-500">
          pose: {pose} / face: {face}
          {playing && <span className="ml-2 text-teal-600">▶ {playing}</span>}
        </div>
      </div>

      <div className="max-h-[48dvh] space-y-2 overflow-y-auto bg-white/85 p-3 text-xs backdrop-blur">
        <Row label="action">
          {ACTIONS.map((a) => (
            <Chip key={a} on={playing === a} onClick={() => playAction(a)}>▶ {a}</Chip>
          ))}
        </Row>
        <Row label="pose">
          {POSES.map((p) => (
            <Chip key={p} on={pose === p} onClick={() => setPose(p)}>{p}</Chip>
          ))}
        </Row>
        <Row label="face">
          {FACES.map((f) => (
            <Chip key={f} on={face === f} onClick={() => setFace(f)}>{f}</Chip>
          ))}
          <Chip on={talking} onClick={() => setTalking((t) => !t)}>talking</Chip>
        </Row>
        {(['body', 'face', 'skin', 'legs', 'shoes'] as const).map((slot) => (
          <Row key={slot} label={slot}>
            {AVATAR_OPTIONS[slot].map((c) => (
              <button
                key={c}
                onClick={() => setCfg((v) => ({ ...v, [slot]: c }))}
                className="h-7 w-7 rounded-full ring-1 ring-black/10"
                style={{ background: c }}
                aria-label={`${slot} ${c}`}
              />
            ))}
          </Row>
        ))}
        <Row label="extra">
          {AVATAR_OPTIONS.glasses.map((g) => (
            <Chip key={g} on={cfg.glasses === g} onClick={() => setCfg((v) => ({ ...v, glasses: g }))}>{g}</Chip>
          ))}
          <Chip on={false} onClick={() => setCfg(randomAvatar(true))}>🎲</Chip>
        </Row>
        <Row label="hair">
          {AVATAR_OPTIONS.hair.map((h) => (
            <Chip key={h} on={cfg.hair === h} onClick={() => setCfg((v) => ({ ...v, hair: h }))}>{h}</Chip>
          ))}
        </Row>
        <Row label="hat">
          {AVATAR_OPTIONS.hat.map((h) => (
            <Chip key={h} on={cfg.hat === h} onClick={() => setCfg((v) => ({ ...v, hat: h }))}>{h}</Chip>
          ))}
        </Row>
        <Row label="bag">
          {AVATAR_OPTIONS.bag.map((b) => (
            <Chip key={b} on={cfg.bag === b} onClick={() => setCfg((v) => ({ ...v, bag: b }))}>{b}</Chip>
          ))}
        </Row>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="w-12 shrink-0 pt-1 font-mono text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 font-medium transition ${
        on ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
