'use client';

import { useState } from 'react';
import { MyRoom } from '@/components/MyRoom';
import { Customizer } from '@/components/Customizer';
import { ChatSheet, SheetSnap } from '@/components/ChatSheet';
import { MeProvider, useMe } from '@/lib/me';
import { ROOMS } from '@/data/rooms';

export default function Page() {
  return (
    <MeProvider>
      <Shell />
    </MeProvider>
  );
}

function Shell() {
  const { me, setAvatar } = useMe();
  const [tab, setTab] = useState<'room' | 'chat'>('room');
  const [snap, setSnap] = useState<SheetSnap>('closed');
  const [customizing, setCustomizing] = useState(false);

  const openChat = () => {
    setTab('chat');
    setCustomizing(false);
    setSnap((s) => (s === 'closed' ? 'half' : s));
  };
  const openRoomTab = () => {
    setTab('room');
    setSnap('closed');
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-teal-50">
      <MyRoom onCustomize={() => { setCustomizing(true); setSnap('closed'); setTab('room'); }} />

      {/* 시트와 패널은 하단 바 위에 겹쳐 놓는다 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[68px] top-0">
        {customizing && (
          <div className="absolute inset-x-0 bottom-0">
            <Customizer
              value={me.avatar}
              onChange={setAvatar}
              onClose={() => setCustomizing(false)}
            />
          </div>
        )}
        {!customizing && (
          <ChatSheet
            rooms={ROOMS}
            snap={snap}
            onSnap={(s) => { setSnap(s); setTab(s === 'closed' ? 'room' : 'chat'); }}
            onOpenRoom={(id) => {
              // TODO(A): RoomView로 전환 — 원탁 씬
              console.log('open room', id);
            }}
          />
        )}
      </div>

      {/* 하단 바 */}
      <nav className="absolute inset-x-0 bottom-0 z-30 flex h-[68px] items-stretch border-t border-black/5 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <TabButton active={tab === 'room'} onClick={openRoomTab} emoji="🏠" label="마이룸" />
        <TabButton
          active={tab === 'chat'}
          onClick={openChat}
          emoji="💬"
          label="채팅"
          badge={ROOMS.reduce((n, r) => n + r.unread, 0)}
        />
      </nav>
    </main>
  );
}

function TabButton({
  active, onClick, emoji, label, badge,
}: {
  active: boolean; onClick(): void; emoji: string; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
        active ? 'text-teal-600' : 'text-slate-400'
      }`}
    >
      <span className={`text-[20px] transition ${active ? 'scale-110' : 'scale-100'}`}>{emoji}</span>
      <span className="text-[11px] font-bold">{label}</span>
      {!!badge && badge > 0 && (
        <span className="absolute right-[calc(50%-1.5rem)] top-2.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
