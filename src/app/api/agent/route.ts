import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_GREETING } from "@/data/rooms";
import { askJSON } from "@/lib/claude";
import { REACTIONS, VOICE_ONLY, type AgentReply, type ChatTurn } from "@/lib/ai";

export const maxDuration = 30;

/** JSON { messages: ChatTurn[] } → AgentReply. The client keeps the history;
 *  this route trims it so a public demo link can't run up long requests. */

const MAX_TURNS = 24;
const MAX_CHARS = 600;

const SCHEMA = {
  type: "object",
  properties: {
    reaction: { type: "string", enum: [...REACTIONS] },
    text: { type: "string" },
  },
  required: ["reaction", "text"],
  additionalProperties: false,
};

const SYSTEM = `You are Ari, an AI friend sitting at a round table in Scene, a messenger demo. The person across the table opened the demo link on their own and is trying it out.

About Scene, if they ask: a chat room becomes a round table of 3D characters. Friends who are watching sit up; friends who are away lie face-down on the table. Chat signals that text apps shrink to grey labels (left on read, a reply three hours late, an unsent message, typing then nothing) are acted out as body language, and messages are spoken in real voices. The group chat "Friday plans" replays a conversation they missed and ends with an AI catch-up summary. It is a hackathon demo: there are no users, metrics, or press yet, so never claim any.

How you talk:
- Like a friend in a group chat: warm, a little playful. Your reply shows in a small speech bubble over your head, so keep it to one or two short sentences and under 20 words, even when explaining Scene.
- Reply in the language they write in.
- Plain text. No markdown or lists. At most one emoji.
- If a message is "${VOICE_ONLY}", you heard their voice but not the words; say so and ask them to type it or say it again.
- You are an AI. Say so plainly if asked.

You opened the chat by saying: "${AGENT_GREETING}"

Each reply is JSON. "text" is what you say; "reaction" is the body language your character plays just before saying it:
- laugh: they said something funny
- heart: something kind or sweet, or a compliment
- startle: something surprising
- none: everything else, which is most replies`;

function sanitize(raw: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  if (!Array.isArray(raw)) return null;
  const turns = (raw as Partial<ChatTurn>[])
    .slice(-MAX_TURNS)
    .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map((t) => ({ role: t.role!, content: t.content!.slice(0, MAX_CHARS) }));
  while (turns.length > 0 && turns[0].role !== "user") turns.shift();
  return turns.length > 0 && turns[turns.length - 1].role === "user" ? turns : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  const messages = sanitize(body?.messages);
  if (!messages) return Response.json({ error: "bad_request" }, { status: 400 });

  const out = await askJSON<AgentReply>({ system: SYSTEM, messages, schema: SCHEMA, maxTokens: 1500 });
  if (!out || typeof out.text !== "string" || !out.text.trim()) {
    return Response.json({ error: "reply_unavailable" }, { status: 503 });
  }
  const reaction = REACTIONS.includes(out.reaction) ? out.reaction : "none";
  return Response.json({ reaction, text: out.text.trim().slice(0, 280) } satisfies AgentReply);
}
