# 제출용 PDF 2장

- 원본: `pitch.html` (A4 2장, 인쇄용 CSS)
- 결과물: `Scene-pitch-draft.pdf`

## 완성하려면

1. **스크린샷 3장**을 3D 최종 화면으로 찍어 `shots/`에 넣는다. 파일이 있으면 자리표시가 자동으로 덮인다.
   - `shots/01-myroom.png` — 마이룸(캐릭터 꾸미기)
   - `shots/02-rooms.png` — 바텀시트를 끌어올린 채팅방 목록
   - `shots/03-table.png` — 원탁에서 읽씹하는 순간(👀 + "Read 9:41 PM")
   - 휴대폰 세로 화면(예: 390×844)으로 찍으면 틀에 맞는다.
2. `pitch.html`에서 노란 표시(`class="todo"`)를 채운다: 팀 이름, 이름 2개, 이메일, 데모 링크, QR.
3. 2쪽 "오늘 데모:" 줄과 1쪽 "90초 체험법"이 최종 데모와 일치하는지 확인한다(데모에 없는 기능은 지우기). 확인 후 노란 "최종 데모와 대조" 표시를 지운다.
   - 2쪽 숫자의 출처와 원문 링크: [`docs/research/global-market-stats.md`](../research/global-market-stats.md)
4. 다시 뽑는다:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "file://$PWD/docs/pitch/pitch.html"
$B pdf "$PWD/docs/pitch/Scene-pitch.pdf" --format a4 --print-background --prefer-css-page-size --margins 0
```

한글 폰트는 로컬의 Noto Sans KR(`~/Library/Fonts`)을 쓴다. 다른 컴퓨터에서 뽑으면 Apple SD Gothic Neo로 대체된다.
