"use client";

import { LandingPageSection } from "@/components/landing-page";
import { AuthTopNav } from "@/components/auth-top-nav";

export default function LandingPage() {
  return (
    <>
      <main className="screen !place-items-stretch !content-start !overflow-y-auto gap-6">
        <AuthTopNav />
        <LandingPageSection />
      </main>
    </>
  );
}
