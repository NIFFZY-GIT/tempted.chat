"use client";

import { useRouter } from "next/navigation";
import { TopNav } from "@/components/navbar";

export default function AboutPage() {
  const router = useRouter();

  return (
    <>
      <TopNav
        isAuthenticated={false}
        onLogin={() => router.push("/")}
        onLogout={() => router.push("/")}
        isWorking={false}
      />
      <main className="mx-auto min-h-screen w-full max-w-4xl px-6 pb-16 pt-28 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">About Tempted.Chat</h1>
        <p className="mt-4 text-white/80">
          Tempted.Chat helps people connect through spontaneous, privacy-aware conversations.
        </p>

        <section className="mt-8 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-6">
          <h2 className="text-xl font-semibold">What We Focus On</h2>
          <ul className="list-disc space-y-2 pl-6 text-white/80">
            <li>Fast matching for text-first conversations.</li>
            <li>Simple controls so you can skip, leave, and reconnect quickly.</li>
            <li>A design that keeps attention on chat while staying lightweight.</li>
          </ul>
        </section>

        <section className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-6">
          <h2 className="text-xl font-semibold">Our Direction</h2>
          <p className="text-white/80">
            We are continuously improving moderation tools, trust signals, and user safety systems.
          </p>
        </section>
      </main>
    </>
  );
}
