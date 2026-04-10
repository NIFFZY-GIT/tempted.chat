"use client";

import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/footer";
import { LandingPageSection } from "@/components/landing-page";
import { TopNav } from "@/components/navbar";

export default function LandingPage() {
  const router = useRouter();

  return (
    <>
      <main className="screen !place-items-stretch !content-start gap-6">
        <TopNav
          isAuthenticated={false}
          onLogin={() => router.push("/")}
          onLogout={() => router.push("/")}
          isWorking={false}
        />
        <LandingPageSection />
      </main>
      <SiteFooter />
    </>
  );
}
