"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import type { PlanId, PlanTier } from "@/lib/stripe";
import { TopNav } from "@/components/navbar";
import { getUserRole } from "@/lib/admin";

type Duration = "1h" | "24h" | "7d" | "30d";

const DURATIONS: { id: Duration; label: string; short: string }[] = [
  { id: "1h", label: "1 Hour", short: "1H" },
  { id: "24h", label: "24 Hours", short: "24H" },
  { id: "7d", label: "7 Days", short: "7D" },
  { id: "30d", label: "30 Days", short: "30D" },
];

const PRICES: Record<PlanTier, Record<Duration, number>> = {
  vip: { "1h": 99, "24h": 249, "7d": 599, "30d": 999 },
  vvip: { "1h": 199, "24h": 499, "7d": 999, "30d": 1999 },
};

type Feature = { label: string; vip: boolean; vvip: boolean };
const FEATURES: Feature[] = [
  { label: "Gender filter", vip: true, vvip: true },
  { label: "Chat style filter", vip: true, vvip: true },
  { label: "Age filter", vip: false, vvip: true },
  { label: "Country filter", vip: false, vvip: true },
  { label: "Priority matching", vip: false, vvip: true },
];

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PlansPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<Duration>("7d");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<PlanTier | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u && !u.isAnonymous) {
        void getUserRole(u.uid).then((role) => setIsAdmin(role === "admin")).catch(() => setIsAdmin(false));
      } else {
        setIsAdmin(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) { setSubLoading(false); return; }
    setSubLoading(true);
    user.getIdToken().then((token) =>
      fetch(`/api/subscription?uid=${encodeURIComponent(user.uid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.active) {
          setSubscriptionExpiresAt(data.expiresAt);
          setSubscriptionTier(data.tier ?? null);
        } else {
          setSubscriptionExpiresAt(null);
          setSubscriptionTier(null);
        }
      })
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, [user]);

  const isActive = isAdmin || (subscriptionExpiresAt !== null && subscriptionExpiresAt > Date.now());
  const isGuest = !!user && user.isAnonymous;

  const handlePurchase = async (tier: PlanTier) => {
    const planId: PlanId = `${tier}_${duration}`;
    if (!user || isGuest) { router.push("/"); return; }
    setLoading(planId);
    setError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId, idToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("Session expired. Please sign in again and retry.");
          setLoading(null);
          return;
        }
        setError(data.error ?? "Something went wrong");
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  };

  const vipLoading = loading === `vip_${duration}`;
  const vvipLoading = loading === `vvip_${duration}`;

  return (
    <div className="min-h-dvh bg-[#08080e]">
      <TopNav
        isAuthenticated={!!user}
        onLogin={() => router.push("/")}
        onLogout={() => void signOut(auth)}
        isWorking={false}
      />

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-24 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Upgrade Your Experience
          </h1>
          <p className="mt-2 text-sm text-white/35">
            Choose your filters. Pick a duration. Start matching.
          </p>
          {subLoading ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/30">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              Checking...
            </div>
          ) : isAdmin ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Admin — Full VVIP Access
            </div>
          ) : isActive && subscriptionExpiresAt ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {subscriptionTier?.toUpperCase()} until {new Date(subscriptionExpiresAt).toLocaleString()}
            </div>
          ) : null}
        </div>

        {/* Guest warning */}
        {isGuest && (
          <div className="mx-auto mb-6 flex max-w-md items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3">
            <span className="text-lg">&#x26A0;&#xFE0F;</span>
            <div>
              <p className="text-sm font-semibold text-amber-300">Guest account detected</p>
              <p className="text-xs text-white/40">Sign in with Google or email to purchase a plan. Guest accounts can lose access if you clear your browser data.</p>
            </div>
          </div>
        )}

        {/* Duration selector */}
        <div className="mx-auto mb-8 flex w-fit rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
          {DURATIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDuration(d.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition sm:px-6 sm:text-sm ${
                duration === d.id
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Plan cards */}
        <div className="grid gap-5 sm:grid-cols-2">
          {/* VIP */}
          <div className="flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6">
            <div className="mb-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10 text-lg">💎</span>
                <h2 className="text-lg font-extrabold text-white">VIP</h2>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">{fmt(PRICES.vip[duration])}</span>
                <span className="text-sm text-white/30">/ {DURATIONS.find((d) => d.id === duration)?.label.toLowerCase()}</span>
              </div>
              <p className="mt-1 text-xs text-white/30">Essential chat filters</p>
            </div>

            <ul className="mb-6 flex-1 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-2.5 text-sm">
                  {f.vip ? (
                    <svg className="h-4 w-4 shrink-0 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  ) : (
                    <svg className="h-4 w-4 shrink-0 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  )}
                  <span className={f.vip ? "text-white/60" : "text-white/20 line-through"}>{f.label}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => handlePurchase("vip")}
              disabled={loading !== null || authLoading || isGuest}
              className="relative w-full rounded-xl bg-white/[0.07] py-3 text-sm font-bold text-white transition hover:bg-white/[0.12] active:scale-[0.98] disabled:opacity-50"
            >
              {isGuest ? "Sign in with Google or Email" : !user && !authLoading ? "Sign in first" : `Get VIP — ${fmt(PRICES.vip[duration])}`}
              {vipLoading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-pink-400" />
                </span>
              )}
            </button>
          </div>

          {/* VVIP */}
          <div className="relative flex flex-col rounded-3xl border border-amber-400/25 bg-gradient-to-b from-amber-500/[0.03] to-transparent p-6">
            <span className="absolute -top-3 right-5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-0.5 text-[10px] font-extrabold text-black shadow-lg shadow-amber-500/20">
              RECOMMENDED
            </span>

            <div className="mb-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-lg">👑</span>
                <h2 className="text-lg font-extrabold text-white">VVIP</h2>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">{fmt(PRICES.vvip[duration])}</span>
                <span className="text-sm text-white/30">/ {DURATIONS.find((d) => d.id === duration)?.label.toLowerCase()}</span>
              </div>
              <p className="mt-1 text-xs text-white/30">Full control + priority matching</p>
            </div>

            <ul className="mb-6 flex-1 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-2.5 text-sm">
                  <svg className="h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  <span className="text-white/60">{f.label}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => handlePurchase("vvip")}
              disabled={loading !== null || authLoading || isGuest}
              className="relative w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-bold text-black transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {isGuest ? "Sign in with Google or Email" : !user && !authLoading ? "Sign in first" : `Get VVIP — ${fmt(PRICES.vvip[duration])}`}
              {vvipLoading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-amber-400" />
                </span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm font-medium text-rose-400">{error}</p>
        )}

        <p className="mt-8 text-center text-[11px] text-white/15">
          One-time payment · No recurring charges · Instant activation · Time stacks if you buy again
        </p>
      </main>
    </div>
  );
}
