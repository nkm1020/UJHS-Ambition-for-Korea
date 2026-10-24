# Scene — group chats you can see

Your group chat as a round table. Whoever is watching sits up; whoever isn't is face-down on the table. Messages are spoken in real voices, with bubbles.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 (best at phone width).

The AI summary in "Friday plans" and the AI friend Ari call Claude Sonnet from the server. Put the key in `.env` (gitignored), and in the Vercel project's environment variables for the deployed demo:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

`.env.local` is committed and only lists the variable names, commented out. Keep it that way: Next.js reads it before `.env`, so anything set there hides the value in `.env`.

Without a key both still work: the room shows a written summary and Ari answers with a fallback line.

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
