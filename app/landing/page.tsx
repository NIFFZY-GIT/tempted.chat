"use client";

import { useRouter } from "next/navigation";
import { LandingPageSection } from "@/components/landing-page";
import { TopNav } from "@/components/navbar";

export default function LandingPage() {
  const router = useRouter();

  return (
    <>
      <main className="screen !place-items-stretch !content-start !overflow-y-auto gap-6">
        <TopNav
          isAuthenticated={false}
          onLogin={() => router.push("/")}
          onLogout={() => router.push("/")}
          isWorking={false}
        />
        <LandingPageSection />
      </main>
    </>
  );
}
