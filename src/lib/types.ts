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

export type Seat = 0 | 1 | 2 | 3 | 4; // 테이블 먼 쪽 호, 왼쪽부터

export interface Member {
  id: string;
  name: string;
  avatar: AvatarConfig;
  seat: Seat;
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
  backdrop?: string;     // 방의 정체성 색 (선택)
  kind?: 'group' | 'dm'; // 1:1 채팅이면 'dm'. 없으면 멤버 수로 판단
  members: Member[];
  script: Beat[];
  onUserMessage: Beat[][];
  /** AI(Sonnet)가 연기하는 멤버. 있으면 내 메시지에 onUserMessage 대신 AI가 답한다 */
  agentId?: string;
  /** 있으면 대본이 끝난 뒤 원탁 위에 AI 요약을 띄운다. API가 실패하면 이 요약을 그대로 쓴다 */
  catchUp?: CatchUp;
}

/** "안 읽은 사이 무슨 일이 있었나" AI 요약 */
export interface CatchUp {
  headline: string;
  points: string[];
  forYou: string; // 나한테 남은 일 (답해야 할 질문 등)
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

/* ── 아바타 슬롯: UI ↔ 아바타 렌더러 경계 ─────────────────────
   2D 임시 아바타와 3D 아바타가 같은 props를 받는다. 바꿔 끼우는 곳은
   src/components/avatar/index.ts 한 줄. docs/AVATAR-SLOT.md 참고. */

export interface StageMember {
  id: string;
  name: string;
  seat: Seat;
  avatar: AvatarConfig;
  isMe: boolean;
  presence: Presence;          // 대기 자세
  action: ActionName | null;   // 지금 재생 중인 동작, null = presence 자세로 대기
  actionKey: number;           // 동작이 시작될 때마다 바뀜 (같은 동작도 다시 재생)
  lookAt: Seat | null;         // 쳐다보는 자리, null = 카메라 정면
  cue?: StageCue | null;       // 대본 밖 짧은 반응 (예: 실눈 뜬 나를 들켰을 때 👀)
}

export interface StageCue {
  emoji: string;
  face?: FaceName;
  key: number;
}

export interface StageAnchor {
  x: number; // 무대 박스 왼쪽에서 px
  y: number; // 무대 박스 위에서 px, 머리 바로 위
}

/** 말풍선 한 개. 3D 무대는 머리 위에, 2D는 BubbleLayer가 그린다. */
export interface StageBubble {
  key: number;
  kind: 'text' | 'voice' | 'typing' | 'unsent';
  text?: string;
  voiceSec?: number;
}

export interface AvatarStageProps {
  members: StageMember[];
  /** 카메라(1인칭 시선)가 향할 멤버. null이나 'me'면 테이블 가운데 */
  focusId?: string | null;
  /** 지금 비트에 함께 등장하는 멤버들. 2명 이상이면 카메라가 줌아웃해서 다 담는다 */
  focusGroup?: string[];
  /** 3D 무대가 머리 위에 그릴 말풍선. 2D 무대는 무시한다 */
  bubbles?: Record<string, StageBubble | null>;
  /** 방의 배경막 색 */
  backdrop?: string;
  /** Scene+ 실눈: 내가 엎드린 채 테이블 너머를 훔쳐본다. 카메라가 팔 위 높이로 내려간다 */
  peek?: boolean;
  /** 멤버의 입 벌림 0..1. 가볍다. 매 프레임 불러도 된다. */
  getTalkLevel: (memberId: string) => number;
  /** 말풍선 위치 보고. 선택. 없으면 자리별 기본값을 쓴다. */
  onAnchors?: (anchors: Record<string, StageAnchor>) => void;
}

export interface AvatarStandProps {
  avatar: AvatarConfig;
  /** 꾸미기 화면처럼 손가락으로 돌려볼 수 있게 */
  spin?: boolean;
  /** 방 색과 소품. 없으면 내 방. 친구 방은 친구마다 다르다 */
  look?: HomeLook;
  /** 표정. 없으면 'happy' */
  face?: FaceName;
}

/** 마이룸(과 친구 방)의 색. 소품 하나로 방 주인이 누군지 보이게 한다. */
export interface HomeLook {
  wall: string;
  sideWall: string;
  floor: string;
  rug: string;
  bench: string;
  plant: string;
  prop?: 'dumbbell' | 'pizza';
}
