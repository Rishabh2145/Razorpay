import type { CompletePayload, SessionResult, SessionStart } from "./types";

const API_BASE =
  process.env.API_URL;
  // process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string };
    if (typeof data.detail === "string") return data.detail;
  } catch {
    /* ignore */
  }
  return `${res.status} ${res.statusText}`;
}

export async function startSession(): Promise<SessionStart> {

  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const data = (await res.json()) as SessionStart;

  return data;
}

export async function uploadFrames(
  sessionId: string,
  frames: Blob[],
): Promise<void> {
  if (frames.length === 0) return;
  const body = new FormData();
  frames.forEach((blob, i) => {
    body.append("files", blob, `frame-${i}.jpg`);
  });
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/frames`, {
    method: "POST",
    body,
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function completeSession(
  sessionId: string,
  payload: CompletePayload,
): Promise<SessionResult> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<SessionResult>;
}

export async function getSession(sessionId: string): Promise<SessionResult> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<SessionResult>;
}

export { API_BASE };
