# A — 방(원탁) 체크리스트

> 스펙: [`docs/WORK-SPLIT.md`](../WORK-SPLIT.md) "A 상세". 위에서부터 순서대로. 막히면 바로 B에게 말하기.

## 12:15–12:30 스캐폴드
- [ ] `npx create-next-app@latest . --ts --app --src-dir --tailwind --eslint --import-alias "@/*"` (거부하면 `app-tmp`에 만들고 `rsync`)
- [ ] `npm run dev`로 뜨는지 확인 → push
- [ ] B의 `src/lib/types.ts`, `src/lib/avatar.ts`, `src/data/rooms.ts` pull

## 12:30–13:30 원탁 (SYNC 1 이후)
- [ ] `src/app/page.tsx`: 마이룸 ↔ 방 전환 (`openRoomId` 상태, `<MeProvider>`로 감싸기)
- [ ] `RoomView`: 상단(← 뒤로, 방 이름, "N watching"), 원탁, 하단(자막, 🎤, 텍스트 입력 자리)
- [ ] `Table` + `Seat`: 타원 원탁, 먼 쪽 호에 5자리, 얼굴은 `avatarFaceUrl(member.avatar)`, 몸통은 CSS, 내 자리 민트 테두리
- [ ] 자세 3개: `watching`(앉음) / `away`(엎드림, 흐리게, 💤) / `gone`(빈 의자)
- [ ] 재생기(`src/lib/player/`): 비트 순서대로, `reactions` 동시 재생, `away`가 `talk` 받으면 `sit_up` 자동 삽입
- [ ] 몸짓: `walk_in`, `sit_up`, `slump`, `talk`(말풍선), `read_ignore`, `startle_up`, `stand_leave`
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
- [ ] 입 움직임: Web Audio AnalyserNode 볼륨 (안 되면 통통)
- [ ] 나머지 몸짓: `cover_mouth`, `typing_stop`, `heart`, `laugh`, `freeze`
- [ ] 음소거 토글

## 14:15 SYNC 3
- [ ] 팀 밖 1명에게 링크만 주고 말없이 지켜보기, 막힌 곳 메모

## 14:15–14:45 기기 QA
- [ ] 시크릿 Chrome / iPhone Safari(한국어 설정) / Android Chrome / 카카오톡 인앱 브라우저
- [ ] 모바일 세로 화면에서 원탁·입력창 겹침 없음
- [ ] 콘솔 오류 0
- [ ] PDF용 스크린샷 3장(마이룸, 원탁, 읽씹 순간) → B에게

## 14:45 동결 → 15:15–15:45 제출
- [ ] `WORK-SPLIT.md` 제출 게이트 표를 B와 같이 한 줄씩 확인
