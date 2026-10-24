# 아바타 슬롯 연결 가이드 (three.js 담당용)

UI·재생 로직은 다 되어 있고, 아바타 자리에는 지금 2D 임시 아바타가 들어가 있다. three.js 아바타는 **같은 props를 받는 컴포넌트 두 개**만 만들면 된다. UI 코드는 건드릴 필요가 없다.

## 바꿔 끼우는 곳: `src/components/avatar/index.ts`

```ts
export { AvatarStage2D as AvatarStage } from "./AvatarStage2D"; // 원탁 장면 (방 화면)
export { AvatarStand2D as AvatarStand } from "./AvatarStand2D"; // 서 있는 내 캐릭터 (마이룸)
```

3D가 준비되면 이렇게 바꾼다. WebGL이 없는 기기(일부 인앱 브라우저 등)에서는 2D가 그대로 대비책이 된다.

```tsx
"use client";
import dynamic from "next/dynamic";
import type { AvatarStageProps, AvatarStandProps } from "@/lib/types";
import { AvatarStage2D } from "./AvatarStage2D";
import { AvatarStand2D } from "./AvatarStand2D";

const Stage3D = dynamic(() => import("./three/AvatarStage3D"), { ssr: false });
const Stand3D = dynamic(() => import("./three/AvatarStand3D"), { ssr: false });

function hasWebGL() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export function AvatarStage(props: AvatarStageProps) {
  return hasWebGL() ? <Stage3D {...props} /> : <AvatarStage2D {...props} />;
}
export function AvatarStand(props: AvatarStandProps) {
  return hasWebGL() ? <Stand3D {...props} /> : <AvatarStand2D {...props} />;
}
```

## props 계약 (`src/lib/types.ts`)

### `AvatarStandProps` — 마이룸

| prop | 뜻 |
|---|---|
| `avatar: AvatarConfig` | 꾸미기 값. 바뀌면 즉시 반영 |

### `AvatarStageProps` — 원탁

| prop | 뜻 |
|---|---|
| `members: StageMember[]` | 자리별 캐릭터와 지금 상태. 재생기가 바꿔서 내려준다 |
| `getTalkLevel(id) → 0..1` | 입 벌림 정도. **매 프레임 호출**해도 싸다(`useFrame` 안에서) |
| `onAnchors?(anchors)` | 말풍선 위치 보고(선택). 아래 참고 |

`StageMember`:

| 필드 | 뜻 |
|---|---|
| `seat: 0..4` | 테이블 먼 쪽 호, 왼쪽부터. 내 자리(`isMe`)는 보통 2 |
| `presence` | 쉬는 자세. `watching` = 앉아 있음, `away` = 테이블에 엎드림, `gone` = 빈 의자(캐릭터 숨김) |
| `action` | 지금 재생할 1회성 동작. `null`이면 `presence` 자세로 쉰다 |
| `actionKey` | 동작이 새로 시작될 때마다 바뀐다. 같은 이름의 동작이 연속으로 와도 **이 값이 바뀌면 처음부터 다시** 재생 |
| `lookAt: seat \| null` | 고개를 돌려 볼 자리. `null`이면 정면 |
| `avatar` | 그 캐릭터의 꾸미기 값 (내 자리는 내 아바타) |

### 동작별 연출과 재생기가 기다리는 시간

재생기는 아래 시간만큼 기다린 뒤 다음 비트로 넘어간다. 3D 애니메이션도 이 길이에 맞춘다.

| action | 연출 | ms |
|---|---|---|
| `walk_in` | 화면 옆에서 걸어 들어와 빈자리에 앉음 | 2000 |
| `sit_up` | 엎드림 → 앉음 | 500 |
| `slump` | 앉음 → 엎드림 | 500 |
| `talk` | 입 움직임(`getTalkLevel`) + 살짝 들썩 | 음성 길이 |
| `read_ignore` | 엎드림 → 고개 들어 `lookAt` 쪽을 봄(👀) → 다시 엎드림 | 1800 |
| `startle_up` | 💦 화들짝 일어나 앉음 | 1200 |
| `stand_leave` | 일어나 의자 밀고 화면 밖으로 퇴장 | 1800 |
| `cover_mouth` | 말하다 손으로 입 막음 | 1300 |
| `typing_stop` | 고개 들었다(…) 다시 엎드림 | 1600 |
| `heart` / `laugh` | 🫶 / 😂, 뒤로 젖혀짐 | 900 / 1200 |
| `freeze` | 그 자리에서 멈춤(흑백 느낌) | 다음 비트까지 |

자세 전환 시점: `walk_in`·`sit_up`·`startle_up`·`talk`·`cover_mouth`는 시작할 때 `watching`, `slump`는 시작할 때 `away`, `read_ignore`·`typing_stop`은 끝날 때 `away`, `stand_leave`는 끝날 때 `gone`으로 바뀐다.

### 말풍선 위치 (`onAnchors`)

말풍선과 자막은 3D 위에 일반 HTML로 띄운다. 두 방법 중 하나를 고른다.

1. **보고하기(권장):** 각 캐릭터 머리 위 지점을 화면 좌표로 투영해서 `{ [memberId]: { x, y } }`로 보낸다. 좌표는 스테이지 박스 기준 px이다. 리사이즈나 카메라가 바뀔 때만 보내고, 매 프레임 보내지 않는다.
2. **보고 안 하기:** `src/components/avatar/seatLayout.ts`의 `SEAT_LAYOUT` 위치에 머리가 오도록 카메라를 고정한다.

## 꾸미기 옵션

`src/lib/avatar.ts`의 `AVATAR_OPTIONS`가 마이룸 꾸미기 패널(`src/components/myroom/Customizer.tsx`)을 그린다. 색 목록에 값만 추가하면 UI는 자동으로 따라온다. 키를 추가하려면 `src/lib/types.ts`의 `AvatarConfig`와 `Customizer.tsx`의 `GROUPS`에도 추가한다(공동 파일이니 말하고 바꾸기).

## 지켜야 할 것 (VC가 혼자 한 번만 써본다)

- **용량:** 전체 3D 에셋 3~5MB 이하. 기본 모델 하나를 받아 `SkeletonUtils.clone`으로 복제하고, 색·머리만 바꾼다. Draco/meshopt 압축.
- **성능:** `dpr={[1, 1.5]}`, 실시간 그림자 없음, 카메라 고정(돌리기 금지).
- **Canvas는 한 번에 하나:** 마이룸과 방은 동시에 뜨지 않으니 화면마다 Canvas 하나씩이면 된다.
- **빈 화면 금지:** 모델을 받는 동안에는 2D를 보여주거나 마이룸 UI를 먼저 띄운다.
- **SSR 제외:** three.js 코드는 반드시 `dynamic(..., { ssr: false })`로 불러온다.

## 확인 방법

```bash
npm install
npm run dev
```

`http://localhost:3000` → 마이룸에서 꾸미기 → 바텀시트에서 "Friday plans" → 원탁. 첫 방 대본은 `src/data/rooms.ts`에 있다.

## 진짜 아바타 연결 (완료: `StickFigure` → `Avatar`)

마이룸·꾸미기(`HomeStage3D`)와 원탁(`RoomStage3D`)은 이제 `<Avatar>`(`src/components/avatar/Avatar.tsx`)를 그린다. `StickFigure.tsx`와 `src/lib/motion/engine.ts`는 더 이상 쓰이지 않는다.

```tsx
// 원탁
<Avatar config={member.avatar} pose={pose} face={face} seed={member.seat + 1} talkLevel={talkLevel} lookYaw={lookYaw} />
// 마이룸
<Avatar config={avatar} pose="idle" face="happy" seed={7} />
```

- `face`는 `ACTION_POSES` 단계의 face. 동작이 없으면 away는 `"blank"`, 나머지는 `"neutral"`.
- `talkLevel`은 매 프레임 읽는 0..1. `lookYaw`는 엔진의 headYaw와 같은 규칙(+ = 캐릭터의 왼쪽)이고, 머리와 몸통이 한 덩어리라 상체째 돈다.
- **관절 각도는 motion engine이 아니라 `Avatar` 안의 포즈표를 쓴다.** 엔진 각도는 막대 인형 기준이라 콩 모양 몸에 넣으면 팔이 몸을 뚫는다. 포즈 이름(`PoseName`)만 넘긴다.

**원탁 치수를 바꿀 때 지킬 것.** 앉은 포즈의 팔뚝은 정확히 이 높이·거리에 눕도록 역산돼 있다.

| | 값 | 코드 |
|---|---|---|
| 테이블 윗면 | 0.62 | `TABLE_TOP_Y` (`shape.ts`) → `TABLE_Y = TABLE_TOP_Y - 0.03` |
| 테이블 가장자리 ↔ 아바타 중심 | 0.25 | `TABLE_R = SEAT_R - 0.25` (`SEAT_R` 1.72는 그대로 → 카메라 구도 유지) |
| 의자 윗면 / 등받이 | 0.34 / 아바타 뒤 0.5, 높이 0.86까지 | 뒤로 젖혀 웃어도(`laugh`) 등받이를 뚫지 않는 위치 |
| 앉은 머리 꼭대기 | 1.46 | 말풍선 `Html` y=1.72는 그대로 |

- 모든 포즈·표정은 `/preview`에서 확인할 수 있다.
