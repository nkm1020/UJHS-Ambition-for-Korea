# A — 방(원탁) 체크리스트

> 스펙: [`docs/WORK-SPLIT.md`](../WORK-SPLIT.md) "A 상세". 위에서부터 순서대로. 막히면 바로 B에게 말하기.

> **⚠ 바뀐 것 (12:45):** 아바타가 **2D SVG + CSS 몸통 → 3D(react-three-fiber)** 로 바뀌었다.
> 스캐폴드와 캐릭터는 B가 `1ca0a14`로 **이미 push했다. 스캐폴드를 또 만들지 말고 pull부터 해라.**
> 네가 쓸 것은 `<Avatar config pose face seed talking />` 하나뿐이고, CSS keyframes는 짤 필요가 없다.
> 자세·몸짓은 `types.ts`의 `ACTION_POSES[action]`이 `{pose, face, ms, emoji}` 단계로 풀어 준다.

## 12:15–12:30 스캐폴드
- [x] ~~`create-next-app`~~ — B가 완료 (`1ca0a14`). **`git pull` 하고 `npm install`만 하면 된다**
- [ ] `npm run dev` → `/avatar` 에서 캐릭터가 뜨고 pose·face 칩이 눌리는지 확인 (이 임시 화면이 곧 네 참고서다) — **부분 (14:24):** 캐릭터·칩은 뜸. 칩은 눌러 보지 않았고, 데스크톱에서 캔버스 높이가 ~150px로 눌림(B 페이지). `/preview`는 정상
- [x] `src/lib/types.ts`, `src/lib/avatar.ts`, `src/components/avatar/*` 훑어보기

## 12:30–13:30 원탁 (SYNC 1 이후)
- [x] `src/app/page.tsx`: 마이룸 ↔ 방 전환 (`openRoomId` 상태, `<MeProvider>`로 감싸기) — `page.tsx`가 `components/App.tsx`를 띄우고, 상태와 `MeProvider`는 App에 있음
- [x] `RoomView`: 상단(← 뒤로, 방 이름, "N watching"), 원탁, 하단(자막, 🎤, 텍스트 입력 자리) — 자막은 원탁 위쪽 칩
- [ ] `Table` + `Seat`: `<AvatarStage camera={[0, 2.2, 3.4]} fov={34}>` 안에 원탁 실린더 1개 + `<Avatar>` 5개. 먼 쪽 호 좌표 계산식은 WORK-SPLIT "A 상세"에 그대로 있다. 내 자리는 발밑 민트 링 — **부분 (설계 변경):** 1인칭이라 자체 Canvas, 내 아바타·민트 링 없음(카메라가 내 머리). 테이블 치수는 AVATAR-SLOT 규칙대로(`TABLE_TOP_Y`, `TABLE_R = SEAT_R - 0.25`, 의자 0.34)
- [x] `seed={member.seat}` 를 꼭 넘길 것 — 안 넘기면 5명이 똑같이 숨 쉬어서 인형처럼 보인다 — `seed={member.seat + 1}`
- [ ] 자세 3개: `watching` → `pose="sit"` / `away` → `pose="slump"` (+💤) / `gone` → 렌더 안 함 (`PRESENCE_POSE` 참고) — **부분:** sit·slump·gone 확인. 3D에 💤 없음
- [x] 재생기(`src/lib/player/`): 비트 순서대로, `reactions` 동시 재생, `away`가 `talk` 받으면 `sit_up` 자동 삽입
- [x] 몸짓: `ACTION_POSES`의 단계를 순서대로 `<Avatar pose face>`에 넘기기. 보간은 `Avatar`가 한다. 이모지(👀 💦)는 drei `<Html>`로 머리 위에
- [x] 자막(`caption`) 표시
- [x] 이 시점엔 오디오 없이 말풍선만으로 첫 방이 끝까지 돌아가야 함 — 녹음 파일 404 → 말풍선으로 끝까지, "Your turn" 안내까지 확인

## 13:30 SYNC 2
- [ ] 마이룸 → 방 이동, 내가 꾸민 캐릭터가 내 자리에 나오는지 — **부분 (설계 변경):** 1인칭이라 방에서는 내 캐릭터가 안 보임. 마이룸·꾸미기에는 반영
- [ ] B가 커밋한 녹음 파일로 `talk` 오디오 재생 (`ended` + 상한 타이머 길이+1000ms, 모르면 8초) — **부분:** 코드 완료. `public/audio/friday/*.mp3`가 아직 없어 404
- [x] 방 입장 클릭 핸들러 안에서 AudioContext 생성/resume (iOS) — `App.open`에서 `unlockAudio()`. iOS 실기기는 미확인
- [x] 오디오 로드 실패 시 말풍선만 `max(1500, 글자수×60)ms`

## 13:30–14:15 내 메시지 + 나머지
- [ ] `src/lib/recorder.ts`: 🎤 첫 탭에 권한 요청, mimeType 기능 감지, 최대 15초, blob URL — **부분:** 코드 완료. 실제 녹음은 권한 창 때문에 자동 확인 못 함
- [ ] 🎤 녹음 중 `startSTT()`(null 아니면) 같이 시작 → 정지 시 텍스트 받기 — **부분:** 코드 완료(데스크톱만, 휴대폰은 의도적으로 끔). 미확인
- [ ] 보내면 `me`가 내 목소리로 `talk` → `onUserMessage[min(n, 길이-1)]` 재생 — **부분:** 반응 순서는 텍스트로 확인. 음성 메시지 경로는 미확인
- [x] 텍스트 입력도 같은 흐름 (말풍선만)
- [ ] 마이크 없음/거부 → 🎤 숨기고 "No mic? Type instead." + 텍스트만 — **부분:** 코드 완료, 화면 미확인
- [x] 입 움직임: `talking` prop만 켜면 입이 벌렁거린다. 여유 있으면 AnalyserNode 볼륨으로 교체 — AnalyserNode 볼륨 → `talkLevel`
- [ ] 나머지 몸짓: `cover_mouth`, `typing_stop`, `heart`, `laugh`, `freeze` (전부 `ACTION_POSES`에 이미 있다) — **부분:** heart·freeze 화면 확인. 나머지는 대본에 있지만 화면 미확인
- [ ] 음소거 토글 — **부분:** 버튼 있음. 녹음 파일이 없어 소리 차단은 확인 못 함

## 14:15 SYNC 3
- [ ] 팀 밖 1명에게 링크만 주고 말없이 지켜보기, 막힌 곳 메모

## 14:15–14:45 기기 QA
- [ ] 시크릿 Chrome / iPhone Safari(한국어 설정) / Android Chrome / 카카오톡 인앱 브라우저 — **안 됨:** 데스크톱 Chrome(GPU)과 헤드리스(WebGL 없음 → 2D 대체)만 확인
- [ ] 모바일 세로 화면에서 원탁·입력창 겹침 없음 (세로면 `fov`를 키우거나 카메라를 뒤로) — **부분:** 430px 프레임에선 겹침 없음. 실기기 미확인
- [ ] 저사양 기기 프레임 — 느리면 `AvatarStage`의 `shadows` 끄고 `dpr={[1, 1.5]}`
- [ ] 콘솔 오류 0 — **깨짐:** 방에서 나갈 때 `removeChild` NotFoundError(프로덕션에서도, 앱은 계속 동작). 개발 모드에선 입장 시 unmount 경고(StrictMode 전용)
- [ ] PDF용 스크린샷 3장(마이룸, 원탁, 읽씹 순간) → B에게

## 14:45 동결 → 15:15–15:45 제출
- [ ] `WORK-SPLIT.md` 제출 게이트 표를 B와 같이 한 줄씩 확인
