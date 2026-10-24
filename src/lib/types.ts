/* 공유 계약. 바꾸기 전에 반드시 상대방에게 말한다.
   2026-10-24 변경: 아바타를 2D SVG → 3D(react-three-fiber 프리미티브)로 전환.
   AvatarConfig와 PoseName만 바뀌었고 ActionName/Member/Beat/Room은 그대로다. */

/* ── 아바타 ───────────────────────────────────────────────── */

export type GlassesName = 'none' | 'shutter' | 'round';

/** 꾸미기 슬롯. 각 필드가 곧 상점 아이템 단위다. */
export interface AvatarConfig {
  body: string;          // 머리+몸통 (하나로 이어진 물방울)
  skin: string;          // 팔
  legs: string;          // 다리
  shoes: string;
  face: string;          // 얼굴판 색
  glasses: GlassesName;
  glassesColor: string;
  bag: boolean;          // 패니팩
  bagColor: string;
}

/** 표정. 몸짓과 독립된 레이어라 조합이 공짜로 늘어난다. */
export type FaceName = 'neutral' | 'happy' | 'shock' | 'blank' | 'sad' | 'smirk';

/** 몸의 자세. <Avatar pose={...} />에 그대로 넣는다. */
export type PoseName =
  | 'idle'       // 마이룸: 서서 숨쉬기
  | 'walk'       // 걷기 (다리·팔 스윙)
  | 'walkAway'   // 등을 돌리고 걸어나감 (방 나가기)
  | 'sit'        // watching: 원탁에 앉음
  | 'sitTalk'    // 앉아서 몸 앞으로 (말하는 중)
  | 'slump'      // away: 테이블에 엎드림
  | 'stare'      // 말한 사람을 쳐다봄 (읽씹 중간 동작)
  | 'startle'    // 화들짝 일어나 앉음
  | 'coverMouth' // 손으로 입 막음
  | 'heart'      // 두 팔 모아 하트
  | 'laugh';     // 뒤로 젖히며 웃음

/* ── 아래부터는 기존 계약 그대로 ───────────────────────────── */

export type ActionName =
  | 'walk_in'      // 내 입장: 걸어 들어와 빈자리에 앉음. 보고 있던 사람은 고개 돌림
  | 'sit_up'       // 엎드림 → 앉음 (보기 시작)
  | 'slump'        // 앉음 → 엎드림 (안 보게 됨)
  | 'talk'         // 목소리 재생 + 입 움직임 + 말풍선
  | 'read_ignore'  // 읽씹: sit_up → 👀 말한 사람 쳐다봄 → slump
  | 'startle_up'   // 늦은 답장: 💦 화들짝 일어나 앉음
  | 'stand_leave'  // 방 나가기: 일어나 의자 밀고 퇴장, 빈자리 (재등장 없음)
  | 'cover_mouth'  // 메시지 취소: 말하다 ✋ 로 입 막음
  | 'typing_stop'  // 입력하다 멈춤: sit_up → 말풍선 "…" → 사라짐 → slump
  | 'heart'        // 🫶
  | 'laugh'        // 😂
  | 'freeze';      // 주변 반응: 얼어붙음

export type Presence = 'watching' | 'away' | 'gone'; // 앉음 / 엎드림 / 빈자리

export interface Member {
  id: string;
  name: string;
  avatar: AvatarConfig;
  seat: 0 | 1 | 2 | 3 | 4;
  startsAs: Presence;
}

export interface Beat {
  actorId: string;
  action: ActionName;
  audio?: string;
  text?: string;
  caption?: string;
  maxMs?: number;
  reactions?: { actorId: string; action: ActionName }[];
}

export interface Room {
  id: string;
  title: string;
  emoji: string;
  preview: string;
  unread: number;
  members: Member[];
  script: Beat[];
  onUserMessage: Beat[][];
}

/* ── A의 재생기용: ActionName → 포즈 시퀀스 ─────────────────
   Avatar는 pose 하나만 받는 순수 컴포넌트다. 한 동작이 여러 단계인
   액션은 여기서 풀어 쓴다. A는 이 배열을 순서대로 넘기면 된다.
   face가 있으면 그 단계 동안 표정도 바꾼다. */
export interface PoseStep {
  pose: PoseName;
  face?: FaceName;
  ms: number;
  /** 이 단계에서 말풍선 위에 띄울 이모지 */
  emoji?: string;
}

export const ACTION_POSES: Record<ActionName, PoseStep[]> = {
  walk_in:     [{ pose: 'walk', face: 'happy', ms: 900 }, { pose: 'sit', face: 'happy', ms: 300 }],
  sit_up:      [{ pose: 'sit', face: 'neutral', ms: 400 }],
  slump:       [{ pose: 'slump', face: 'blank', ms: 600 }],
  talk:        [{ pose: 'sitTalk', face: 'neutral', ms: 0 }], // ms 0 = 오디오 끝까지
  read_ignore: [
    { pose: 'sit',   face: 'neutral', ms: 350 },
    { pose: 'stare', face: 'blank',   ms: 900, emoji: '👀' },
    { pose: 'slump', face: 'blank',   ms: 700 },
  ],
  startle_up:  [{ pose: 'startle', face: 'shock', ms: 700, emoji: '💦' }, { pose: 'sit', face: 'neutral', ms: 300 }],
  // 일어서서 등을 돌리고 걸어나간다. A는 이 단계 동안 group position을 무대 밖으로 옮긴다.
  stand_leave: [
    { pose: 'sit', face: 'blank', ms: 250 },
    { pose: 'idle', face: 'blank', ms: 300 },
    { pose: 'walkAway', face: 'blank', ms: 1200 },
  ],
  cover_mouth: [{ pose: 'coverMouth', face: 'shock', ms: 1100, emoji: '✋' }],
  typing_stop: [
    { pose: 'sit',   face: 'neutral', ms: 400 },
    { pose: 'sit',   face: 'neutral', ms: 700, emoji: '💬' },
    { pose: 'slump', face: 'blank',   ms: 600 },
  ],
  heart:       [{ pose: 'heart', face: 'happy', ms: 900, emoji: '🫶' }, { pose: 'sit', face: 'happy', ms: 250 }],
  laugh:       [{ pose: 'laugh', face: 'happy', ms: 1000, emoji: '😂' }, { pose: 'sit', face: 'happy', ms: 250 }],
  freeze:      [{ pose: 'sit', face: 'shock', ms: 900 }],
};

/** Presence → 기본 포즈 (비트 사이 대기 자세) */
export const PRESENCE_POSE: Record<Exclude<Presence, 'gone'>, PoseName> = {
  watching: 'sit',
  away: 'slump',
};
