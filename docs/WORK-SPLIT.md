# 분업 가이드 (2인)

> 전체 설계와 이유: [`docs/designs/group-chat-scene.md`](designs/group-chat-scene.md). 이 문서는 "누가, 어떤 파일을, 언제까지"만 다룬다.

## 한 줄 요약

처음 들어오면 **마이룸**에서 내 캐릭터를 꾸민다. 애플 지도처럼 끌어올리는 **바텀시트**에 채팅방 현황이 있다. 방을 고르면 내 캐릭터가 걸어 들어가 **원탁**에 앉는다. 보고 있는 사람은 앉아 있고, 안 보는 사람은 엎드려 있다. 대화는 TTS가 아니라 **실제 목소리**다. VC가 링크를 **혼자** 열어서 써보고 통과를 누른다. 제출은 **한 번**뿐이다.

- 데모 속 친구들 = 팀원이 녹음한 대본
- VC의 목소리 = 진짜(기기 안에서만 재생)
- 실시간 멀티유저 = 14:00에 앞서 있을 때만, 별도 경로

## 역할

| | A — 방(원탁) 담당 | B — 마이룸·바텀시트·대본 담당 |
|---|---|---|
| 만드는 것 | 원탁, 앉은 캐릭터, 자세·몸짓 애니메이션, 오디오 재생과 입 움직임, 말풍선·자막, 🎤 녹음과 텍스트 입력, 내 메시지 반응 | 마이룸 + 꾸미기, 바텀시트 + 방 카드(미니 원탁), 아바타 시스템, 방 대본 + 녹음 파일, STT 도우미, 배포, PDF, (14:00 이후) 실시간 |
| 입력 | `Room` 데이터, 내 `AvatarConfig` | 팀 실제 대화, 팀원 목소리 |
| 출력 | 방 화면 | `Room[]`, `AvatarConfig`, `avatarFaceUrl()`, `startSTT()` |
| 이름 | (A 이름) | (B 이름) |

두 사람은 **`src/lib/types.ts`**와 B의 함수 두 개(`avatarFaceUrl`, `startSTT`)로만 연결된다. A는 첫 방 데이터만 있으면 원탁을 끝까지 만들 수 있다.

## 파일 소유권

| 경로 | 소유 |
|---|---|
| `src/app/page.tsx` (마이룸 ↔ 방 전환) | A (B는 `<MyRoom />`만 끼운다) |
| `src/components/room/*` (RoomView, Table, Seat, Bubble, Captions, MicButton, TextInput) | A |
| `src/lib/player/*` (비트 재생기, 오디오, 입 움직임) | A |
| `src/lib/recorder.ts` (MediaRecorder) | A |
| `src/lib/types.ts` | **공동** — 바꾸기 전에 반드시 말로 알린다 |
| `src/lib/avatar.ts` (옵션 목록, `randomAvatar`, `avatarFaceUrl`) | B — ✅ push 완료 |
| `src/components/avatar/*` (`Avatar`, `AvatarStage`) | **공동** — B가 만들었고 A도 쓴다. 바꾸기 전에 말한다 |
| `src/lib/me.tsx` (MeProvider: 내 아바타, localStorage 저장) | B |
| `src/lib/stt.ts` (`startSTT`) | B — 13:30–14:00 |
| `src/components/myroom/*` (MyRoom, StandingCharacter, Customizer) | B |
| `src/components/sheet/*` (BottomSheet, RoomCard, MiniTable) | B |
| `src/data/rooms.ts` | B |
| `public/audio/*` | B (녹음은 둘 다 참여) |
| `src/app/live/[code]/*` (실시간, 14:00 체크포인트 통과 시) | B |
| `docs/*` (PDF 포함) | B |
| `package.json` | A가 생성. 이후 의존성 추가는 말로 알리기 |

## 계약: `src/lib/types.ts`

B가 `1ca0a14`로 push 완료. 이후 변경은 합의해서만.

```ts
export type GlassesName = 'none' | 'shutter' | 'round';

export interface AvatarConfig {
  body: string;        // 머리+몸통 (하나로 이어진 물방울)
  skin: string;        // 팔
  legs: string;
  shoes: string;
  face: string;        // 얼굴판 색
  glasses: GlassesName;
  glassesColor: string;
  bag: boolean;        // 패니팩
  bagColor: string;
}

// 표정은 몸짓과 독립된 레이어다. 조합이 공짜로 늘어난다.
export type FaceName = 'neutral' | 'happy' | 'shock' | 'blank' | 'sad' | 'smirk';

export type PoseName =
  | 'idle' | 'walk' | 'sit' | 'sitTalk' | 'slump'
  | 'stare' | 'startle' | 'coverMouth' | 'heart' | 'laugh';

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
  id: string;            // 'leo', 내 자리는 항상 'me'
  name: string;          // 'Leo', 내 자리는 'You'
  avatar: AvatarConfig;  // 'me'는 MeProvider 값으로 덮어씀
  seat: 0 | 1 | 2 | 3 | 4; // 테이블 먼 쪽 호, 왼쪽부터
  startsAs: Presence;    // 'me'는 입장 전이라 무시 (walk_in으로 등장)
}

export interface Beat {
  actorId: string;       // Member.id ('me' 포함)
  action: ActionName;
  audio?: string;        // '/audio/friday/01-maya.mp3' 또는 내 녹음 blob URL
  text?: string;         // 말풍선 글자. audio만 있고 text가 없으면 '🎤 0:04' 음성 말풍선
  caption?: string;      // 상황 자막. 예: 'Read 9:41 PM', '3 hours later'
  maxMs?: number;        // 오디오·글자 없는 비트 길이 (기본 1200)
  reactions?: { actorId: string; action: ActionName }[]; // 같은 순간 다른 사람들 반응
}

export interface Room {
  id: string;
  title: string;         // 'Friday plans'
  emoji: string;         // '🍕'
  preview: string;       // 바텀시트 카드의 마지막 메시지
  unread: number;
  members: Member[];     // 'me' 포함, 최대 5명
  script: Beat[];        // 입장하면 자동 재생 (첫 비트는 me의 walk_in)
  onUserMessage: Beat[][]; // 내가 보낸 n번째 메시지에 대한 반응. 끝까지 가면 마지막 걸 반복
}
```

### B가 제공하는 함수

```ts
// src/lib/avatar.ts
export const AVATAR_OPTIONS: { body: string[]; skin: string[]; legs: string[]; shoes: string[]; face: string[]; glasses: GlassesName[] };
export const DEFAULT_AVATAR: AvatarConfig;
export function randomAvatar(): AvatarConfig;
export function avatarFaceUrl(cfg: AvatarConfig): string; // 작은 아이콘용 얼굴 SVG. 무대 위 캐릭터는 <Avatar>

// src/components/avatar/  — 공동으로 쓴다. 바꾸기 전에 말한다.
// <Avatar config pose face seed talking />
// <AvatarStage spin camera fov>{children}</AvatarStage>

// src/lib/me.tsx
export function MeProvider(props: { children: React.ReactNode }): JSX.Element;
export function useMe(): { avatar: AvatarConfig; setAvatar(cfg: AvatarConfig): void };

// src/lib/stt.ts  — 지원 안 되면 null
export function startSTT(): { stop(): Promise<string | null> } | null;
```

### 화면 조립 (page.tsx, A)

```tsx
const [openRoomId, setOpenRoomId] = useState<string | null>(null);
const room = ROOMS.find((r) => r.id === openRoomId);

<MeProvider>                                                        {/* B */}
  {room
    ? <RoomView room={room} onBack={() => setOpenRoomId(null)} />   // A
    : <MyRoom rooms={ROOMS} onOpen={setOpenRoomId} />}              // B (바텀시트 포함)
</MeProvider>
```

### 내 메시지 흐름 (A)

1. 🎤 탭 → 녹음 시작(+ `startSTT()`가 null이 아니면 같이 시작). 다시 탭하거나 15초가 지나면 정지.
2. `{ actorId: 'me', action: 'talk', audio: blobUrl, text: sttText ?? undefined }` 재생.
3. `onUserMessage[min(n, 길이 - 1)]` 재생.

텍스트 입력이면 `{ actorId: 'me', action: 'talk', text }`. 서버 호출은 없다. VC가 무슨 말을 하든 누군가 듣고는 다시 엎드린다.

## A 상세: 방(원탁)

**레이아웃:** 상단에 ← 뒤로 + 방 이름 + "2 watching". 가운데에 원탁을 약간 위에서 내려다본다. 하단에는 자막, 🎤 버튼, 텍스트 입력.

**원탁은 3D다.** `<AvatarStage camera={[0, 2.2, 3.4]} fov={34}>` 안에 원탁 메시 하나와 `<Avatar>` 5개를 둔다. **모든 자리는 테이블 먼 쪽 호에 카메라를 향해 앉힌다**(그래야 모든 얼굴이 보인다). 자리 좌표는 호를 따라 각도로 계산한다:

```tsx
// seat 0~4 → 테이블 먼 쪽 호. 가운데가 정면, 양끝이 살짝 안쪽을 본다.
const a = Math.PI * (0.62 + seat * 0.19);   // 0.62π ~ 1.38π
const pos: [number, number, number] = [Math.cos(a) * 1.15, 0, Math.sin(a) * 0.78];
const rotY = -a - Math.PI / 2;              // 카메라 쪽을 보게
<group position={pos} rotation={[0, rotY, 0]}>
  <Avatar config={m.avatar} pose={pose} face={face} seed={m.seat} talking={isTalking} />
</group>
```

내 자리는 발밑에 민트색 링 메시를 깐다. 테이블 메시는 `<cylinderGeometry args={[1.0, 1.0, 0.08, 32]} />` 하나면 충분하고, 캐릭터는 앉으면 상반신만 테이블 위로 올라온다.

**자세:**
- `watching`: 앉아서 정면, 선명
- `away`: 팔 위에 얼굴을 묻고 엎드림, 흐리게, 가끔 💤
- `gone`: 빈 의자만

**몸짓:** `types.ts`의 `ACTION_POSES[action]`이 각 액션을 `{pose, face, ms, emoji}` 단계로 풀어 준다. 재생기는 단계를 순서대로 `<Avatar pose face>`에 넘기기만 하면 되고, 포즈 사이 보간은 `Avatar`가 알아서 한다. 이모지(👀 💦 ✋)는 drei `<Html>` 또는 빌보드 스프라이트로 머리 위에 띄운다. 아래 표는 그 결과가 어떻게 보여야 하는지다:

| action | 연출 | 길이 |
|---|---|---|
| `walk_in` | 화면 옆에서 걸어 들어와 빈자리에 앉음. `watching`인 사람만 고개를 돌려 쳐다봄 | 2000ms |
| `sit_up` | 엎드림 → 상체 일으킴, 흐림 해제 | 500ms |
| `slump` | 상체 숙여 팔 위로 엎드림, 흐려짐 | 500ms |
| `talk` | 오디오 재생 + 입 움직임(볼륨 기반, 안 되면 통통) + 말풍선 | 오디오 끝까지 |
| `read_ignore` | `sit_up` → 👀 말한 사람 쪽으로 고개 돌려 700ms → `slump` | 1800ms |
| `startle_up` | 💦 + 화들짝 튀어 오르며 앉음 + 헐떡 | 1200ms |
| `stand_leave` | 일어남 → 의자 뒤로 밀림 → 화면 밖으로 걸어 나감 → 빈 의자. 나머지는 `freeze` | 1800ms |
| `cover_mouth` | 말풍선이 뜨다가 ✋ 가 입을 덮고 말풍선이 찢어짐 | 1200ms |
| `typing_stop` | `sit_up` → 말풍선 "…" → 사라짐 → `slump` | 1600ms |
| `heart` / `laugh` | 🫶 팝업 / 😂 + 뒤로 젖혀짐 | 900ms |
| `freeze` | 그 자리에서 멈춤, 살짝 흑백 | 다음 비트까지 |

**재생기 규칙:**
- 방 입장 **클릭 핸들러 안에서** AudioContext를 만들거나 resume한다(iOS 자동재생 차단 해제).
- `away`인 사람이 `talk`를 받으면 먼저 `sit_up`을 자동으로 넣는다.
- `talk`는 오디오 `ended`에서 다음으로 넘어간다. **상한 타이머를 같이 건다**: 길이 + 1000ms(길이를 모르면 8초).
- 오디오가 없거나 로드에 실패하면 `max(1500, text.length * 60)`ms 동안 말풍선만.
- `reactions`는 같은 비트 안에서 동시에 재생한다.
- 음소거 토글. 소리를 꺼도 말풍선·자막만으로 이해되어야 한다.

**녹음 (`recorder.ts`):**
- 마이크 권한은 🎤 를 **처음 누를 때만** 요청한다.
- `MediaRecorder.isTypeSupported`로 mimeType을 고른다(Chrome `audio/webm`, Safari `audio/mp4`). 최대 15초.
- `getUserMedia`·`MediaRecorder`가 없거나 거부되면 🎤 를 숨기고 "No mic? Type instead." 토스트 + 텍스트 입력만.
- 녹음은 blob URL로 기기 안에서만 재생한다. 서버로 보내지 않는다.

**A 완료 기준:** 첫 방이 입장부터 끝까지 팀원 목소리로 재생되고, 펀치라인(읽씹)이 입장 후 10초 안에 나오고, 내 음성·텍스트 메시지에 반응이 나온다.

## B 상세: 마이룸·바텀시트·대본

**아바타 (완료, `1ca0a14`):** react-three-fiber 프리미티브(구·캡슐·원뿔대)로 직접 조립했다. 모델링 파일도, 외부 아바타 라이브러리도, 이미지 생성 API도 쓰지 않으므로 **라이선스 확인이 필요 없다**.

- `<Avatar config pose face seed talking />` — 캐릭터 본체. 뼈대가 없고 group 회전만 쓴다. 포즈 사이는 `damp`로 보간돼서 끊기지 않는다. `seed`를 자리 번호로 주면 숨쉬기·눈 깜빡임이 캐릭터마다 어긋나 무대가 살아난다.
- `<AvatarStage spin camera fov>` — 조명·그림자 프리셋. 마이룸과 원탁이 같은 룩을 쓰도록 한 곳에만 둔다.
- `avatarFaceUrl(cfg)` — 얼굴 SVG data URI. **바텀시트 미니 원탁처럼 Canvas를 띄우기 아까운 곳에만** 쓴다. 무대 위 캐릭터는 반드시 `<Avatar>`.
- 꾸미기 슬롯은 `AVATAR_OPTIONS`에 값만 추가하면 늘어난다 = 상점 아이템 단위.

**마이룸:** 방 배경 안에 내 캐릭터가 서 있다(숨쉬기). 꾸미기 패널(`AVATAR_OPTIONS`의 몸통·피부·다리·신발·얼굴 색 + 안경·가방)을 바꾸면 즉시 반영하고 localStorage에 저장한다. 첫 방문은 `randomAvatar()`로 시작해서 처음부터 귀엽게 보이게 한다.

**바텀시트:** snap point가 있는 React 바텀시트(예: `vaul`) 또는 직접 구현. 접힘(손잡이 + 첫 카드 일부) → 반 → 전체. 방 카드에는 이모지 + 이름, **미니 원탁**(앉은 사람·엎드린 사람 작은 점이나 얼굴), 미리보기, 안 읽은 수 배지. 첫 방에만 "Open a chat 👆" 힌트.

**방 대본 (`src/data/rooms.ts`):** 팀 단톡의 실제 장면을 영어로 옮긴다. 방 하나에 비트 6~8개, **펀치라인은 `walk_in` 다음 2~3번째 비트**. 아래는 형식 예시이고, 내용은 진짜 대화로 바꾼다.

```ts
{
  id: 'friday', title: 'Friday plans', emoji: '🍕', preview: 'LEO. I SAW THAT.', unread: 3,
  members: [
    { id: 'maya', name: 'Maya', avatar: MAYA, seat: 0, startsAs: 'watching' },
    { id: 'jun',  name: 'Jun',  avatar: JUN,  seat: 1, startsAs: 'away' },
    { id: 'me',   name: 'You',  avatar: DEFAULT, seat: 2, startsAs: 'watching' },
    { id: 'leo',  name: 'Leo',  avatar: LEO,  seat: 3, startsAs: 'away' },
  ],
  script: [
    { actorId: 'me', action: 'walk_in' },
    { actorId: 'maya', action: 'talk', audio: '/audio/friday/01-maya.mp3', text: 'guys. friday. are we still on??' },
    { actorId: 'leo', action: 'read_ignore', caption: 'Read 9:41 PM', reactions: [{ actorId: 'maya', action: 'freeze' }] },
    { actorId: 'maya', action: 'talk', audio: '/audio/friday/02-maya.mp3', text: 'LEO. I SAW THAT.' },
    { actorId: 'jun', action: 'startle_up', caption: '3 hours later' },
    { actorId: 'jun', action: 'talk', audio: '/audio/friday/03-jun.mp3', text: 'sorry i was asleep. what is friday' },
    { actorId: 'maya', action: 'cover_mouth', audio: '/audio/friday/04-maya.mp3', text: 'you know what, forget it', caption: 'Maya unsent a message' },
    { actorId: 'leo', action: 'stand_leave', caption: 'Leo left the conversation',
      reactions: [{ actorId: 'maya', action: 'freeze' }, { actorId: 'jun', action: 'freeze' }] },
  ],
  onUserMessage: [
    [{ actorId: 'maya', action: 'read_ignore', caption: 'Read' }],
    [{ actorId: 'jun', action: 'startle_up' }, { actorId: 'jun', action: 'talk', audio: '/audio/friday/05-jun.mp3', text: 'wait who said that' }],
    [{ actorId: 'maya', action: 'laugh' }],
  ],
}
```

방 2 "Family 👨‍👩‍👧"(엄마 `typing_stop`, 아빠 `cover_mouth`)는 13:30 이후, 시간이 되는 만큼.

**녹음 (13:00–13:30, 둘 다 참여 10분):** 조용한 곳에서 폰 음성 메모로 대사 한 줄당 파일 하나. 과장해서 연기할수록 좋다. 앞뒤 무음을 자르고 `public/audio/<room>/<nn>-<name>.mp3`(또는 `.m4a`)로 커밋한다.

**STT 도우미 (`stt.ts`, 13:30–14:00):**
- 브라우저 내장 음성 인식(`SpeechRecognition` / `webkitSpeechRecognition`)이 있으면 쓴다. 언어는 `navigator.language`(한국 VC는 한국어로 말할 수 있다).
- 없으면 `null`을 반환한다. `stop()`이 실패하거나 빈 결과면 `null` → A가 음성 말풍선으로 표시.
- Chrome, iPhone Safari, Android Chrome에서 **녹음과 동시에** 돌려보고, 녹음이 무음이 되는 기기에서는 `null`을 반환하게 막는다.

**실시간 (14:00 체크포인트 통과 시에만, `/live/[code]`):**
- 조건: 배포 URL에서 마이룸 + 첫 방 + 내 음성 메시지가 iPhone까지 다 됨.
- 실시간 서비스(예: Supabase Realtime)의 presence로 `document.visibilityState`에 따라 앉음/엎드림을 동기화하고, broadcast로 텍스트 메시지를 주고받는다. 음성은 시간이 남을 때만.
- 메인 화면에는 "Invite a friend (beta)" 링크 하나만. **14:30까지 두 기기에서 안정적으로 돌지 않으면 링크를 숨긴다.**

**B 완료 기준:** 마이룸에서 꾸민 캐릭터가 방에도 그대로 나오고, 바텀시트에서 첫 방이 열리고, 첫 방 녹음 파일이 전부 재생된다.

## 타임라인과 동기화 지점 (KST)

| 시간 | A (방) | B (마이룸·바텀시트·대본) |
|---|---|---|
| 12:15–12:30 | Next.js 스캐폴드 → push | `types.ts` + `avatar.ts`(라이브러리·라이선스) + 첫 방 대본(텍스트) → push, Vercel 연결·첫 배포 |
| **12:30 SYNC 1** | 첫 방 대본으로 원탁 시작(오디오 없이 말풍선만) | 마이룸 꾸미기 시작 |
| 12:30–13:30 | 원탁·자리, 앉음/엎드림, `walk_in`·`sit_up`·`slump`·`talk`·`read_ignore`·`startle_up`·`stand_leave`, 자막 | 마이룸 + 꾸미기 + 저장, 바텀시트 + 방 카드, **13:00–13:30 대사 녹음(A도 10분 참여) → 커밋** |
| **13:30 SYNC 2** | 마이룸 → 방, 꾸민 캐릭터 + 팀원 목소리로 통합 확인 | 같이 확인 |
| 13:30–14:00 | 🎤 녹음 + 텍스트 입력 + `onUserMessage`, 입 움직임, 나머지 몸짓 | `stt.ts` + 기기별 시험, 방 2 대본·녹음 |
| **14:00 체크포인트** | 계속 다듬기 | 조건 충족 → 실시간 시작 / 미충족 → QA 합류 |
| **14:15 SYNC 3** | 팀 밖 1명에게 설명 없이 링크만 주고 말없이 지켜보기 | 같이 지켜보고 메모 |
| 14:15–14:45 | iPhone Safari(한국어 설정)·Android Chrome·카카오톡 인앱 수정, PDF용 스크린샷 3장 | 실시간은 14:30까지 안정 못 하면 숨김, 장애 테스트(마이크 거부, 오디오 실패, 오프라인), PDF 초안 |
| 14:45–15:15 | **main 동결.** 체크리스트 같이 확인 | PDF 확정 |
| 15:15–15:45 | **제출** → 제출한 배포를 Production으로 고정 | |

**자르기 트리거:**
- 13:30에 원탁이 첫 방을 끝까지 재생 못 하면 → 방 1개만, 나머지 몸짓은 뺌
- 13:30에 녹음 파일이 없으면 → 말풍선만으로 진행, 녹음은 14:00까지
- 14:00에 STT가 기기별로 불안정하면 → 음성 말풍선만
- 14:15에 방 2가 미완성이면 → 숨김
- **마이룸 + 첫 방(팀원 목소리) + 내 메시지 읽씹 반응은 끝까지 자르지 않는다**

## Git·배포 규칙

- 2명이라 `main`에 직접 push해도 된다. 폴더 소유권으로 충돌을 피한다. push 전에는 항상 `git pull --rebase`.
- 공동 파일(`types.ts`, `package.json`, `page.tsx`)은 바꾸기 전에 말로 알린다.
- Vercel: `main` = 제출 URL. **14:45 이후 main 동결.**
- **제출 직후** Vercel에서 제출한 배포를 Production으로 고정하고 자동 배포를 끈다. 이후 작업은 다른 브랜치의 preview에서만 한다.
- `.env.local`은 절대 커밋하지 않는다(실시간을 할 경우에만 키가 생긴다).

### 스캐폴드 (A, 12:15)

```bash
npx create-next-app@latest . --ts --app --src-dir --tailwind --eslint --import-alias "@/*"
```

폴더에 파일이 있다고 거부하면 임시 폴더에 만들고 옮긴다:

```bash
npx create-next-app@latest app-tmp --ts --app --src-dir --tailwind --eslint --import-alias "@/*"
rsync -a app-tmp/ ./ && rm -rf app-tmp
```

## 제출 게이트 (기회는 한 번)

| 항목 | 실패하면 |
|---|---|
| 새 시크릿 Chrome·iPhone Safari·Android Chrome·카카오톡 인앱에서 3초 안에 열림 | 고칠 때까지 보류 |
| 첫 방 입장 시 팀원 목소리가 나오고, 소리 없이도 말풍선·자막으로 이해됨 | 고칠 때까지 보류 |
| 펀치라인이 입장 후 10초 안에 나옴 | 고칠 때까지 보류 |
| 내 음성 메시지가 녹음되고 내 캐릭터가 그 목소리로 말함(Chrome, iPhone Safari) | 해당 기기에서 텍스트 입력만 |
| 마이크 거부·없음·인앱 브라우저에서 텍스트 입력으로 같은 반응 | 고칠 때까지 보류 |
| 내 메시지에 읽씹 반응이 나옴 | 고칠 때까지 보류 |
| 콘솔 오류 없음, 클라이언트 번들에 키 없음 | 고칠 때까지 보류 |
| 실시간 링크가 두 기기에서 안정적으로 동작 | 링크 숨기고 제출 |
| 팀 밖 사람이 설명 없이 **30초 안에** 이해하고 웃음(10초는 목표치) | 첫 방 대본·힌트 문구 수정 후 재시험 |
| 제출 링크가 고정된 Production 배포를 가리킴 | 제출 전 수정 |

"고칠 때까지 보류" 항목이 **16:15**까지 해결되지 않으면, 그 기능을 빼고 제출한다.

## PDF 2장 (B, 14:15–14:45 초안)

- **1페이지:** 한 줄 훅 / 인사이트(음성 메시지는 막대기 목록이고, 채팅은 누가 보고 있는지 숨긴다 → 원탁에서는 보고 있는 사람만 앉아 있고, 대화는 진짜 목소리로 한다) / 마이룸·원탁·읽씹 스크린샷 3컷(A 제공) / "90초 체험법" 3단계 + 링크·QR / "데모 속 친구들은 팀원이 녹음했고, 당신의 목소리는 진짜입니다."
- **2페이지:** Why now(음성 메시지와 아바타 표현이 이미 일상이다) / Sora cameo·Bitmoji·Apple Persona 대비 차별점 / 로드맵(실시간 멀티유저, 실제 메신저 연동, 숏폼 에피소드 내보내기) / 팀. 데모에서 확인할 수 없는 주장은 쓰지 않는다.
