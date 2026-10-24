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
  setAvatar(cfg: AvatarConfig): void;
  setName(name: string): void;
  setStatus(status: string): void;
} | null>(null);

/** 첫 방문부터 귀엽게 보이도록 랜덤 아바타로 시작한다. */
const FALLBACK: Me = { avatar: DEFAULT_AVATAR, name: 'You', status: '오늘도 잘 부탁해 🌊' };

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>(FALLBACK);

  // localStorage는 클라이언트에서만. SSR 하이드레이션 불일치를 피한다.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Me>;
        setMe({ ...FALLBACK, ...saved, avatar: { ...DEFAULT_AVATAR, ...saved.avatar } });
        return;
      }
    } catch {
      /* 손상된 값이면 그냥 새로 시작한다 */
    }
    setMe((m) => ({ ...m, avatar: randomAvatar() }));
  }, []);

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
