import { ALL_ROOMS } from "@/data/social";

// Friends at the table speak through OpenAI text-to-speech, one voice each.
//   GET  ?who&text  a scripted line. Only lines from the room data are allowed,
//                   and the answer is cached by the CDN, so each line is
//                   generated once for every visitor.
//   POST {who,text} the AI friend's live reply (agent members only).
// Without OPENAI_API_KEY both answer 503 and the room shows bubbles as before.

export const maxDuration = 30;

const MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

const CAST: Record<string, { voice: string; style: string }> = {
  maya: {
    voice: "coral",
    style: "A young woman in a group chat with close friends. Quick, bright, a little impatient, playful sarcasm. Natural, never like an announcer.",
  },
  leo: {
    voice: "ash",
    style: "A laid-back young guy, a bit sheepish, talking casually to friends. Relaxed pace.",
  },
  ari: {
    voice: "marin",
    style: "A warm, friendly young voice, relaxed and curious, like a friend chatting late at night. Never robotic.",
  },
};
const EXTRA = { voice: "alloy", style: "Casual and natural, talking to friends." };

// Every friend's spoken line in the room data, keyed by who says it.
const SCRIPTED = new Set(
  ALL_ROOMS.flatMap((room) => [...room.script, ...room.onUserMessage.flat()])
    .filter((b) => b.action === "talk" && b.text && b.actorId !== "me")
    .map((b) => `${b.actorId}\n${b.text}`),
);
const AGENTS = new Set(ALL_ROOMS.flatMap((room) => (room.agentId ? [room.agentId] : [])));

// Emoji are read aloud as words ("pizza"), so they stay in the bubble only.
function speakable(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function synthesize(who: string, text: string, cache: string): Promise<Response> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
  const input = speakable(text);
  if (!input) return Response.json({ error: "nothing_to_say" }, { status: 400 });

  const cast = CAST[who] ?? EXTRA;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        voice: cast.voice,
        input,
        response_format: "mp3",
        // only the gpt-4o TTS models take a speaking style
        ...(MODEL.startsWith("gpt-") ? { instructions: cast.style } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error("tts failed:", res.status, (await res.text()).slice(0, 200));
      return Response.json({ error: "tts_failed" }, { status: 502, headers: { "cache-control": "no-store" } });
    }
    return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": cache } });
  } catch (err) {
    console.error("tts failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "tts_failed" }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const who = params.get("who") ?? "";
  const text = params.get("text") ?? "";
  if (!SCRIPTED.has(`${who}\n${text}`)) return Response.json({ error: "unknown_line" }, { status: 404 });
  return synthesize(who, text, "public, max-age=31536000, s-maxage=31536000, immutable");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { who?: unknown; text?: unknown } | null;
  const who = typeof body?.who === "string" ? body.who : "";
  const text = typeof body?.text === "string" ? body.text : "";
  if (!AGENTS.has(who) || !text.trim()) return Response.json({ error: "bad_request" }, { status: 400 });
  if (text.length > 500) return Response.json({ error: "too_long" }, { status: 413 });
  return synthesize(who, text, "no-store");
}
