'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AvatarConfig } from '@/lib/types';
import { DEFAULT_AVATAR, randomAvatar } from '@/lib/avatar';

export interface Me {
  avatar: AvatarConfig;
  name: string;
  status: string;
}

const KEY = 'ujhs.me.v1';

const Ctx = createContext<{
  me: Me;
  /** Same as me.avatar; the room and My Room screens read this. */
  avatar: AvatarConfig;
  setAvatar(cfg: AvatarConfig): void;
  setName(name: string): void;
  setStatus(status: string): void;
} | null>(null);

/** 첫 방문부터 귀엽게 보이도록 랜덤 아바타로 시작한다. */
const FALLBACK: Me = { avatar: DEFAULT_AVATAR, name: 'You', status: '오늘도 잘 부탁해 🌊' };

// App은 ssr: false로만 렌더되므로 첫 렌더에서 바로 localStorage를 읽는다.
// effect에서 불러오면 저장 effect가 먼저 돌아 기본값으로 덮어쓴다.
function loadMe(): Me {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Me>;
      return { ...FALLBACK, ...saved, avatar: { ...DEFAULT_AVATAR, ...saved.avatar } };
    }
  } catch {
    /* 손상된 값이면 그냥 새로 시작한다 */
  }
  return { ...FALLBACK, avatar: randomAvatar() };
}

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>(loadMe);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(me));
    } catch {
      /* 사파리 프라이빗 모드 등 — 저장 실패해도 화면은 돌아야 한다 */
    }
  }, [me]);

  return (
    <Ctx.Provider
      value={{
        me,
        avatar: me.avatar,
        setAvatar: (avatar) => setMe((m) => ({ ...m, avatar })),
        setName: (name) => setMe((m) => ({ ...m, name })),
        setStatus: (status) => setMe((m) => ({ ...m, status })),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useMe() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMe must be used inside <MeProvider>');
  return v;
}
