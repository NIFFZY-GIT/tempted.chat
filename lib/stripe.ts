import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export type PlanTier = "vip" | "vvip";
export type PlanDuration = "1h" | "24h" | "7d" | "30d";
export type PlanId = `${PlanTier}_${PlanDuration}`;

export type SubscriptionPlan = {
  id: PlanId;
  tier: PlanTier;
  duration: PlanDuration;
  name: string;
  description: string;
  durationMs: number;
  price: number; // in cents
  currency: string;
  badge?: string;
  popular?: boolean;
};

const DURATIONS: { id: PlanDuration; label: string; ms: number }[] = [
  { id: "1h", label: "1 Hour", ms: 1 * 60 * 60 * 1000 },
  { id: "24h", label: "24 Hours", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7 Days", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "30 Days", ms: 30 * 24 * 60 * 60 * 1000 },
];

const VIP_PRICES: Record<PlanDuration, number> = {
  "1h": 99,
  "24h": 249,
  "7d": 599,
  "30d": 999,
};

const VVIP_PRICES: Record<PlanDuration, number> = {
  "1h": 199,
  "24h": 499,
  "7d": 999,
  "30d": 1999,
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  ...DURATIONS.map((d): SubscriptionPlan => ({
    id: `vip_${d.id}`,
    tier: "vip",
    duration: d.id,
    name: `VIP ${d.label}`,
    description: `${d.label} of VIP filters`,
    durationMs: d.ms,
    price: VIP_PRICES[d.id],
    currency: "usd",
    popular: d.id === "24h",
    badge: d.id === "30d" ? "Best Value" : d.id === "7d" ? "Save 40%" : undefined,
  })),
  ...DURATIONS.map((d): SubscriptionPlan => ({
    id: `vvip_${d.id}`,
    tier: "vvip",
    duration: d.id,
    name: `VVIP ${d.label}`,
    description: `${d.label} of full control`,
    durationMs: d.ms,
    price: VVIP_PRICES[d.id],
    currency: "usd",
    popular: d.id === "7d",
    badge: d.id === "30d" ? "Best Value" : d.id === "7d" ? "Most Popular" : undefined,
  })),
];

export const getPlanById = (id: PlanId): SubscriptionPlan | undefined =>
  SUBSCRIPTION_PLANS.find((plan) => plan.id === id);
