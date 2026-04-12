"use client";

import {
  ShieldCheck,
  User,
  Zap,
  Timer,
  Eye,
  Globe,
  MessageCircle,
  Video,
  Users,
  Lock,
  Sparkles,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { ParticleBackground } from "./particle-background";

/* ─── data ────────────────────────────────────────────── */

const FEATURES = [
  {
    title: "End-to-end encrypted",
    description:
      "Messages are encrypted on your device. Only the recipient can read them.",
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
    glow: "group-hover:shadow-emerald-500/10",
  },
  {
    title: "Anonymous by default",
    description:
      "No public profiles. You control what you share and when.",
    icon: User,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    ring: "ring-cyan-500/20",
    glow: "group-hover:shadow-cyan-500/10",
  },
  {
    title: "Instant matching",
    description:
      "Low-latency real-time matching with smooth reconnects.",
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
    glow: "group-hover:shadow-amber-500/10",
  },
  {
    title: "Timed media",
    description:
      "Send images with auto-expiring timers for safer sharing.",
    icon: Timer,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    ring: "ring-pink-500/20",
    glow: "group-hover:shadow-pink-500/10",
  },
  {
    title: "Disappearing content",
    description:
      "Images are deleted from servers after the timer expires.",
    icon: Eye,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    ring: "ring-violet-500/20",
    glow: "group-hover:shadow-violet-500/10",
  },
  {
    title: "Global reach",
    description:
      "Filter by country, gender, and age to find the right match.",
    icon: Globe,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
    glow: "group-hover:shadow-blue-500/10",
  },
];

const MODES = [
  {
    icon: MessageCircle,
    label: "Text Chat",
    desc: "Messages, photos & fun",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "hover:border-pink-500/20",
  },
  {
    icon: Video,
    label: "Video Call",
    desc: "Face-to-face with strangers",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "hover:border-violet-500/20",
  },
  {
    icon: Users,
    label: "Group Chat",
    desc: "Chat with a crowd",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "hover:border-blue-500/20",
  },
];

const STATS = [
  {
    value: "100K+",
    label: "Conversations",
    icon: MessageCircle,
    color: "text-pink-400",
  },
  {
    value: "50+",
    label: "Countries",
    icon: Globe,
    color: "text-blue-400",
  },
  {
    value: "99.9%",
    label: "Uptime",
    icon: Zap,
    color: "text-amber-400",
  },
  {
    value: "<1s",
    label: "Match time",
    icon: Timer,
    color: "text-emerald-400",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Sign in",
    desc: "Guest, Google, or email \u2014 takes 5 seconds",
    icon: User,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    step: "02",
    title: "Pick a mode",
    desc: "Text, video, or group chat",
    icon: Sparkles,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    step: "03",
    title: "Get matched",
    desc: "We pair you instantly with someone new",
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    step: "04",
    title: "Chat privately",
    desc: "End-to-end encrypted from the first message",
    icon: Lock,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
];

/* ─── hooks ───────────────────────────────────────────── */

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ─── small pieces ────────────────────────────────────── */

function SectionDivider() {
  return (
    <div className="mx-auto my-16 flex w-24 items-center justify-center gap-1.5 sm:my-20">
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/10" />
      <span className="h-1 w-1 rounded-full bg-white/15" />
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/10" />
    </div>
  );
}

/* ─── main export ─────────────────────────────────────── */

export function LandingPageSection() {
  const hero = useReveal(0.1);
  const modes = useReveal();
  const steps = useReveal();
  const features = useReveal();
  const stats = useReveal();
  const cta = useReveal();

  const scrollToAuth = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <>
      <ParticleBackground />

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-24">
        {/* ── Hero ── */}
        <div
          ref={hero.ref}
          className="relative mx-auto max-w-3xl pt-6 text-center sm:pt-10"
        >
          <div
            className={`mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-5 py-2 backdrop-blur-sm transition-all duration-700 ${
              hero.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
              People online now
            </span>
          </div>

          <h2
            className={`text-4xl font-black tracking-tight text-white transition-all duration-700 delay-100 sm:text-5xl md:text-6xl lg:text-7xl ${
              hero.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            Meet strangers.
            <br />
            <span className="landing-gradient-text">Stay private.</span>
          </h2>

          <p
            className={`mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/40 transition-all duration-700 delay-200 sm:text-lg md:text-xl ${
              hero.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            Connect instantly with real people worldwide.
            <br className="hidden sm:block" />
            End-to-end encrypted, anonymous by design.
          </p>

          <div
            className={`mt-8 flex flex-wrap items-center justify-center gap-2.5 transition-all duration-700 delay-300 sm:gap-3 ${
              hero.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            {[
              { icon: ShieldCheck, label: "Encrypted", color: "text-emerald-400" },
              { icon: Eye, label: "Anonymous", color: "text-violet-400" },
              { icon: Zap, label: "Instant", color: "text-amber-400" },
            ].map((pill) => (
              <span
                key={pill.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-[12px] font-medium text-white/35 backdrop-blur-sm transition-colors hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-white/50"
              >
                <pill.icon className={`h-3.5 w-3.5 ${pill.color}`} />
                {pill.label}
              </span>
            ))}
          </div>

          <div
            className={`mt-12 flex justify-center transition-all duration-700 delay-500 ${
              hero.visible ? "opacity-100" : "opacity-0"
            }`}
          >
            <ChevronDown className="h-5 w-5 animate-bounce text-white/15" />
          </div>
        </div>

        <SectionDivider />

        {/* ── Chat Modes ── */}
        <div ref={modes.ref}>
          <div
            className={`mb-3 text-center transition-all duration-700 ${
              modes.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-pink-400/50">
              Chat Modes
            </span>
          </div>
          <h3
            className={`mb-8 text-center text-2xl font-bold text-white transition-all duration-700 delay-100 sm:text-3xl ${
              modes.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            Three ways to connect
          </h3>

          <div className="grid gap-4 sm:grid-cols-3">
            {MODES.map((m, i) => (
              <div
                key={m.label}
                className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 backdrop-blur-sm transition-all duration-700 ${m.border} hover:bg-white/[0.04] hover:shadow-lg sm:flex-col sm:items-center sm:gap-4 sm:p-8 sm:text-center ${
                  modes.visible
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-8 scale-95"
                }`}
                style={{
                  transitionDelay: modes.visible
                    ? `${i * 120 + 150}ms`
                    : "0ms",
                }}
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <div
                    className={`absolute inset-0 ${m.bg} opacity-30 blur-2xl`}
                  />
                </div>
                <div
                  className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${m.bg} ring-1 ring-white/[0.06] transition-transform duration-300 group-hover:scale-110`}
                >
                  <m.icon className={`h-6 w-6 ${m.color}`} />
                </div>
                <div className="relative">
                  <h3 className="text-[15px] font-bold text-white/90">
                    {m.label}
                  </h3>
                  <p className="mt-1 text-[13px] text-white/30">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <SectionDivider />

        {/* ── How It Works ── */}
        <div ref={steps.ref}>
          <div
            className={`mb-3 text-center transition-all duration-700 ${
              steps.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-400/50">
              How it works
            </span>
          </div>
          <h3
            className={`mb-10 text-center text-2xl font-bold text-white transition-all duration-700 delay-100 sm:text-3xl ${
              steps.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            Start chatting in seconds
          </h3>

          <div className="relative mx-auto max-w-2xl">
            <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-transparent sm:left-8 sm:block" />
            <div className="space-y-4 sm:space-y-6">
              {STEPS.map((s, i) => (
                <div
                  key={s.step}
                  className={`group flex items-start gap-4 rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4 backdrop-blur-sm transition-all duration-700 hover:border-white/[0.08] hover:bg-white/[0.03] sm:gap-5 sm:p-5 ${
                    steps.visible
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 -translate-x-8"
                  }`}
                  style={{
                    transitionDelay: steps.visible
                      ? `${i * 120 + 200}ms`
                      : "0ms",
                  }}
                >
                  <div
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.bg} ring-1 ring-white/[0.06] transition-transform duration-300 group-hover:scale-105 sm:h-14 sm:w-14`}
                  >
                    <s.icon
                      className={`h-5 w-5 ${s.color} sm:h-6 sm:w-6`}
                    />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/15">
                      Step {s.step}
                    </span>
                    <h4 className="mt-0.5 text-[15px] font-bold text-white/85">
                      {s.title}
                    </h4>
                    <p className="mt-0.5 text-[13px] text-white/30">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SectionDivider />

        {/* ── Features Grid ── */}
        <div ref={features.ref}>
          <div
            className={`mb-3 text-center transition-all duration-700 ${
              features.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400/50">
              Privacy first
            </span>
          </div>
          <h3
            className={`mb-3 text-center text-2xl font-bold text-white transition-all duration-700 delay-100 sm:text-3xl ${
              features.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            Built for privacy, designed for fun
          </h3>
          <p
            className={`mx-auto mb-10 max-w-md text-center text-[14px] text-white/30 transition-all duration-700 delay-150 ${
              features.visible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            Every feature exists to protect you
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={`group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-700 hover:border-white/[0.1] hover:bg-white/[0.04] hover:shadow-xl ${feature.glow} ${
                  features.visible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }`}
                style={{
                  transitionDelay: features.visible
                    ? `${i * 100 + 150}ms`
                    : "0ms",
                }}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.bg} ring-1 ${feature.ring} transition-all duration-300 group-hover:scale-110 group-hover:ring-2`}
                >
                  <feature.icon
                    className={`h-5 w-5 ${feature.color}`}
                  />
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
        </div>

        <SectionDivider />

        {/* ── Stats ── */}
        <div ref={stats.ref}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`group rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-7 text-center backdrop-blur-sm transition-all duration-700 hover:border-white/[0.08] hover:bg-white/[0.04] ${
                  stats.visible
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-8 scale-95"
                }`}
                style={{
                  transitionDelay: stats.visible
                    ? `${i * 100 + 100}ms`
                    : "0ms",
                }}
              >
                <s.icon
                  className={`mx-auto mb-3 h-5 w-5 ${s.color} opacity-50 transition-all duration-300 group-hover:scale-110 group-hover:opacity-80`}
                />
                <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {s.value}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/25">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <SectionDivider />

        {/* ── Bottom CTA ── */}
        <div
          ref={cta.ref}
          className={`relative overflow-hidden rounded-3xl border border-white/[0.06] p-8 text-center backdrop-blur-sm transition-all duration-700 sm:p-14 ${
            cta.visible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-8 scale-95"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-500/[0.08] via-transparent to-violet-500/[0.08]" />
          <div className="pointer-events-none absolute inset-0 landing-shimmer" />

          <div className="relative">
            <Sparkles className="mx-auto mb-4 h-8 w-8 text-pink-400/50" />
            <h3 className="text-2xl font-bold text-white sm:text-3xl">
              Ready to start?
            </h3>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/35">
              Join thousands of people chatting right now.
              <br />
              It&apos;s free, anonymous, and takes seconds.
            </p>
            <button
              onClick={scrollToAuth}
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-7 py-3 text-[14px] font-semibold text-white/80 ring-1 ring-white/[0.1] backdrop-blur-sm transition-all hover:bg-white/[0.12] hover:text-white hover:ring-white/[0.15] active:scale-[0.97]"
            >
              Start chatting
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}