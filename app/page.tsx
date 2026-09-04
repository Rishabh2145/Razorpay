import Link from "next/link";

export default function Home() {
  return (<div className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
    {/* Background effects */} <div className="pointer-events-none absolute inset-0 overflow-hidden"> <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" /> <div className="absolute right-0 top-1/2 h-80 w-80 rounded-full bg-blue-500/5 blur-3xl" /> </div>
    {/* Header */}
    <header className="relative z-10 flex items-center justify-between border-b border-line bg-background/70 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
          Merchant onboarding
        </p>
        <h1 className="mt-1 text-lg font-semibold">
          Liveness &amp; replay risk check
        </h1>
      </div>

      <div className="hidden items-center gap-2 text-xs text-muted sm:flex">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
        Secure local session
      </div>
    </header>

    <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs text-muted shadow-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          AI-powered liveness verification
        </div>

        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Prove there&apos;s a{" "}
          <span className="text-accent">real person</span>
          <br />
          in front of the camera.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted sm:text-lg">
          A lightweight liveness and replay-risk check designed for merchant
          KYC. Complete a few interactive challenges while we analyze signals
          for photos, screens, and replay attacks.
        </p>
      </section>

      {/* Steps */}
      <section className="mx-auto mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="group rounded-2xl border border-line bg-card p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
            1
          </div>
          <h3 className="font-medium">Enable camera</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Allow camera and microphone access directly in your browser.
          </p>
        </div>

        <div className="group rounded-2xl border border-line bg-card p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
            2
          </div>
          <h3 className="font-medium">Complete challenges</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Blink, turn your head, and respond to randomized prompts.
          </p>
        </div>

        <div className="group rounded-2xl border border-line bg-card p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
            3
          </div>
          <h3 className="font-medium">Review risk score</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Get liveness and replay-risk signals from the scoring API.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-10 flex w-full max-w-3xl flex-col items-center justify-between gap-5 rounded-3xl border border-line bg-card p-6 shadow-sm sm:flex-row sm:p-8">
        <div>
          <p className="text-lg font-semibold">Ready to verify?</p>
          <p className="mt-1 text-sm text-muted">
            The check takes only a few seconds.
          </p>
        </div>

        <Link
          href="/kyc"
          className="group inline-flex h-12 items-center justify-center gap-3 rounded-full bg-accent px-7 text-sm font-semibold text-accent-dim transition duration-300 hover:scale-105 hover:brightness-110 active:scale-95"
        >
          Start camera check
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </section>

      {/* Feature cards */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card/60 p-5 transition hover:border-accent/40">
          <div className="mb-3 text-2xl">👁</div>
          <h3 className="font-medium">Active challenges</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Randomized blink, head-turn, and spoken-code interactions.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card/60 p-5 transition hover:border-accent/40">
          <div className="mb-3 text-2xl">🛡</div>
          <h3 className="font-medium">Replay analysis</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Checks visual signals associated with screens and printed media.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card/60 p-5 transition hover:border-accent/40">
          <div className="mb-3 text-2xl">⚡</div>
          <h3 className="font-medium">Fast local scoring</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            MiniFASNet-based anti-spoof analysis running efficiently on CPU.
          </p>
        </div>
      </section>

      {/* Scope notice */}
      <section className="mt-8 rounded-2xl border border-line bg-card/40 p-5 text-sm leading-6 text-muted">
        <div className="flex gap-3">
          <span className="text-lg">ⓘ</span>
          <div>
            <p className="font-medium text-foreground">Scope, honestly</p>
            <p className="mt-1">
              This system is a liveness and replay-risk layer, not proof of
              identity or a complete deepfake detector. A low risk score
              should be used as one signal in a broader KYC decision.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <p className="mt-8 text-center text-xs text-muted">
        🔒 Camera and microphone remain controlled by your browser. Sampled
        frames are sent only to the configured local scoring API.
      </p>
    </main>
  </div>

);
}
