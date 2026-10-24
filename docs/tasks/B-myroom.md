# B — 마이룸·바텀시트·대본 체크리스트

> 스펙: [`docs/WORK-SPLIT.md`](../WORK-SPLIT.md) "B 상세". 위에서부터 순서대로. 막히면 바로 A에게 말하기.

## 12:15–12:30 계약 + 배포 (A가 기다리는 것부터)
- [ ] `src/lib/types.ts` — WORK-SPLIT의 계약 그대로 → push
- [ ] 아바타 라이브러리 결정(예: DiceBear SVG 스타일 하나) + **라이선스 확인**
- [ ] `src/lib/avatar.ts`: `AVATAR_OPTIONS`, `randomAvatar()`, `avatarFaceUrl(cfg)` → push
- [ ] `src/data/rooms.ts`: 첫 방 "Friday plans 🍕" 대본(텍스트만, 오디오 경로는 미리 적어두기) → push
- [ ] A의 스캐폴드 pull 후 Vercel 프로젝트 연결, 첫 배포 URL 확인 → A에게 공유

## 12:30–13:30 마이룸 + 바텀시트
- [ ] `src/lib/me.tsx`: `MeProvider`, `useMe()`, localStorage 저장, 첫 방문은 `randomAvatar()`
- [ ] `MyRoom`: 방 배경 + 서 있는 내 캐릭터(숨쉬기)
- [ ] `Customizer`: 피부색, 머리 모양, 머리 색, 눈, 옷 색 → 즉시 반영
- [ ] `BottomSheet`: 접힘 → 반 → 전체 (snap points, 예: `vaul`)
- [ ] `RoomCard`: 이모지 + 이름, 미니 원탁(앉음/엎드림), 미리보기, 안 읽은 수
- [ ] 첫 방에만 "Open a chat 👆" 힌트, 카드 탭 → `onOpen(room.id)`

## 13:00–13:30 녹음 (A도 10분 참여)
- [ ] 첫 방 대본을 팀 실제 대화로 다듬기(비트 6~8개, 펀치라인은 `walk_in` 다음 2~3번째)
- [ ] 폰 음성 메모로 한 줄당 파일 하나, 과장해서 연기
- [ ] 앞뒤 무음 자르기 → `public/audio/friday/<nn>-<name>.mp3`(또는 `.m4a`) 커밋
- [ ] `onUserMessage` 반응 대사도 녹음

## 13:30 SYNC 2
- [ ] 마이룸에서 꾸민 캐릭터가 방에 그대로 나오는지 A와 확인

## 13:30–14:00 STT + 방 2
- [ ] `src/lib/stt.ts`: `startSTT()` — `SpeechRecognition`/`webkitSpeechRecognition`, 언어 `navigator.language`, 미지원이면 `null`
- [ ] Chrome / iPhone Safari / Android Chrome에서 녹음과 동시에 돌려보기 → 녹음이 무음이 되는 기기는 `null` 반환
- [ ] 방 2 "Family 👨‍👩‍👧" 대본 + 녹음 (시간 되는 만큼)

## 14:00 체크포인트
- [ ] 배포 URL에서 마이룸 + 첫 방 + 내 음성 메시지가 iPhone까지 전부 됨?
  - 예 → 실시간 `/live/[code]` 시작 (presence로 앉음/엎드림 + 텍스트 broadcast, 음성은 여유 있을 때만)
  - 아니오 → A와 QA 합류

## 14:15 SYNC 3
- [ ] 팀 밖 1명 무설명 테스트 같이 지켜보기, 그 사람이 한 말 그대로 메모

## 14:15–14:45
- [ ] 실시간이 14:30까지 두 기기에서 안정적이지 않으면 "Invite a friend (beta)" 링크 숨김
- [ ] 장애 테스트: 마이크 거부, 오디오 파일 실패, 오프라인
- [ ] PDF 2장 초안 (WORK-SPLIT 하단 개요, A의 스크린샷 3장)

## 14:45 동결 → 15:15–15:45 제출
- [ ] 제출 게이트 표를 A와 같이 한 줄씩 확인
- [ ] PDF 확정 → **제출**
- [ ] 제출 직후 Vercel에서 제출한 배포를 Production으로 고정 + 자동 배포 끄기
