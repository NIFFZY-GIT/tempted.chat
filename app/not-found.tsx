"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/navbar";

export default function NotFound() {
  const router = useRouter();

  return (
    <>
      <main className="screen">
        <TopNav
          isAuthenticated={false}
          onLogin={() => router.push("/")}
          onLogout={() => router.push("/")}
          isWorking={false}
        />

        <section className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.16),transparent_40%),linear-gradient(145deg,#14111b,#0c0b12)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)] transition-transform duration-300 motion-safe:hover:-translate-y-0.5 md:p-9">
          <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-pink-400/15 blur-2xl motion-safe:animate-pulse" />
          <div className="pointer-events-none absolute -bottom-12 -right-10 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl motion-safe:animate-pulse" />

          <p className="text-xs font-bold uppercase tracking-[0.28em] text-pink-300/80">Error 404</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-white md:text-5xl">Page not found</h1>
          <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-white/65 md:text-base">
            The page you are looking for does not exist or has been moved. Return to the homepage and continue chatting.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-xl bg-pink-500 px-5 py-3 text-sm font-extrabold text-black transition duration-200 hover:scale-[1.02] hover:brightness-110"
            >
              Go Home
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 transition duration-200 hover:scale-[1.02] hover:border-white/35 hover:text-white"
            >
              Start Chat
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
