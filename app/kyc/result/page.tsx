"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RESULT_KEY } from "@/components/KycSession";
import type { SessionResult } from "@/lib/types";

function levelStyle(level: SessionResult["risk_level"]) {
  if (level === "low") return "text-accent";
  if (level === "medium") return "text-warn";
  return "text-danger";
}

export default function ResultPage() {
  const [result, setResult] = useState<SessionResult | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return;
    try {
      setResult(JSON.parse(raw) as SessionResult);
    } catch {
      setResult(null);
    }
  }, []);

  if (!result) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">No result yet</h1>
        <p className="text-muted">
          Run a camera check first. Nothing is stored after you leave this tab.
        </p>
        <Link href="/kyc" className="text-accent underline">
          Start a check
        </Link>
      </div>
    );
  }

  const rows = [
    { label: "Challenge completion", value: result.breakdown.challenges },
    { label: "Replay heuristics", value: result.breakdown.replay },
    { label: "Texture analysis", value: result.breakdown.texture },
    { label: "MiniFASNet anti-spoof", value: result.breakdown.antispoof },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line px-6 py-4">
        <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
          Identity risk input
        </p>
        <h1 className="text-lg font-semibold">Liveness &amp; replay result</h1>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <section className="rounded-2xl border border-line bg-card p-6">
          <p className="text-xs tracking-[0.16em] text-muted uppercase">
            Risk score
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <p className={`font-mono text-6xl font-semibold ${levelStyle(result.risk_level)}`}>
              {result.risk_score}
            </p>
            <div className="pb-2">
              <p className={`text-sm font-medium uppercase ${levelStyle(result.risk_level)}`}>
                {result.risk_level} risk
              </p>
              <p className="max-w-md text-sm leading-6 text-muted">
                {result.summary}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">
            0 is more likely live. 100 is more likely a photo, print, or screen
            replay. This is not a deepfake verdict.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium">Why this score</h2>
          <ul className="mt-3 space-y-2">
            {result.reasons.map((reason) => (
              <li
                key={reason}
                className="rounded-xl border border-line bg-card px-4 py-3 text-sm leading-6"
              >
                {reason}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-medium">Signal breakdown</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3 text-sm"
              >
                <span className="text-muted">{row.label}</span>
                <span className="font-mono">{row.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Frames analyzed: {result.frames_analyzed}
            {result.antispoof_spoof_prob !== null
              ? ` · MiniFASNet spoof probability ${(result.antispoof_spoof_prob * 100).toFixed(0)}%`
              : " · MiniFASNet unavailable"}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-medium">Challenges</h2>
          <ul className="mt-3 space-y-2">
            {result.challenge_results.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-line bg-card px-4 py-3 text-sm"
              >
                <div className="flex justify-between gap-3">
                  <span className="font-medium capitalize">
                    {c.type.replace("_", " ")}
                  </span>
                  <span className={c.passed ? "text-accent" : "text-danger"}>
                    {c.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <p className="mt-1 text-muted">{c.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex gap-3">
          <Link
            href="/kyc"
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-dim"
          >
            Run again
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm"
          >
            Back home
          </Link>
        </div>
      </main>
    </div>
  );
}
