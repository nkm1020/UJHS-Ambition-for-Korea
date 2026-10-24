import type { ActionName, Beat, CatchUp } from "@/lib/types";

// Client side of the Sonnet features. Talks only to our own /api routes.
// Nothing here throws: every call has a timeout and falls back, so the room
// keeps playing when the API is slow, down, or has no key.

export const REACTIONS = ["none", "laugh", "heart", "startle"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** What the AI friend says, and the body language it plays first. */
export interface AgentReply {
  reaction: Reaction;
  text: string;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Stands in for a voice message the browser couldn't transcribe. */
export const VOICE_ONLY = "(voice message, couldn't transcribe)";

const FALLBACK_REPLY: AgentReply = { reaction: "startle", text: "sorry, my wifi just blinked 😵 say that again?" };

const REACTION_ACTION: Record<Exclude<Reaction, "none">, ActionName> = {
  laugh: "laugh",
  heart: "heart",
  startle: "startle_up",
};

async function postJSON<T>(url: string, body: unknown, ms: number, outer?: AbortSignal): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  outer?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  }
}

/** The AI catch-up for a room, in the browser's language. Null on failure. */
export function fetchCatchUp(roomId: string, signal?: AbortSignal): Promise<CatchUp | null> {
  return postJSON<CatchUp>("/api/summary", { roomId, lang: navigator.language }, 15000, signal);
}

/** One conversation with the AI friend. Replies come back in the order asked. */
export function createAgentChat() {
  const history: ChatTurn[] = [];
  let chain: Promise<unknown> = Promise.resolve();

  return {
    reply(said: string | undefined): Promise<AgentReply> {
      const next = chain.then(async () => {
        history.push({ role: "user", content: said?.trim() || VOICE_ONLY });
        const out = await postJSON<AgentReply>("/api/agent", { messages: history }, 20000);
        const reply = out?.text ? out : FALLBACK_REPLY;
        history.push({ role: "assistant", content: JSON.stringify(reply) });
        return reply;
      });
      chain = next;
      return next;
    },
  };
}

/** The reply as room beats: the reaction, then the line. */
export function replyBeats(actorId: string, reply: AgentReply): Beat[] {
  const beats: Beat[] = [];
  if (reply.reaction !== "none") beats.push({ actorId, action: REACTION_ACTION[reply.reaction] });
  beats.push({ actorId, action: "talk", text: reply.text });
  return beats;
}
