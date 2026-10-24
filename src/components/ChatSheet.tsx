'use client';

import { useRef, useState } from 'react';
import { avatarFaceUrl } from '@/lib/avatar';
import { Room } from '@/lib/types';
import { useMe } from '@/lib/me';

export type SheetSnap = 'closed' | 'half' | 'full';

const SNAP_VH: Record<SheetSnap, number> = { closed: 0, half: 52, full: 88 };

/** 채팅방 리스트 바텀시트. 손잡이를 끌거나 탭해서 접힘 ↔ 반 ↔ 전체. */
export function ChatSheet({
  rooms,
  snap,
  onSnap,
  onOpenRoom,
}: {
  rooms: Room[];
  snap: SheetSnap;
  onSnap(s: SheetSnap): void;
  onOpenRoom(id: string): void;
}) {
  const [drag, setDrag] = useState(0); // 끄는 중 임시 오프셋(px)
  const startY = useRef(0);
  const dragging = useRef(false);

  const vh = SNAP_VH[snap];

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setDrag(e.clientY - startY.current);
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const moved = drag;
    setDrag(0);
    // 80px 이상 끌었으면 한 단계 이동, 아니면 탭으로 보고 한 단계 올림
    if (moved > 80) onSnap(snap === 'full' ? 'half' : 'closed');
    else if (moved < -80) onSnap(snap === 'closed' ? 'half' : 'full');
    else onSnap(snap === 'full' ? 'half' : snap === 'half' ? 'full' : 'half');
  };

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col rounded-t-[28px] bg-white/95 shadow-[0_-8px_40px_rgba(30,60,90,0.18)] backdrop-blur-xl"
      style={{
        height: `${vh}dvh`,
        transform: `translateY(${Math.max(0, drag)}px)`,
        transition: dragging.current ? 'none' : 'height 260ms cubic-bezier(.32,.72,0,1), transform 260ms cubic-bezier(.32,.72,0,1)',
      }}
    >
      {/* 손잡이 */}
      <div
        className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-1 pt-2.5 active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="h-1.5 w-10 rounded-full bg-slate-300" />
      </div>

      {vh > 0 && (
        <>
          <div className="flex shrink-0 items-baseline justify-between px-5 pb-2 pt-1">
            <h2 className="text-[17px] font-extrabold tracking-tight text-slate-800">채팅</h2>
            <span className="text-[12px] font-semibold text-slate-400">{rooms.length}개의 방</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
            {rooms.map((room, i) => (
              <li key={room.id}>
                <RoomCard room={room} first={i === 0} onOpen={() => onOpenRoom(room.id)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RoomCard({ room, first, onOpen }: { room: Room; first: boolean; onOpen(): void }) {
  const { me } = useMe();

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition active:scale-[0.98] active:bg-slate-100"
    >
      {/* 미니 원탁: 카드마다 3D Canvas를 띄우면 무거우니 얼굴 SVG를 쓴다 */}
      <div className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-100 to-teal-50">
        <span className="absolute text-[20px]">{room.emoji}</span>
        <div className="absolute -bottom-0.5 flex -space-x-1.5">
          {room.members.slice(0, 3).map((m) => (
            <img
              key={m.id}
              src={avatarFaceUrl(m.id === 'me' ? me.avatar : m.avatar)}
              alt=""
              className={`h-4 w-4 rounded-full ring-2 ring-white ${
                m.startsAs === 'away' ? 'opacity-40' : ''
              }`}
            />
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-bold text-slate-800">{room.title}</span>
          <span className="shrink-0 text-[12px] font-semibold text-slate-400">
            {room.members.length}
          </span>
        </div>
        <p className="truncate text-[13px] text-slate-500">{room.preview}</p>
      </div>

      {room.unread > 0 && (
        <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
          {room.unread}
        </span>
      )}
      {first && room.unread === 0 && (
        <span className="shrink-0 text-[12px] font-semibold text-teal-600">Open 👆</span>
      )}
    </button>
  );
}
