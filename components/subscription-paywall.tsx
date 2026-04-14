"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { auth } from "@/lib/firebase";

export type PlanId = "1h" | "24h" | "7d" | "30d";

type Plan = {
  id: PlanId;
  name: string;
  description: string;
  price: number;
  currency: string;
  badge?: string;
  popular?: boolean;
  icon: string;
};

const PLANS: Plan[] = [
  {
    id: "1h",
    name: "Quick Pass",
    description: "1 hour",
    price: 99,
    currency: "usd",
    icon: "⚡",
  },
  {
    id: "24h",
    name: "Day Pass",
    description: "24 hours",
    price: 299,
    currency: "usd",
    popular: true,
    icon: "🔥",
  },
  {
    id: "7d",
    name: "Weekly",
    description: "7 days",
    price: 699,
    currency: "usd",
    badge: "Save 66%",
    icon: "💎",
  },
  {
    id: "30d",
    name: "VIP Monthly",
    description: "30 days",
    price: 1499,
    currency: "usd",
    badge: "Best Value",
    icon: "👑",
  },
];

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function SubscriptionPaywall({
  uid,
  onClose,
  expiresAt,
}: {
  uid: string;
  onClose: () => void;
  expiresAt: number | null;
}) {
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isActive = expiresAt !== null && expiresAt > Date.now();

  const handlePurchase = async (planId: PlanId) => {
    setLoading(planId);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) { setError("Please sign in again."); setLoading(null); return; }
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError("Session expired. Please sign in again and retry.");
          setLoading(null);
          return;
        }
        setError(data.error ?? "Something went wrong");
        setLoading(null);
        return;
      }

      const stripeInstance = await stripePromise;
      if (!stripeInstance) {
        setError("Payment system unavailable");
        setLoading(null);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md animate-fade-in-up rounded-3xl border border-white/[0.08] bg-[#0d0d14] p-6 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/40 transition hover:bg-white/[0.12] hover:text-white/70"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-2xl">
            ✨
          </div>
          <h3 className="text-xl font-bold text-white">Unlock Preferences</h3>
          <p className="mt-1.5 text-sm text-white/40">
            Filter by gender, age, style &amp; country
          </p>
          {isActive && expiresAt && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Active until {new Date(expiresAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {PLANS.map((plan) => {
            const isLoading = loading === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => handlePurchase(plan.id)}
                disabled={loading !== null}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-4 transition-all active:scale-[0.97] disabled:opacity-50 ${
                  plan.popular
                    ? "border-pink-500/40 bg-pink-500/[0.06] shadow-[0_0_20px_rgba(236,72,153,0.08)]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                    {plan.badge}
                  </span>
                )}
                {plan.popular && !plan.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-pink-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                    Popular
                  </span>
                )}
                <span className="text-2xl">{plan.icon}</span>
                <span className="text-sm font-bold text-white">{plan.name}</span>
                <span className="text-[11px] text-white/40">{plan.description}</span>
                <span className="mt-1 text-lg font-extrabold text-white">
                  {formatPrice(plan.price)}
                </span>
                {isLoading && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-pink-400" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 text-center text-xs font-medium text-rose-400">{error}</p>
        )}

        {/* Footer */}
        <p className="mt-4 text-center text-[11px] text-white/20">
          One-time payment · No recurring charges · Instant activation
        </p>
      </div>
    </div>
  );
}
