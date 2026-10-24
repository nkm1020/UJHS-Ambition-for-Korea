import { provider, speak } from "../provider";

export const maxDuration = 60;

/** JSON { voiceId, text } → audio bytes in the cloned voice */
export async function POST(request: Request) {
  if (!provider()) return Response.json({ error: "not_configured" }, { status: 503 });
  try {
    const { voiceId, text } = (await request.json()) as { voiceId?: string; text?: string };
    if (!voiceId || !text?.trim()) return Response.json({ error: "bad_request" }, { status: 400 });
    if (text.length > 300) return Response.json({ error: "too_long" }, { status: 413 });
    const res = await speak(voiceId, text.trim());
    if (!res.ok) {
      console.error("voice speak failed:", res.status, (await res.text()).slice(0, 200));
      return Response.json({ error: "speak_failed" }, { status: 502 });
    }
    return new Response(res.body, {
      headers: { "content-type": res.headers.get("content-type") ?? "audio/mpeg", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("voice speak failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "speak_failed" }, { status: 502 });
  }
}
