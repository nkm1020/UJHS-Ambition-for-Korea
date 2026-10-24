'use client';

import { useState } from 'react';
import { Avatar } from '@/components/avatar/Avatar';
import { AvatarStage } from '@/components/avatar/AvatarStage';
import { useMe } from '@/lib/me';

/** 마이룸: 방 안에 선 내 캐릭터 + 내 프로필(이름·상태 메시지). */
export function MyRoom({ onCustomize }: { onCustomize(): void }) {
  const { me, setName, setStatus } = useMe();
  const [editing, setEditing] = useState<'name' | 'status' | null>(null);

  return (
    <>
      {/* 3D는 화면 전체에 깔고 UI를 그 위에 얹는다 */}
      <div className="absolute inset-0">
        <AvatarStage spin camera={[0, 1.25, 4.6]} fov={30}>
          <Avatar config={me.avatar} pose="idle" face="happy" seed={0} />
          {/* 바닥. 뒷벽은 두지 않는다 — CSS 그라디언트가 하늘로 비치는 편이 밝다. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[4.5, 56]} />
            <meshStandardMaterial color="#F0E6D2" roughness={1} />
          </mesh>
        </AvatarStage>
      </div>

      {/* 프로필 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-start justify-between gap-3">
          <div className="min-w-0">
            {editing === 'name' ? (
              <input
                autoFocus
                value={me.name}
                maxLength={16}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditing(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
                className="w-44 rounded-xl bg-white/90 px-2 py-1 text-[22px] font-extrabold tracking-tight text-slate-800 outline-none ring-2 ring-teal-400"
              />
            ) : (
              <button
                onClick={() => setEditing('name')}
                className="block max-w-[60vw] truncate text-[22px] font-extrabold tracking-tight text-slate-800 drop-shadow-[0_1px_8px_rgba(255,255,255,0.9)]"
              >
                {me.name || '이름 없음'}
                <span className="ml-1.5 align-middle text-[13px] text-slate-400">✏️</span>
              </button>
            )}

            {editing === 'status' ? (
              <input
                autoFocus
                value={me.status}
                maxLength={40}
                onChange={(e) => setStatus(e.target.value)}
                onBlur={() => setEditing(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
                className="mt-1 w-60 rounded-xl bg-white/90 px-2 py-1 text-[13px] font-medium text-slate-600 outline-none ring-2 ring-teal-400"
              />
            ) : (
              <button
                onClick={() => setEditing('status')}
                className="mt-0.5 block max-w-[66vw] truncate text-[13px] font-medium text-slate-600 drop-shadow-[0_1px_8px_rgba(255,255,255,0.9)]"
              >
                {me.status || '상태 메시지를 입력해 보세요'}
              </button>
            )}
          </div>

          <button
            onClick={onCustomize}
            className="shrink-0 rounded-full bg-white/90 px-4 py-2 text-[13px] font-bold text-slate-700 shadow-md backdrop-blur active:scale-95"
          >
            꾸미기
          </button>
        </div>
      </div>
    </>
  );
}
