# 분업 가이드 (2인)

> 전체 설계와 이유: [`docs/designs/group-chat-scene.md`](designs/group-chat-scene.md). 이 문서는 "누가, 어떤 파일을, 언제까지"만 다룬다.

## 한 줄 요약

홈에는 내 아바타가 서 있고, 민트색 바텀시트에 채팅방 목록이 있다. 방에 들어가면 친구들이 원탁에 둘러앉아 있고, **지금 방에 들어와 있는 사람만 고개를 들고** 대화한다. 읽씹·늦은 답장·나가기는 자세와 몸짓으로 보인다. VC가 링크를 **혼자** 열어서 써보고 통과를 누른다. 제출은 **한 번**뿐이다.

## 역할

| | A — 방(원탁) 담당 | B — 홈·페르소나·대본 담당 |
|---|---|---|
| 만드는 것 | 원탁 화면, 캐릭터(`Avatar`), 자세·몸짓 애니메이션, 대사 재생(TTS·자막), 입력창과 반응 재생, 홈↔방 전환 | 홈(서 있는 내 아바타 + 민트 바텀시트 + 방 목록), 방 대본 데이터, 셀카 → 페르소나 API, Cast yourself, 배포, PDF |
| 입력 | `Room` 데이터 + 내 페르소나 | 셀카, 팀 실제 대화 |
| 출력 | 방 화면 | `Room[]` 데이터, 내 페르소나 URL |
| 이름 | (A 이름) | (B 이름) |

두 사람은 **`src/lib/types.ts`의 `Room` 하나로만** 연결된다. A는 B의 홈이 없어도 첫 방 데이터로 원탁을 끝까지 만들 수 있고, B는 A의 원탁이 없어도 데이터와 홈을 만들 수 있다.

## 파일 소유권

| 경로 | 소유 |
|---|---|
| `src/app/page.tsx` (홈 ↔ 방 전환) | A (B는 `<Home />`만 끼운다) |
| `src/components/room/*` (RoomView, Table, Seat, Captions, ChatInput) | A |
| `src/components/Avatar.tsx` (홈·방 공용 캐릭터) | A — **12:40까지 v0 push** (원형 얼굴 + 둥근 몸통이면 충분) |
| `src/lib/player/*` (비트 재생기, speechSynthesis) | A |
| `src/lib/types.ts` | **공동** — 바꾸기 전에 반드시 말로 알린다 |
| `src/data/rooms.ts` (방 대본) | B |
| `src/components/home/*` (Home, BottomSheet, RoomList) | B |
| `src/components/CastYourself.tsx` | B |
| `src/lib/me.tsx` (MeProvider: 내 페르소나·이름) | B |
| `src/app/api/persona/route.ts` | B |
| `public/personas/*` (캐스트 + 프리셋 6개, 512px WebP) | B |
| `docs/*` (PDF 포함) | B |
| `package.json` | A가 생성. 이후 의존성 추가는 말로 알리기 |

## 계약: `src/lib/types.ts`

B가 12:20까지 이 내용 그대로 push한다. 이후 변경은 합의해서만.

```ts
export type ActionName =
  | 'look_up'      // 고개 듦 (방에 들어옴)
  | 'look_down'    // 고개 숙임 (방을 안 봄)
  | 'talk'         // 말하기: 몸 통통 + 말풍선 + TTS
  | 'read_ignore'  // 읽씹: 고개 들어 👀 말한 사람 쳐다봄 → 다시 숙임 (퇴장 안 함)
  | 'startle_up'   // 늦은 답장: 화들짝 고개 듦 + 💦
  | 'stand_leave'  // 방 나가기: 일어나 의자 밀고 퇴장, 자리 빔 (재등장 없음)
  | 'cover_mouth'  // 메시지 취소: 말하다 ✋ 로 입 막음
  | 'typing_stop'  // 입력하다 멈춤: 고개 들고 입 열었다(…) 닫고 다시 숙임
  | 'heart'        // 리액션 🫶
  | 'laugh'        // 리액션 😂
  | 'freeze';      // 주변 반응: 얼어붙음

export type Presence = 'present' | 'away' | 'gone'; // 고개 듦 / 고개 숙임 / 나감(빈자리)

export interface Voice {
  pitch: number;   // 0.5 ~ 2
  rate: number;    // 0.7 ~ 1.4
}                  // lang은 'en-US' 고정

export interface Member {
  id: string;            // 'leo', 내 자리는 항상 'me'
  name: string;          // 'Leo', 내 자리는 'You'
  personaUrl: string;    // '/personas/leo.webp'. 'me'는 MeProvider 값으로 덮어씀
  voice: Voice;
  seat: 0 | 1 | 2 | 3 | 4; // 테이블 먼 쪽 호, 왼쪽부터. 'me'는 가운데(2)
  startsAs: Presence;
}

export interface Beat {
  actorId: string;       // Member.id ('me' 포함)
  action: ActionName;
  line?: string;         // TTS로 읽을 대사
  caption?: string;      // 자막. 없으면 line. 예: 'Read 9:41 PM', '3 hours later'
  maxMs?: number;        // 대사 없을 때 길이 (기본 1200)
  reactions?: { actorId: string; action: ActionName }[]; // 같은 순간 다른 사람들 반응
}

export interface Room {
  id: string;
  title: string;         // 'Friday plans'
  emoji: string;         // '🍕'
  preview: string;       // 목록에 보일 마지막 메시지
  unread: number;
  members: Member[];     // 'me' 포함, 최대 5명
  script: Beat[];        // 입장하면 자동 재생
  onUserMessage: Beat[][]; // 내가 보낸 n번째 메시지에 대한 반응. 끝까지 가면 마지막 걸 반복
}
```

### 화면 조립 (page.tsx, A)

```tsx
const [openRoomId, setOpenRoomId] = useState<string | null>(null);
const room = ROOMS.find((r) => r.id === openRoomId);

<MeProvider>                                     {/* B */}
  {room
    ? <RoomView room={room} onBack={() => setOpenRoomId(null)} />  // A
    : <Home rooms={ROOMS} onOpen={setOpenRoomId} />}               // B
</MeProvider>
```

`useMe()` → `{ personaUrl, name, setPersona }`. RoomView는 `members`의 `'me'` 자리에 이 값을 넣는다.

### 내 메시지 흐름 (A)

입력창에서 보내면 → `{ actorId: 'me', action: 'talk', line: 입력값 }` 재생 → `onUserMessage[min(n, 길이 - 1)]` 재생. API 호출 없음. VC가 무슨 말을 하든 누군가 읽고 다시 고개를 숙인다.

## A 상세: 방(원탁)

**레이아웃:** 상단에 ← 뒤로 + 방 이름 + "2 here"(고개 든 사람 수). 가운데에 타원형 원탁을 약간 위에서 내려다본다. **모든 자리는 테이블 먼 쪽 호에 카메라를 향해 앉는다**(그래야 모든 얼굴이 보인다). 내 자리(가운데)는 민트색 테두리. 테이블 위로는 상반신만 보인다. 하단에는 자막과 입력창("Say something…").

**자세:**
- `present`: 고개 들고 정면, 선명
- `away`: 고개 숙이고(머리 기울기·약간 축소) 폰 화면 빛이 얼굴에, 흐리게
- `gone`: 빈 의자만

**몸짓** (CSS keyframes면 충분하다. 과장할수록 웃기다):

| action | 연출 | 길이 |
|---|---|---|
| `look_up` | 고개 듦, 흐림 해제 | 400ms |
| `look_down` | 고개 숙임, 폰 빛, 흐려짐 | 400ms |
| `talk` | 통통 튀기 + 말풍선 | TTS 끝까지 |
| `read_ignore` | `look_up` → 👀 띄우고 말한 사람 쪽으로 고개 돌려 700ms 정지 → `look_down` | 1800ms |
| `startle_up` | 💦 + 화들짝 튀어 오르며 고개 듦 + 헐떡 | 1200ms |
| `stand_leave` | 일어남 → 의자 뒤로 밀림 → 화면 밖으로 걸어 나감 → 빈 의자. 나머지는 `freeze` | 1800ms |
| `cover_mouth` | 말풍선이 뜨다가 ✋ 가 입을 덮고 말풍선이 찢어짐 | 1200ms |
| `typing_stop` | `look_up` → 말풍선 "…" → 사라짐 → `look_down` | 1600ms |
| `heart` / `laugh` | 🫶 팝업 / 😂 + 뒤로 젖혀짐 | 900ms |
| `freeze` | 그 자리에서 멈춤, 살짝 흑백 | 다음 비트까지 |

**재생기 규칙:**
- 첫 재생은 방 입장 **클릭 핸들러 안에서** 빈 발화로 TTS를 잠금 해제한 뒤 시작한다(iOS Safari).
- `away`인 사람이 `talk` 비트를 받으면 먼저 `look_up`을 자동으로 넣는다.
- 대사가 있으면 `utterance.onend`에서 다음으로 넘어간다. **상한 타이머를 같이 건다**: `max(1500, line.length * 60)`ms.
- `lang = 'en-US'`. `voiceschanged`를 기다린 뒤 영어 음성을 고르고, 캐릭터별로 pitch·rate만 다르게 준다. 영어 음성이 없거나 `speechSynthesis`가 없으면 같은 타이밍으로 **자막만** 진행한다(카카오톡 인앱 브라우저 대비).
- `reactions`는 같은 비트 안에서 동시에 재생한다.
- 음소거 토글. 소리를 꺼도 자막만으로 이해되어야 한다.

**A 완료 기준:** 첫 방 데이터로 입장부터 끝까지 재생되고, 펀치라인(읽씹)이 입장 후 10초 안에 나오고, 내 메시지에 반응이 나온다.

## B 상세: 홈·페르소나·대본

**홈:** 화면 가운데에 내 아바타가 서 있다(`<Avatar pose="stand" />`, 숨쉬기). 아래에 [📸 Make it you] [Pick a stand-in] 버튼이 나란히 있다. 하단 민트색 바텀시트(#A6F2DC 근처)가 반쯤 올라와 있고 방 목록이 보인다. 각 항목에는 이모지 + 방 이름, 멤버 얼굴 겹쳐 쌓기, 미리보기, 안 읽은 수 배지, "2 here"가 표시된다. 첫 방에만 "Open a chat 👇" 힌트를 띄운다.

**방 대본 (`src/data/rooms.ts`):** 팀 단톡의 실제 장면을 영어로 옮긴다. 방 하나에 비트 6~8개, **펀치라인은 2~3번째 비트**. 아래는 형식 예시이고, 내용은 진짜 대화로 바꾼다.

```ts
{
  id: 'friday', title: 'Friday plans', emoji: '🍕', preview: 'LEO. I SAW THAT.', unread: 3,
  members: [
    { id: 'maya', name: 'Maya', personaUrl: '/personas/maya.webp', voice: { pitch: 1.3, rate: 1.1 }, seat: 0, startsAs: 'present' },
    { id: 'jun',  name: 'Jun',  personaUrl: '/personas/jun.webp',  voice: { pitch: 0.9, rate: 1.0 }, seat: 1, startsAs: 'away' },
    { id: 'me',   name: 'You',  personaUrl: '',                     voice: { pitch: 1.0, rate: 1.0 }, seat: 2, startsAs: 'present' },
    { id: 'leo',  name: 'Leo',  personaUrl: '/personas/leo.webp',  voice: { pitch: 0.8, rate: 0.9 }, seat: 3, startsAs: 'away' },
  ],
  script: [
    { actorId: 'maya', action: 'talk', line: 'guys. friday. are we still on??' },
    { actorId: 'leo', action: 'read_ignore', caption: 'Read 9:41 PM', reactions: [{ actorId: 'maya', action: 'freeze' }] },
    { actorId: 'maya', action: 'talk', line: 'LEO. I SAW THAT.' },
    { actorId: 'jun', action: 'startle_up', caption: '3 hours later' },
    { actorId: 'jun', action: 'talk', line: 'sorry i was asleep. what is friday' },
    { actorId: 'maya', action: 'cover_mouth', line: 'you know what, forget it', caption: 'Maya unsent a message' },
    { actorId: 'leo', action: 'stand_leave', caption: 'Leo left the conversation',
      reactions: [{ actorId: 'maya', action: 'freeze' }, { actorId: 'jun', action: 'freeze' }] },
  ],
  onUserMessage: [
    [{ actorId: 'maya', action: 'read_ignore', caption: 'Read' }],
    [{ actorId: 'jun', action: 'startle_up' }, { actorId: 'jun', action: 'talk', line: 'wait who said that' }],
    [{ actorId: 'maya', action: 'laugh' }],
  ],
}
```

방 2 "Family 👨‍👩‍👧"(엄마 `typing_stop`, 아빠 `cover_mouth`)와 방 3 "Group project 😩"(`stand_leave`)는 13:30 이후, 시간이 되는 만큼.

**페르소나:**
- 이미지 생성 API는 팀이 **유료 키**를 가진 쪽(OpenAI 또는 Google 이미지 모델). 무료 티어 키는 쓰지 않는다(입력이 학습에 쓰일 수 있음). 대시보드에 지출 상한을 건다.
- 스타일 프롬프트는 하나로 고정한다: sticker-style cartoon head, front-facing, plain white background, same style for everyone. **13:00에 동결.** 그 전까지 A는 임시 이미지로 개발한다.
- 동결 후 같은 프롬프트로 캐스트 페르소나와 **프리셋 6개**(실존 인물이 아니라 텍스트 프롬프트로 생성)를 만들고, 512px WebP로 줄여 13:30까지 `public/personas/`에 커밋한다. 첫 화면은 API를 0번 부른다.
- **13:00–13:30 측정:** 배포된 Vercel에서 셀카 10장으로 지연 p50/p90과 성공률을 잰다. p90 > 20초 또는 성공률 < 80%면 더 빠른 모델·낮은 품질·작은 해상도로 바꾼다. 14:00에도 미달이면 셀카 버튼을 숨기고 스탠드인만 남긴다.

**`POST /api/persona`:**
- 클라이언트에서 사진을 캔버스로 다시 그려 JPEG(긴 변 1024px 이하, 1MB 이하)로 보낸다. body `{ image: string }` (data URL). HEIC·큰 원본 대비.
- 응답 `200 { personaUrl: string }` (축소한 WebP/JPEG data URL). 실패는 4xx/5xx.
- `export const maxDuration = 60` 명시. 서버 로그·오류 리포트에 요청 본문과 이미지를 남기지 않는다.
- IP당 분당 30회 메모리 제한은 최선 노력용이다(주 방어선은 지출 상한). 초과하면 429 → 클라이언트가 스탠드인으로 보낸다.

**Cast yourself:**
- 진입 화면: [Use camera] [Upload photo] [Pick a stand-in] + 동의 문구 "Sent to {provider} only to draw your cartoon. We don't keep it."
- `getUserMedia`는 기능 감지 후 사용. 없으면 업로드와 스탠드인만.
- "Drawing you…" (재치 있는 문구 순환) → 성공하면 `setPersona(url)` → 홈 아바타와 모든 방의 내 자리가 바뀐다.
- 25초 타임아웃·오류·429 → "Our artist is busy — pick a stand-in". 카메라 거부·없음 → "No camera? Pick a stand-in." 둘 다 프리셋 그리드로 간다. 막다른 길은 없다.

**B 완료 기준:** 홈에서 첫 방이 열리고, 셀카 성공·실패·거부 경로가 모두 25초 안에 끝나고, 이미지 키를 빼도 홈과 방이 돌아간다.

## 타임라인과 동기화 지점 (KST)

| 시간 | A (방) | B (홈·페르소나·대본) |
|---|---|---|
| 12:05–12:20 | Next.js 스캐폴드 → push | `types.ts` + 첫 방 데이터 → push, Vercel 연결·환경변수·첫 배포 |
| **12:20 SYNC 1** | 첫 방 데이터로 원탁 시작, 12:40까지 `Avatar` v0 push | 페르소나 프롬프트 튜닝(임시 이미지로 홈 개발) |
| 12:20–13:30 | 원탁·자리, `look_up`/`look_down`/`talk`/`read_ignore`/`startle_up`/`stand_leave`, 자막, 재생기 | 홈 + 민트 바텀시트 + 방 목록, 13:00 프롬프트 동결 → 캐스트·프리셋 생성 → 커밋, 지연 측정 |
| **13:30 SYNC 2** | 홈 → 방 이동 + 진짜 페르소나로 통합 확인 | 같이 확인 |
| 13:30–14:15 | 입력창 + `onUserMessage`, 나머지 몸짓, 입장 전환, 모바일 | Cast yourself + 대비책, 방 2~3 데이터, `maxDuration`·지출 상한 |
| **14:15 SYNC 3** | 팀 밖 1명에게 설명 없이 링크만 주고 말없이 지켜보기 | 같이 지켜보고 막힌 곳 메모 |
| 14:15–14:45 | iPhone Safari(한국어 설정)·Android Chrome·카카오톡 인앱 수정, PDF용 스크린샷 3장 | 장애 테스트(이미지 키 제거, 네트워크 차단, 429), PDF 초안 |
| 14:45–15:15 | **main 동결.** 체크리스트 같이 확인 | PDF 확정 |
| 15:15–15:45 | **제출** → 제출한 배포를 Production으로 고정 | |

**자르기 트리거:**
- 13:30에 원탁이 첫 방을 끝까지 재생 못 하면 → 방 1개만, 나머지 몸짓은 뺌
- 14:00에 셀카가 측정 기준 미달이면 → 스탠드인만
- 14:15에 방 3(그다음 방 2)이 미완성이면 → 숨김
- **홈 + 첫 방 + 내 메시지 읽씹 반응은 끝까지 자르지 않는다**

## Git·배포 규칙

- 2명이라 `main`에 직접 push해도 된다. 폴더 소유권으로 충돌을 피한다. push 전에는 항상 `git pull --rebase`.
- 공동 파일(`types.ts`, `package.json`, `page.tsx`)은 바꾸기 전에 말로 알린다.
- Vercel: `main` = 제출 URL. **14:45 이후 main 동결.**
- **제출 직후** Vercel에서 제출한 배포를 Production으로 고정하고 자동 배포를 끈다. 이후 작업은 다른 브랜치의 preview에서만 한다.
- `.env.local`은 절대 커밋하지 않는다.

```bash
# .env.local (커밋 금지)
OPENAI_API_KEY=        # 또는 GEMINI_API_KEY — /api/persona
```

### 스캐폴드 (A, 12:05)

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
| 첫 방 입장 시 소리와 함께 재생, 소리 없이도 자막으로 이해됨 | 고칠 때까지 보류 |
| 펀치라인이 입장 후 10초 안에 나옴 | 고칠 때까지 보류 |
| 내 메시지에 읽씹 반응이 나옴 | 고칠 때까지 보류 |
| 이미지 API가 죽어도 홈·방은 돌아감(키 제거로 확인) | 고칠 때까지 보류 |
| 콘솔 오류 없음, 클라이언트 번들에 API 키 없음 | 고칠 때까지 보류 |
| 셀카 성공 25초 이내, 실패·거부·429 시 스탠드인 | 셀카 숨기고 스탠드인만으로 제출 |
| 큰 원본 사진·HEIC 업로드 성공 | 업로드 숨기고 카메라·스탠드인만 |
| 팀 밖 사람이 설명 없이 **30초 안에** 이해하고 웃음(10초는 목표치) | 첫 방 대본·힌트 문구 수정 후 재시험 |
| 제출 링크가 고정된 Production 배포를 가리킴 | 제출 전 수정 |

"고칠 때까지 보류" 항목이 **16:15**까지 해결되지 않으면, 그 기능을 빼고 제출한다.

## PDF 2장 (B, 14:15–14:45 초안)

- **1페이지:** 한 줄 훅 / 인사이트(채팅은 누가 있는지·읽었는지를 숨긴다 → 원탁에서는 고개를 든 사람만 대화한다) / 홈·원탁·읽씹 스크린샷 3컷(A 제공) / "90초 체험법" 3단계 + 링크·QR
- **2페이지:** Why now(Gen Z는 아바타로 자신을 표현하고 단톡을 콘텐츠화한다, 페르소나 생성이 싸졌다) / Sora cameo·Bitmoji·Apple Persona 대비 차별점 / 로드맵(실제 메신저 연동, 대화 붙여넣기, 숏폼 에피소드 내보내기, 본인 동의 기반 캐스팅) / 팀. 데모에서 확인할 수 없는 주장은 쓰지 않는다.
