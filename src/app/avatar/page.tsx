'use client';

import { useState } from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { AvatarStage } from '@/components/avatar/AvatarStage';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, randomAvatar } from '@/lib/avatar';
import { AvatarConfig, FaceName, PoseName } from '@/lib/types';

const POSES: PoseName[] = ['idle', 'walk', 'sit', 'sitTalk', 'slump', 'stare', 'startle', 'coverMouth', 'heart', 'laugh'];
const FACES: FaceName[] = ['neutral', 'happy', 'shock', 'blank', 'sad', 'smirk'];

/** 임시 확인용 화면. 여기서 캐릭터가 제대로 나오면 MyRoom/Customizer로 발전시킨다. */
export default function Page() {
  const [cfg, setCfg] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [pose, setPose] = useState<PoseName>('idle');
  const [face, setFace] = useState<FaceName>('neutral');
  const [talking, setTalking] = useState(false);

  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  return (
    <main className="flex min-h-dvh flex-col bg-gradient-to-b from-sky-200 to-sky-50">
      <div className="min-h-0 flex-1">
        <AvatarStage spin>
          <Avatar config={cfg} pose={pose} face={face} talking={talking} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[2.2, 48]} />
            <meshStandardMaterial color="#E8D9C0" roughness={1} />
          </mesh>
        </AvatarStage>
      </div>

      <div className="space-y-2 bg-white/80 p-3 text-xs backdrop-blur">
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
        {(['body', 'skin', 'legs', 'shoes', 'face'] as const).map((slot) => (
          <Row key={slot} label={slot}>
            {AVATAR_OPTIONS[slot].map((c) => (
              <button
                key={c}
                onClick={() => set(slot, c)}
                className="h-7 w-7 rounded-full border-2 border-white shadow"
                style={{ background: c }}
                aria-label={`${slot} ${c}`}
              />
            ))}
          </Row>
        ))}
        <Row label="extra">
          {AVATAR_OPTIONS.glasses.map((g) => (
            <Chip key={g} on={cfg.glasses === g} onClick={() => set('glasses', g)}>{g}</Chip>
          ))}
          <Chip on={cfg.bag !== 'none'} onClick={() => set('bag', cfg.bag === 'none' ? 'fanny' : 'none')}>bag</Chip>
          <Chip on={false} onClick={() => setCfg(randomAvatar(true))}>🎲 random</Chip>
        </Row>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 shrink-0 font-mono text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 font-medium transition ${
        on ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}
