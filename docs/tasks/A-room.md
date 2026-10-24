# A — 방(원탁) 체크리스트

> 스펙: [`docs/WORK-SPLIT.md`](../WORK-SPLIT.md) "A 상세". 위에서부터 순서대로. 막히면 바로 B에게 말하기.

> **⚠ 바뀐 것 (12:45):** 아바타가 **2D SVG + CSS 몸통 → 3D(react-three-fiber)** 로 바뀌었다.
> 스캐폴드와 캐릭터는 B가 `1ca0a14`로 **이미 push했다. 스캐폴드를 또 만들지 말고 pull부터 해라.**
> 네가 쓸 것은 `<Avatar config pose face seed talking />` 하나뿐이고, CSS keyframes는 짤 필요가 없다.
> 자세·몸짓은 `types.ts`의 `ACTION_POSES[action]`이 `{pose, face, ms, emoji}` 단계로 풀어 준다.

## 12:15–12:30 스캐폴드
- [x] ~~`create-next-app`~~ — B가 완료 (`1ca0a14`). **`git pull` 하고 `npm install`만 하면 된다**
- [ ] `npm run dev` → `/` 에서 캐릭터가 뜨고 pose·face 칩이 눌리는지 확인 (이 임시 화면이 곧 네 참고서다)
- [ ] `src/lib/types.ts`, `src/lib/avatar.ts`, `src/components/avatar/*` 훑어보기

## 12:30–13:30 원탁 (SYNC 1 이후)
- [ ] `src/app/page.tsx`: 마이룸 ↔ 방 전환 (`openRoomId` 상태, `<MeProvider>`로 감싸기)
- [ ] `RoomView`: 상단(← 뒤로, 방 이름, "N watching"), 원탁, 하단(자막, 🎤, 텍스트 입력 자리)
- [ ] `Table` + `Seat`: `<AvatarStage camera={[0, 2.2, 3.4]} fov={34}>` 안에 원탁 실린더 1개 + `<Avatar>` 5개. 먼 쪽 호 좌표 계산식은 WORK-SPLIT "A 상세"에 그대로 있다. 내 자리는 발밑 민트 링
- [ ] `seed={member.seat}` 를 꼭 넘길 것 — 안 넘기면 5명이 똑같이 숨 쉬어서 인형처럼 보인다
- [ ] 자세 3개: `watching` → `pose="sit"` / `away` → `pose="slump"` (+💤) / `gone` → 렌더 안 함 (`PRESENCE_POSE` 참고)
- [ ] 재생기(`src/lib/player/`): 비트 순서대로, `reactions` 동시 재생, `away`가 `talk` 받으면 `sit_up` 자동 삽입
- [ ] 몸짓: `ACTION_POSES`의 단계를 순서대로 `<Avatar pose face>`에 넘기기. 보간은 `Avatar`가 한다. 이모지(👀 💦)는 drei `<Html>`로 머리 위에
- [ ] 자막(`caption`) 표시
- [ ] 이 시점엔 오디오 없이 말풍선만으로 첫 방이 끝까지 돌아가야 함

## 13:30 SYNC 2
- [ ] 마이룸 → 방 이동, 내가 꾸민 캐릭터가 내 자리에 나오는지
- [ ] B가 커밋한 녹음 파일로 `talk` 오디오 재생 (`ended` + 상한 타이머 길이+1000ms, 모르면 8초)
- [ ] 방 입장 클릭 핸들러 안에서 AudioContext 생성/resume (iOS)
- [ ] 오디오 로드 실패 시 말풍선만 `max(1500, 글자수×60)ms`

## 13:30–14:15 내 메시지 + 나머지
- [ ] `src/lib/recorder.ts`: 🎤 첫 탭에 권한 요청, mimeType 기능 감지, 최대 15초, blob URL
- [ ] 🎤 녹음 중 `startSTT()`(null 아니면) 같이 시작 → 정지 시 텍스트 받기
- [ ] 보내면 `me`가 내 목소리로 `talk` → `onUserMessage[min(n, 길이-1)]` 재생
- [ ] 텍스트 입력도 같은 흐름 (말풍선만)
- [ ] 마이크 없음/거부 → 🎤 숨기고 "No mic? Type instead." + 텍스트만
- [ ] 입 움직임: `talking` prop만 켜면 입이 벌렁거린다. 여유 있으면 AnalyserNode 볼륨으로 교체
- [ ] 나머지 몸짓: `cover_mouth`, `typing_stop`, `heart`, `laugh`, `freeze` (전부 `ACTION_POSES`에 이미 있다)
- [ ] 음소거 토글

## 14:15 SYNC 3
- [ ] 팀 밖 1명에게 링크만 주고 말없이 지켜보기, 막힌 곳 메모

## 14:15–14:45 기기 QA
- [ ] 시크릿 Chrome / iPhone Safari(한국어 설정) / Android Chrome / 카카오톡 인앱 브라우저
- [ ] 모바일 세로 화면에서 원탁·입력창 겹침 없음 (세로면 `fov`를 키우거나 카메라를 뒤로)
- [ ] 저사양 기기 프레임 — 느리면 `AvatarStage`의 `shadows` 끄고 `dpr={[1, 1.5]}`
- [ ] 콘솔 오류 0
- [ ] PDF용 스크린샷 3장(마이룸, 원탁, 읽씹 순간) → B에게

## 14:45 동결 → 15:15–15:45 제출
- [ ] `WORK-SPLIT.md` 제출 게이트 표를 B와 같이 한 줄씩 확인
