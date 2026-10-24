import Anthropic from "@anthropic-ai/sdk";

// Server only (imported by route handlers). The key comes from
// ANTHROPIC_API_KEY and never reaches the client bundle.

export const MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;

/**
 * One Sonnet call whose answer must match `schema`. Returns null on any
 * failure (no key, timeout, refusal, bad JSON) so the caller can fall back.
 */
export async function askJSON<T>({
  system,
  messages,
  schema,
  maxTokens = 2000,
}: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T | null> {
  try {
    client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // On a policy decline, retry server-side on Anthropic's recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system,
      messages,
    });
    if (res.stop_reason !== "end_turn") {
      console.warn(`Claude stopped early: ${res.stop_reason}`);
      return null;
    }
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
    return text ? (JSON.parse(text.text) as T) : null;
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error(`Claude API error ${err.status}: ${err.message}`);
    else console.error("Claude call failed:", err);
    return null;
  }
}
