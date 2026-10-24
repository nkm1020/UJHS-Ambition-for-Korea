import { ROOMS } from "@/data/rooms";
import { askJSON } from "@/lib/claude";
import type { ActionName, CatchUp, Room } from "@/lib/types";

export const maxDuration = 30;

/** JSON { roomId, lang } → CatchUp. The transcript is built here from the
 *  room script, so the browser can't put its own text in the prompt. */

// Scripts don't change between requests, so one summary per room and language.
const cache = new Map<string, CatchUp>();

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    points: { type: "array", items: { type: "string" } },
    forYou: { type: "string" },
  },
  required: ["headline", "points", "forYou"],
  additionalProperties: false,
};

// Chat signals the room acts out, written as stage notes for the transcript.
const NOTES: Partial<Record<ActionName, (name: string) => string>> = {
  read_ignore: (n) => `${n} read it and didn't reply`,
  startle_up: (n) => `${n} came back`,
  cover_mouth: (n) => `${n} unsent a message`,
  typing_stop: (n) => `${n} started typing, then stopped`,
  stand_leave: (n) => `${n} left the chat`,
  laugh: (n) => `${n} reacted 😂`,
  heart: (n) => `${n} reacted 🫶`,
};

function transcript(room: Room): string {
  const name = (id: string) => room.members.find((m) => m.id === id)?.name ?? id;
  const lines: string[] = [];
  for (const beat of room.script) {
    if (beat.action === "walk_in") continue;
    if (beat.caption) lines.push(`(${beat.caption})`);
    if (beat.action === "talk") {
      lines.push(`${name(beat.actorId)}: ${beat.text ?? "[voice message]"}`);
    } else {
      // skip the note when the caption already says it ("Maya unsent a message")
      const note = NOTES[beat.action]?.(name(beat.actorId));
      if (note && !beat.caption?.includes(name(beat.actorId))) lines.push(`(${note})`);
    }
    for (const r of beat.reactions ?? []) {
      const note = NOTES[r.action]?.(name(r.actorId));
      if (note) lines.push(`(${note})`);
    }
  }
  return lines.join("\n");
}

function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? "English";
  } catch {
    return "English";
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { roomId?: unknown; lang?: unknown } | null;
  const room = ROOMS.find((r) => r.id === body?.roomId && r.catchUp);
  if (!room) return Response.json({ error: "unknown_room" }, { status: 404 });

  const tag = typeof body?.lang === "string" ? body.lang : "en";
  const lang = /^[a-z]{2,3}$/i.test(tag.split("-")[0]) ? tag.split("-")[0].toLowerCase() : "en";
  const key = `${room.id}:${lang}`;
  const hit = cache.get(key);
  if (hit) return Response.json(hit);

  const out = await askJSON<CatchUp>({
    system: [
      `You write the catch-up card in Scene, a messenger. The reader was away and has ${room.unread} unread messages in the group chat "${room.title}". They are "You" in the chat. Summarize it so they can reply in five seconds.`,
      'Talk to the reader directly. "You" is only their label in the transcript, so never write it as a name.',
      `Write in ${languageName(lang)}. Keep people's names as they are.`,
      "headline: the outcome so far, at most 10 words.",
      "points: 2 or 3 bullets in order, each under 20 words. The lines in parentheses are chat signals (left on read, late replies, unsent messages, typing then stopping). They are part of what happened, so mention the ones that matter, with a light touch.",
      "forYou: one short line on what the group is waiting on from the reader. If nothing, say so.",
      "Plain text, no markdown. At most one emoji in the whole card.",
    ].join("\n"),
    messages: [{ role: "user", content: transcript(room) }],
    schema: SCHEMA,
  });

  if (!out?.headline || !Array.isArray(out.points)) {
    return Response.json({ error: "summary_unavailable" }, { status: 503 });
  }
  const summary: CatchUp = { headline: out.headline, points: out.points.slice(0, 4), forYou: out.forYou ?? "" };
  cache.set(key, summary);
  return Response.json(summary);
}
