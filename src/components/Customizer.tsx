'use client';

import { AVATAR_OPTIONS, randomAvatar } from '@/lib/avatar';
import { AvatarConfig } from '@/lib/types';

const SLOTS = [
  { key: 'body',  label: '몸' },
  { key: 'face',  label: '얼굴' },
  { key: 'skin',  label: '피부' },
  { key: 'legs',  label: '바지' },
  { key: 'shoes', label: '신발' },
] as const;

/** 꾸미기 패널. 슬롯을 늘리려면 avatar.ts의 AVATAR_OPTIONS에 값만 추가하면 된다. */
export function Customizer({
  value,
  onChange,
  onClose,
}: {
  value: AvatarConfig;
  onChange(cfg: AvatarConfig): void;
  onClose(): void;
}) {
  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="pointer-events-auto rounded-t-[28px] bg-white/95 shadow-[0_-8px_40px_rgba(30,60,90,0.18)] backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <h2 className="text-[15px] font-bold text-slate-800">꾸미기</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(randomAvatar())}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-600 active:scale-95"
          >
            🎲 랜덤
          </button>
          <button
            onClick={onClose}
            className="rounded-full bg-teal-500 px-4 py-1.5 text-[13px] font-bold text-white shadow-sm active:scale-95"
          >
            완료
          </button>
        </div>
      </div>

      <div className="max-h-[42dvh] space-y-3 overflow-y-auto px-5 pb-6 pt-2">
        {SLOTS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-9 shrink-0 text-[12px] font-semibold text-slate-400">{label}</span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS[key].map((c) => (
                <button
                  key={c}
                  onClick={() => set(key, c)}
                  aria-label={`${label} ${c}`}
                  className={`h-8 w-8 rounded-full transition ${
                    value[key] === c
                      ? 'ring-2 ring-teal-500 ring-offset-2'
                      : 'ring-1 ring-black/10'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <span className="w-9 shrink-0 text-[12px] font-semibold text-slate-400">안경</span>
          <div className="flex flex-wrap gap-2">
            {AVATAR_OPTIONS.glasses.map((g) => (
              <button
                key={g}
                onClick={() => set('glasses', g)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                  value.glasses === g ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {g === 'none' ? '없음' : g === 'shutter' ? '셔터' : '동그란'}
              </button>
            ))}
            <button
              onClick={() => set('bag', value.bag === 'none' ? 'fanny' : 'none')}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                value.bag !== 'none' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              가방
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
