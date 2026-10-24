// Voice cloning provider, picked by env so the app never talks to a vendor
// directly and keys stay on the server.
//
//   VOICE_PROVIDER=elevenlabs  + ELEVENLABS_API_KEY   (hosted instant voice clone)
//   VOICE_PROVIDER=sovits      + SOVITS_URL           (self-hosted GPT-SoVITS voice_server.py)
//                                + SOVITS_KEY           (its VOICE_KEY, sent as x-voice-key)
//
// Unset means "not configured": the app keeps working with text bubbles.

export type Provider = "elevenlabs" | "sovits" | null;

export function provider(): Provider {
  const p = process.env.VOICE_PROVIDER;
  if (p === "elevenlabs" && process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (p === "sovits" && process.env.SOVITS_URL) return "sovits";
  return null;
}

const EL = "https://api.elevenlabs.io/v1";

// The self-hosted server is reachable from the internet through a tunnel, so
// it only answers callers that send its shared key.
function sovitsKey(): Record<string, string> {
  return process.env.SOVITS_KEY ? { "x-voice-key": process.env.SOVITS_KEY } : {};
}

export async function enroll(audio: Blob, text: string, lang: string): Promise<string> {
  const p = provider();
  if (p === "elevenlabs") {
    const form = new FormData();
    form.append("name", `scene-${Date.now()}`);
    form.append("files", audio, "voice.webm");
    form.append("description", `Scene user voice. Prompt: ${text}`);
    const res = await fetch(`${EL}/voices/add`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
      body: form,
    });
    if (!res.ok) throw new Error(`elevenlabs enroll ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { voice_id?: string };
    if (!json.voice_id) throw new Error("elevenlabs enroll: no voice_id");
    return json.voice_id;
  }
  if (p === "sovits") {
    const form = new FormData();
    form.append("file", audio, "voice.webm");
    form.append("text", text);
    form.append("lang", lang);
    const res = await fetch(`${process.env.SOVITS_URL}/enroll`, { method: "POST", headers: sovitsKey(), body: form });
    if (!res.ok) throw new Error(`sovits enroll ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { voice_id?: string };
    if (!json.voice_id) throw new Error("sovits enroll: no voice_id");
    return json.voice_id;
  }
  throw new Error("voice provider not configured");
}

export async function speak(voiceId: string, text: string): Promise<Response> {
  const p = provider();
  const lang = /[ㄱ-힝]/.test(text) ? "ko" : "en";
  if (p === "elevenlabs") {
    return fetch(`${EL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    });
  }
  if (p === "sovits") {
    return fetch(`${process.env.SOVITS_URL}/speak`, {
      method: "POST",
      headers: { "content-type": "application/json", ...sovitsKey() },
      body: JSON.stringify({ voice_id: voiceId, text, lang }),
    });
  }
  throw new Error("voice provider not configured");
}
