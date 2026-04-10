"use client";

import { useRouter } from "next/navigation";
import { TopNav } from "@/components/navbar";

export default function SafetyPage() {
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
        <h1 className="text-3xl font-bold sm:text-4xl">Safety</h1>
        <p className="mt-4 text-white/80">
          Tempted.Chat is built for respectful, consent-first conversations. Please follow these basic rules.
        </p>

        <section className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/25 p-6">
          <h2 className="text-xl font-semibold">Community Guidelines</h2>
          <ul className="list-disc space-y-2 pl-6 text-white/80">
            <li>Be respectful. Harassment, hate speech, and threats are not allowed.</li>
            <li>Do not share personal information such as phone numbers, addresses, or passwords.</li>
            <li>Do not pressure anyone for images, calls, or private details.</li>
            <li>Report abusive behavior and leave any chat that feels unsafe.</li>
          </ul>
        </section>

        <section className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-6">
          <h2 className="text-xl font-semibold">Quick Safety Tips</h2>
          <p className="text-white/80">Use a nickname, avoid sharing social accounts, and trust your instincts.</p>
        </section>
      </main>
    </>
  );
}
