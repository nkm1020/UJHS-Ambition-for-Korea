import { enroll, provider } from "../provider";

export const maxDuration = 60;

/** Is cloning available? The onboarding asks before recording. */
export async function GET() {
  return Response.json({ configured: provider() !== null });
}

/** multipart: file (the browser recording), text (the line read), lang */
export async function POST(request: Request) {
  if (!provider()) return Response.json({ error: "not_configured" }, { status: 503 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const text = String(form.get("text") ?? "");
    const lang = String(form.get("lang") ?? "en");
    if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "no_audio" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return Response.json({ error: "too_large" }, { status: 413 });
    const voiceId = await enroll(file, text, lang);
    return Response.json({ voiceId });
  } catch (err) {
    // never log the audio itself; only the failure
    console.error("voice enroll failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "enroll_failed" }, { status: 502 });
  }
}
