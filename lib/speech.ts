type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export function speechSupported(): boolean {
  const w = window as SpeechWindow;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function normalizeDigits(text: string): string {
  const words: Record<string, string> = {
    zero: "0",
    oh: "0",
    o: "0",
    one: "1",
    two: "2",
    to: "2",
    too: "2",
    three: "3",
    four: "4",
    for: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    ate: "8",
    nine: "9",
  };
  return text
    .toLowerCase()
    .split(/[\s,-]+/)
    .flatMap((token) => {
      const clean = token.replace(/[^a-z0-9]/g, "");
      if (!clean) return [];
      if (/^\d+$/.test(clean)) return clean.split("");
      if (words[clean]) return [words[clean]];
      return [];
    })
    .join("");
}

export function listenForDigits(
  expected: string,
  timeoutMs: number,
): Promise<{ transcript: string; matched: boolean }> {
  const w = window as SpeechWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    return Promise.reject(new Error("Speech recognition is not available"));
  }

  return new Promise((resolve) => {
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = true;

    let settled = false;
    let lastTranscript = "";

    const finish = (transcript: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      const digits = normalizeDigits(transcript);
      resolve({
        transcript: digits || transcript.trim(),
        matched: digits === expected,
      });
    };

    rec.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        parts.push(event.results[i][0]?.transcript ?? "");
      }
      lastTranscript = parts.join(" ");
      if (normalizeDigits(lastTranscript) === expected) {
        finish(lastTranscript);
      }
    };
    rec.onerror = () => finish(lastTranscript);
    rec.onend = () => {
      if (!settled) finish(lastTranscript);
    };

    const timer = window.setTimeout(() => finish(lastTranscript), timeoutMs);
    rec.start();
  });
}
