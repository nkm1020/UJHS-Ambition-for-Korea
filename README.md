# Scene — group chats you can see

Your group chat as a round table. Whoever is watching sits up; whoever isn't is face-down on the table. Messages are spoken in real voices, with bubbles.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 (best at phone width).

## Where things are

| Path | What |
|---|---|
| `src/components/myroom/` | My Room + customizer |
| `src/components/sheet/` | Apple Maps-style bottom sheet, room cards |
| `src/components/room/` | Round-table room, bubbles, mic/text composer |
| `src/components/avatar/` | Avatar slot (2D placeholder now, three.js later) |
| `src/lib/player/` | Beat player, Web Audio playback, talk level |
| `src/data/rooms.ts` | Demo room scripts |

## Docs

- [`docs/AVATAR-SLOT.md`](docs/AVATAR-SLOT.md) — how the three.js avatar plugs in
- [`docs/WORK-SPLIT.md`](docs/WORK-SPLIT.md) — who does what, timeline, submission gate
- [`docs/designs/group-chat-scene.md`](docs/designs/group-chat-scene.md) — design and reasoning
