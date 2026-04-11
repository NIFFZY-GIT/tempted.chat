import {
  ShieldCheck,
  User,
  Zap,
  Timer,
  Eye,
  Globe,
} from "lucide-react";

const FEATURES = [
  {
    title: "End-to-end encrypted",
    description: "Messages and media are encrypted on your device. Only the recipient can decrypt them.",
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  {
    title: "Anonymous by default",
    description: "No public profiles. You control what you share and when.",
    icon: User,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    ring: "ring-cyan-500/20",
  },
  {
    title: "Instant matching",
    description: "Low-latency real-time matching with smooth reconnects.",
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  {
    title: "Timed media",
    description: "Send images with auto-expiring timers for safer sharing.",
    icon: Timer,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    ring: "ring-pink-500/20",
  },
  {
    title: "Disappearing content",
    description: "Images are deleted from servers after the timer expires.",
    icon: Eye,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    ring: "ring-violet-500/20",
  },
  {
    title: "Global reach",
    description: "Filter by country, gender, and age to find the right conversation.",
    icon: Globe,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
  },
];

export function LandingPageSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
      {/* Hero */}
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Live now</span>
        </div>

        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Meet strangers.{" "}
          <span className="bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">
            Stay private.
          </span>
        </h2>

        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-white/40 sm:text-base">
          Connect instantly with real people. End-to-end encrypted, anonymous by design, and built for privacy.
        </p>
      </div>

      {/* Features grid */}
      <div className="mt-14 grid gap-3 sm:mt-16 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="group rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.04] sm:p-6"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${feature.bg} ring-1 ${feature.ring}`}>
              <feature.icon className={`h-4 w-4 ${feature.color}`} />
            </div>

            <h3 className="mt-4 text-[15px] font-semibold text-white/90">
              {feature.title}
            </h3>

            <p className="mt-1.5 text-[13px] leading-relaxed text-white/35">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-14 text-center sm:mt-16">
        <p className="text-[13px] text-white/25">
          Sign in above to start chatting — it&apos;s free and takes seconds.
        </p>
      </div>
    </section>
  );
}