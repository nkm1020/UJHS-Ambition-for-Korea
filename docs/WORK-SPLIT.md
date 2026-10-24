# 분업 가이드 (2인)

> 전체 설계와 이유는 [`docs/designs/group-chat-scene.md`](designs/group-chat-scene.md)에 있다. 이 문서는 "누가, 어떤 파일을, 언제까지"만 다룬다.

## 한 줄 요약

단톡 대화를 넣으면 친구들 페르소나가 한 방(무대)에 나와 연기하고, 읽씹·늦은 답장·방 나가기 같은 채팅 신호는 몸짓으로 바뀐다. VC가 링크를 **혼자** 열어서 써보고 통과를 누른다. 제출은 **한 번**뿐이다.

## 역할

| | A — 방(무대) 담당 | B — 엔진·페르소나 담당 |
|---|---|---|
| 한 줄 | **보이는 모든 것** | **장면을 만드는 모든 것** |
| 만드는 것 | 랜딩, 무대, 캐릭터, 몸짓 애니메이션, 대사 재생(TTS·자막), 신호 칩 UI | 장면 스키마, 규칙 엔진(대화 → 장면), 샘플 대화, 셀카 → 페르소나 API, Cast yourself 흐름, 배포, PDF |
| 입력 | `Scene` JSON (아래 계약) | 채팅 대화 + 신호 칩 상태 + 셀카 |
| 출력 | 화면 | `Scene` JSON, `personaUrl` |
| 이름 | (A 이름) | (B 이름) |

두 사람은 **`Scene` JSON 하나로만** 연결된다. A는 B의 코드가 없어도 픽스처 JSON으로 끝까지 만들 수 있고, B는 A의 화면이 없어도 JSON 출력만 맞추면 된다.

## 파일 소유권

| 경로 | 소유 |
|---|---|
| `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css` | A |
| `src/components/stage/*` (Stage, Character, SpeechBubble, Captions, Door …) | A |
| `src/components/SignalChips.tsx` | A |
| `src/lib/player/*` (beat 시퀀서, speechSynthesis) | A |
| `src/lib/scene/types.ts` | **공동** — 바꾸기 전에 반드시 말로 알린다 |
| `src/lib/scene/build.ts` (규칙 엔진) | B |
| `src/lib/scene/sample.ts` (샘플 대화 + 캐스트) | B |
| `src/components/CastYourself.tsx` | B (A는 레이아웃에 배치만) |
| `src/app/api/persona/route.ts` | B |
| `src/app/api/direct/route.ts` (대화 붙여넣기, 시간 남으면) | B |
| `public/personas/*` (팀 페르소나 + 프리셋 6개) | B |
| `package.json` | 처음엔 A가 생성. 이후 의존성 추가 시 말로 알리기 |

## 계약: `src/lib/scene/types.ts`

B가 12:10까지 이 내용 그대로 push한다. 이후 변경은 합의해서만.

```ts
export type ActionName =
  | 'idle'              // 기본 대기 (살짝 숨쉬기)
  | 'talk'              // 말하기: 몸 통통 + 말풍선
  | 'enter'             // 무대 밖에서 걸어 들어옴
  | 'stare_turn_away'   // 읽씹: 👀 쳐다봄 → 좌우 반전 → 걸어서 퇴장
  | 'run_in_sweating'   // 늦은 답장: 뛰어 들어옴 + 💦 + 헐떡임
  | 'door_slam_exit'    // 방 나가기: 문으로 퇴장 + 쾅 + 화면 흔들림
  | 'cover_mouth'       // 메시지 취소: 말하다가 ✋ 로 입 막음
  | 'mouth_open_close'  // 입력하다 멈춤: 입 열고(…) 닫고 시선 피함
  | 'heart_hands'       // 리액션 love: 🫶
  | 'laugh_fall'        // 리액션 haha: 웃다가 넘어짐
  | 'step_closer_fast'  // 연속 메시지: 빨라지며 한 발 앞으로
  | 'shout_shake'       // 대문자 / !!!: 커지며 화면 흔들림
  | 'freeze';           // 주변 반응: 얼어붙음

export interface Voice {
  pitch: number;        // 0.5 ~ 2 (speechSynthesis)
  rate: number;         // 0.7 ~ 1.4
  lang: string;         // 'en-US'
}

export interface CastMember {
  id: string;           // 'leo'
  name: string;         // 'Leo' (Cast yourself 후에는 'You')
  personaUrl: string;   // '/personas/leo.png' 또는 data URL
  voice: Voice;
  slot: 0 | 1 | 2 | 3;  // 무대 위 위치, 왼쪽부터
}

export interface Beat {
  actorId: string;
  action: ActionName;
  line?: string;        // TTS로 읽을 대사. 없으면 무언 연기
  caption?: string;     // 자막. 없으면 line을 씀. 예: 'Read 9:41 PM'
  durationMs?: number;  // line이 없을 때 액션 길이 (기본 1200)
  reactions?: { actorId: string; action: ActionName }[]; // 같은 순간 다른 사람들 반응
}

export interface Scene {
  id: string;
  title: string;
  cast: CastMember[];
  beats: Beat[];
  focusBeat?: number;   // 칩 토글 후 다시 재생할 때 여기서 1비트 앞부터 시작
}

export type SignalToggle =
  | 'left_on_read'
  | 'late_reply'
  | 'left_chat'
  | 'unsent'
  | 'typing_then_nothing';

export interface ChatMessage {
  from: string;         // CastMember.id
  text?: string;
  at?: string;          // 'HH:mm'
  system?: 'read' | 'left' | 'unsent' | 'reaction' | 'typing';
  reaction?: 'love' | 'haha';
}
```

### B가 제공하는 함수와 API

```ts
// src/lib/scene/sample.ts
export const SAMPLE_CHAT: ChatMessage[];
export const SAMPLE_CAST: CastMember[];
export const DEFAULT_TOGGLES: SignalToggle[]; // 첫 재생에 켜져 있는 신호 (최소 'left_on_read')

// src/lib/scene/build.ts  — 순수 함수, 동기, API 호출 없음
export function buildScene(
  chat: ChatMessage[],
  cast: CastMember[],
  toggles: SignalToggle[],
): Scene;
```

- **12:10까지는 스텁**이어도 된다. 스텁 `buildScene`은 손으로 쓴 `fixtures/sample-scene.json`을 그대로 반환한다. 그래야 A가 바로 시작할 수 있다.
- `POST /api/persona` — body `{ image: string }` (data URL, 클라이언트에서 512px 이하로 줄여서 보냄) → `200 { personaUrl: string }` (PNG data URL). 실패하면 4xx/5xx를 반환하고 클라이언트가 프리셋으로 넘어간다. 사진은 저장하지 않는다.
- `POST /api/direct` (시간 남으면) — body `{ text: string }` → `200 { chat: ChatMessage[], cast: CastMember[] }`. Claude(`claude-sonnet-5-5`)는 정규화만 하고, 몸짓은 `buildScene`이 정한다.

### A의 화면 조립 (page.tsx)

```tsx
const [toggles, setToggles] = useState(DEFAULT_TOGGLES);
const [cast, setCast] = useState(SAMPLE_CAST);
const scene = useMemo(() => buildScene(SAMPLE_CHAT, cast, toggles), [cast, toggles]);

<Stage scene={scene} />                              // A
<SignalChips value={toggles} onChange={setToggles} /> // A, 바뀌면 focusBeat부터 다시 재생
<CastYourself onPersona={(url) => setCast(swapVictim(cast, url))} /> // B
```

`swapVictim`은 B가 `sample.ts`에서 함께 export한다. 읽씹당하는 캐릭터를 'You'로 바꾸는 함수다. 내 얼굴이 읽씹당하는 게 제일 웃기다.

## A 상세: 방(무대)

**무대 구성:** 방 배경(벽, 소파 정도) 하나, 오른쪽에 문 하나. 캐릭터는 원형으로 자른 페르소나 머리와 캐릭터별 색의 둥근 몸통(div)으로 만든다. 슬롯 0~3에 선다. 하단에 자막, 말하는 캐릭터 위에 말풍선.

**몸짓 스펙** (CSS keyframes면 충분하다. 과장할수록 웃기다):

| action | 연출 | 길이 |
|---|---|---|
| `idle` | 위아래로 2px 숨쉬기 반복 | 루프 |
| `talk` | 통통 튀기 + 말풍선 표시 | TTS 끝까지 |
| `enter` | 화면 밖 → 슬롯으로 걸어옴 | 800ms |
| `stare_turn_away` | 👀 띄우고 600ms 정지 → `scaleX(-1)` → 오른쪽으로 걸어서 퇴장 | 1800ms |
| `run_in_sweating` | 왼쪽에서 빠르게 뛰어옴 + 💦 + 숨 헐떡이며 들썩 | 1500ms |
| `door_slam_exit` | 문으로 걸어감 → 문 닫힘 → 💥 + 화면 흔들림. 남은 사람은 `freeze` | 1600ms |
| `cover_mouth` | 말풍선이 뜨다가 ✋ 가 입을 덮고 말풍선이 찢어짐 | 1200ms |
| `mouth_open_close` | 말풍선에 "…" → 사라짐 → 고개 돌림 | 1500ms |
| `heart_hands` | 🫶 팝업 | 900ms |
| `laugh_fall` | 뒤로 넘어짐 + 😂 | 1200ms |
| `step_closer_fast` | 한 발 앞으로, 재생 속도 1.3배 | 대사 길이 |
| `shout_shake` | 머리 1.3배 + 화면 흔들림 | 대사 길이 |
| `freeze` | 그 자리에서 멈춤 + 얼굴 살짝 흑백 | 다음 비트까지 |

**플레이어 규칙:**
- 첫 재생은 반드시 **사용자 클릭 후**에 시작한다(브라우저 자동재생 차단). 랜딩에는 큰 "▶ Play" 버튼 하나만 둔다.
- 비트를 순서대로 재생한다. `line`이 있으면 `speechSynthesis`로 읽고 `onend`를 기다린다. **대비 타이머를 꼭 건다**: `max(1500, line.length * 60)`ms가 지나면 `onend`가 안 와도 다음으로 넘어간다(iOS Safari에서 onend가 안 오는 경우가 있다).
- `reactions`는 같은 비트 안에서 동시에 재생한다.
- 소리를 꺼도 자막만으로 이해되어야 한다. 음소거 토글을 둔다.
- 끝나면 "↺ Replay"와 "Try the signals ↓" 안내를 띄운다.
- 칩이 바뀌면 `focusBeat - 1`부터 다시 재생한다.

**A의 완료 기준:** 픽스처 JSON 하나로 첫 클릭부터 끝까지 재생되고, 펀치라인이 8초 안에 나오고, 모든 action이 눈에 띄게 다르다.

## B 상세: 엔진·페르소나

**샘플 대화:** 팀 단톡에서 실제로 있었던 장면을 영어로 옮겨 8~12줄로 만든다. 4명, 첫 3줄 안에 읽씹이 나와야 한다(펀치라인 8초 목표).

**규칙 엔진 (`buildScene`):**

| 입력 | 비트 |
|---|---|
| 일반 메시지 | `talk` + line |
| 같은 사람 3개 이상 연속 | 두 번째부터 `step_closer_fast` |
| 대문자 위주 또는 `!!!` | `shout_shake` |
| `system: 'read'` 뒤에 그 사람 메시지 없음 | `stare_turn_away`, caption `Read HH:mm`, 나머지는 `freeze` 반응 |
| 이전 메시지와 1시간 이상 간격 | 그 사람 `run_in_sweating` 후 `talk` |
| `system: 'left'` | `door_slam_exit`, 나머지 `freeze` |
| `system: 'unsent'` | `cover_mouth` |
| `system: 'typing'` (칩 전용) | `mouth_open_close` |
| `system: 'reaction'` | `heart_hands` / `laugh_fall` |

각 `SignalToggle`은 샘플 대화의 **고정된 한 지점**을 켜고 끈다. 예: `late_reply`를 켜면 Leo의 답장 `at`이 3시간 뒤로 밀린다. 바뀐 지점의 인덱스를 `focusBeat`에 넣는다.

**페르소나:**
- 이미지 생성 API는 팀이 키를 가진 쪽(OpenAI 또는 Google 이미지 모델)을 쓴다. 스타일 프롬프트는 하나로 고정한다: sticker-style cartoon head, front-facing, plain white background, same style for everyone.
- 13:00까지 팀 셀카로 프롬프트를 튜닝하고, 팀 페르소나 4개와 프리셋 6개를 미리 생성해서 `public/personas/`에 커밋한다. 첫 화면은 API를 0번 부른다.
- `CastYourself`: [Use camera] [Upload photo] + 동의 문구("Your photo is only used to draw your cartoon. We don't store it.") → "Drawing you…" (재치 있는 문구 순환) → 성공하면 `onPersona(url)`.
- **25초 타임아웃(AbortController), 오류, 카메라 거부** 중 하나라도 생기면 프리셋 6개 그리드를 보여준다("Our artist is busy — pick a stand-in"). 막다른 길은 없다.
- 서버 IP당 분당 5회 rate limit(메모리면 충분).

**B의 완료 기준:** 칩 5개 조합 전부에서 `buildScene`이 오류 없이 다른 장면을 내고, 셀카 성공·실패 경로가 둘 다 25초 안에 끝난다.

## 타임라인과 동기화 지점 (KST)

| 시간 | A (방) | B (엔진·페르소나) |
|---|---|---|
| 11:55–12:10 | Next.js 스캐폴드 → push | `types.ts` + 스텁 `buildScene` + `fixtures/sample-scene.json` → push, 샘플 대화 작성 |
| **12:10 SYNC 1** | 서로 pull. A는 픽스처로 무대 시작 | Vercel 연결, 환경변수, 첫 배포 확인 |
| 12:10–13:30 | 무대, 캐릭터, 핵심 action 6개(`talk`, `stare_turn_away`, `run_in_sweating`, `door_slam_exit`, `cover_mouth`, `freeze`), 플레이어, Play 랜딩 | 진짜 `buildScene`, 페르소나 프롬프트 튜닝, 팀 페르소나 + 프리셋 생성 → 커밋 |
| **13:30 SYNC 2** | 진짜 `buildScene` + 진짜 페르소나로 통합 재생 확인 | 같이 확인 |
| 13:30–14:15 | 신호 칩 UI, 나머지 action, 모바일 레이아웃 | `CastYourself` + 대비책, (여유 있으면) `/api/direct` |
| **14:15 SYNC 3** | 팀 밖 1명에게 설명 없이 링크만 주고 말없이 지켜보기 | 같이 지켜보고 막힌 곳 메모 |
| 14:15–14:45 | iPhone Safari·시크릿 Chrome 수정, 첫 10초 다듬기, PDF용 스크린샷 3장 | 고의 장애 테스트(API 키 빼고도 첫 장면·칩이 도는지), PDF 초안 |
| 14:45–15:15 | **main 동결.** 체크리스트 같이 확인 | PDF 확정 |
| 15:15–15:45 | **제출** | |

늦어지면 자르는 순서: `/api/direct` → 리액션·연속 메시지 규칙 → 셀카 생성(최후에는 프리셋만). **첫 10초와 신호 칩은 끝까지 자르지 않는다.**

## Git 규칙

- 2명이라 `main`에 직접 push해도 된다. 폴더 소유권으로 충돌을 피한다. push 전에는 항상 `git pull --rebase`.
- 공동 파일(`types.ts`, `package.json`)은 바꾸기 전에 말로 알린다.
- Vercel: `main` = 제출 URL. **14:45 이후 main 동결.** 그 뒤 수정은 둘이 합의하고 체크리스트를 다시 돈다.
- `.env.local`은 절대 커밋하지 않는다. 키는 Vercel 환경변수와 각자 `.env.local`에만 둔다.

```bash
# .env.local (커밋 금지)
OPENAI_API_KEY=        # 또는 GEMINI_API_KEY — /api/persona
ANTHROPIC_API_KEY=     # /api/direct (시간 남으면)
```

### 스캐폴드 (A, 11:55)

```bash
npx create-next-app@latest . --ts --app --src-dir --tailwind --eslint --import-alias "@/*"
```

폴더에 파일이 있다고 거부하면 임시 폴더에 만들고 옮긴다:

```bash
npx create-next-app@latest app-tmp --ts --app --src-dir --tailwind --eslint --import-alias "@/*"
rsync -a app-tmp/ ./ && rm -rf app-tmp
```

## 제출 게이트 체크리스트 (기회는 한 번)

- [ ] 새 시크릿 Chrome과 iPhone Safari에서 3초 안에 열린다
- [ ] 첫 클릭에 소리와 함께 재생되고, 소리를 꺼도 자막으로 이해된다
- [ ] 펀치라인이 10초 안에 나온다
- [ ] 신호 칩 5개가 모두 장면을 눈에 띄게 바꾼다
- [ ] 셀카 성공 경로 25초 이내. 실패·타임아웃·카메라 거부 시 프리셋으로 넘어간다
- [ ] 이미지 API·Claude API가 죽어도 첫 장면과 칩은 돌아간다(직접 키를 빼고 확인)
- [ ] 콘솔 오류 없음, 클라이언트 번들에 API 키 없음
- [ ] 팀 밖 사람이 설명 없이 30초 안에 이해하고 웃었다
- [ ] 앱 하단에 팀 이름 + PDF와 같은 한 줄 소개

## PDF 2장 (B, 14:15–14:45 초안)

- **1페이지:** 한 줄 훅 / 인사이트(채팅은 관계의 신호를 숨긴다 → 우리는 그걸 보이게 한다) / 장면 스크린샷 3컷(A 제공) / "30초 체험법" 3단계 + 링크·QR
- **2페이지:** Why now(Gen Z는 이미 단톡을 스크린샷으로 콘텐츠화한다, 페르소나 생성이 싸졌다) / Sora cameo·Bitmoji·Apple Persona 대비 차별점(프롬프트 없음, 내 진짜 대화, 메타신호) / 로드맵(스크린샷 가져오기, Snap·TikTok용 에피소드 내보내기, 본인 동의 기반 캐스팅, 주간 하이라이트) / 팀
