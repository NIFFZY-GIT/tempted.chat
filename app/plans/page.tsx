"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import type { PlanId, PlanTier } from "@/lib/stripe";
import { TopNav } from "@/components/navbar";
import { getUserRole } from "@/lib/admin";
import { motion, AnimatePresence } from "framer-motion";
import { 
	Check, 
	X, 
	ChevronLeft, 
	ShieldCheck, 
	AlertTriangle,
	Loader2,
	ArrowRight,
	Clock,
	Calendar,
} from "lucide-react";

// --- Types & Constants ---
type Duration = "1h" | "24h" | "7d" | "30d";

const DURATIONS: { id: Duration; label: string }[] = [
	{ id: "1h", label: "1 Hour" },
	{ id: "24h", label: "24 Hours" },
	{ id: "7d", label: "7 Days" },
	{ id: "30d", label: "30 Days" },
];

const PRICES: Record<PlanTier, Record<Duration, number>> = {
	vip: { "1h": 99, "24h": 249, "7d": 599, "30d": 999 },
	vvip: { "1h": 199, "24h": 499, "7d": 999, "30d": 1999 },
};

const FEATURES = [
	{ label: "Gender filter", vip: true, vvip: true },
	{ label: "Chat style filter", vip: true, vvip: true },
	{ label: "Age filter", vip: false, vvip: true },
	{ label: "Country filter", vip: false, vvip: true },
	{ label: "Priority matching", vip: false, vvip: true },
];

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const INITIAL_NOW_MS = Date.now();

export default function PlansPage() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [authLoading, setAuthLoading] = useState(true);
	const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [duration, setDuration] = useState<Duration>("7d");
	const [subStatus, setSubStatus] = useState<{active: boolean, tier?: PlanTier, expiresAt?: number, activatedAt?: number, planId?: string} | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);

	// Auth Listener
	useEffect(() => {
		const unsub = onAuthStateChanged(auth, (u) => {
			setUser(u);
			setAuthLoading(false);
			if (u && !u.isAnonymous) {
				getUserRole(u.uid).then((role) => setIsAdmin(role === "admin")).catch(() => setIsAdmin(false));
			}
		});
		return unsub;
	}, []);

	// Subscription Check
	useEffect(() => {
		if (!user) return;
		user.getIdToken().then(token => 
			fetch(`/api/subscription?uid=${user.uid}`, { headers: { Authorization: `Bearer ${token}` }})
		).then(r => r.json()).then(setSubStatus).catch(() => {});
	}, [user]);

	const handlePurchase = async (tier: PlanTier) => {
		const planId: PlanId = `${tier}_${duration}`;
		if (!user || user.isAnonymous) { router.push("/"); return; }
		setLoadingPlan(planId);
		setError(null);
		try {
			const token = await user.getIdToken(true);
			const res = await fetch("/api/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ planId, idToken: token }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Purchase failed");
			window.location.href = data.url;
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Purchase failed");
			setLoadingPlan(null);
		}
	};

	return (
		<div className="relative min-h-screen w-full text-white overflow-x-hidden selection:bg-pink-500/30">
			{/* --- Navbar --- */}
			<TopNav 
				isAuthenticated={!!user} 
				onLogin={() => router.push("/")} 
				onLogout={() => signOut(auth)} 
				isWorking={authLoading} 
				isAdmin={isAdmin}
				onGoToAdmin={() => router.push("/admin")}
			/>

			{/* --- Fixed Background Elements --- */}
			<div className="fixed inset-0 pointer-events-none -z-10">
				<div className="absolute top-[-10%] left-[10%] h-[500px] w-[500px] rounded-full bg-pink-600/10 blur-[120px]" />
				<div className="absolute bottom-[-10%] right-[10%] h-[500px] w-[500px] rounded-full bg-amber-600/10 blur-[120px]" />
			</div>

			{/* --- Main Scrollable Content --- */}
			<main className="relative flex flex-col items-center w-full pt-[100px] sm:pt-[120px] pb-20 px-6">
				<div className="w-full max-w-4xl">
					
					{/* Status Bar */}
					<div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-10">
						<button 
							onClick={() => router.back()} 
							className="flex items-center gap-2 text-sm font-bold text-white/30 hover:text-white transition-colors group"
						>
							<ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
							Go Back
						</button>

						{isAdmin && (
							<div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-black uppercase tracking-wider">
								<ShieldCheck className="w-3.5 h-3.5" /> Admin Access Locked
							</div>
						)}
					</div>

					{/* Active Subscription Banner */}
					{subStatus?.active && subStatus.expiresAt && (
						<ActiveSubscriptionBanner
							tier={subStatus.tier!}
							planId={subStatus.planId}
							activatedAt={subStatus.activatedAt}
							expiresAt={subStatus.expiresAt}
						/>
					)}

					{/* Header */}
					<div className="text-center mb-12">
						<motion.h1 
							initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
							className="text-4xl md:text-6xl font-black tracking-tighter"
						>
							Upgrade <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-violet-500 to-amber-500">Your Match</span>
						</motion.h1>
						<p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">Select a plan to unlock advanced filters and priority connections.</p>
					</div>

					{/* Guest Warning */}
					{user?.isAnonymous && (
						<motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-10 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-4 items-center">
							<AlertTriangle className="text-amber-400 shrink-0" />
							<p className="text-xs text-amber-200/70">
								<strong className="text-amber-400">Guest Detected:</strong> Please sign in with Google or Email to prevent losing your purchase access later.
							</p>
						</motion.div>
					)}

					{/* Duration Selector */}
					<div className="flex justify-center mb-12">
						<div className="inline-flex p-1.5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
							{DURATIONS.map((d) => (
								<button
									key={d.id}
									onClick={() => setDuration(d.id)}
									className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
										duration === d.id ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/60"
									}`}
								>
									{d.label}
								</button>
							))}
						</div>
					</div>

					{/* Pricing Grid */}
					<div className="grid md:grid-cols-2 gap-6 items-stretch">
						{/* VIP CARD */}
						<PlanCard 
							tier="vip"
							price={PRICES.vip[duration]}
							durationLabel={duration}
							isLoading={loadingPlan === `vip_${duration}`}
							onPurchase={() => handlePurchase("vip")}
							disabled={authLoading || !!user?.isAnonymous}
							features={FEATURES.map(f => ({ ...f, included: f.vip }))}
						/>

						{/* VVIP CARD */}
						<PlanCard 
							tier="vvip"
							price={PRICES.vvip[duration]}
							durationLabel={duration}
							isLoading={loadingPlan === `vvip_${duration}`}
							onPurchase={() => handlePurchase("vvip")}
							disabled={authLoading || !!user?.isAnonymous}
							features={FEATURES.map(f => ({ ...f, included: f.vvip }))}
							recommended
						/>
					</div>

					{error && (
						<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 text-center text-red-400 font-bold text-sm">
							{error}
						</motion.p>
					)}

					<footer className="mt-16 text-center space-y-2">
						<p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Secure Stripe Checkout • Instant Access</p>
					</footer>
				</div>
			</main>
		</div>
	);
}

// --- Sub-component for Cards ---
type PlanCardProps = {
	tier: PlanTier;
	price: number;
	durationLabel: Duration;
	features: Array<{ label: string; included: boolean }>;
	onPurchase: () => void;
	isLoading: boolean;
	disabled: boolean;
	recommended?: boolean;
};

function PlanCard({ tier, price, durationLabel, features, onPurchase, isLoading, disabled, recommended }: PlanCardProps) {
	const isVVIP = tier === "vvip";
	
	return (
		<motion.div 
			whileHover={{ y: -5 }}
			className={`relative flex flex-col p-8 rounded-[2.5rem] border transition-all ${
				recommended 
				? "bg-amber-500/[0.03] border-amber-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.3)]" 
				: "bg-white/[0.02] border-white/10"
			}`}
		>
			{recommended && (
				<div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-black uppercase tracking-widest shadow-xl">
					Most Popular
				</div>
			)}

			<div className="mb-8">
				<div className="flex items-center gap-3 mb-6">
					<Image
						src={isVVIP ? "/asstes/vvip/vviplogo.png" : "/asstes/vip/viplogo.png"}
						alt={isVVIP ? "VVIP Badge" : "VIP Badge"}
						width={48}
						height={48}
						className="object-contain"
					/>
					<h3 className="text-xl font-black uppercase tracking-tighter">{tier} Tier</h3>
				</div>
				
				<div className="flex items-baseline gap-1">
					<AnimatePresence mode="wait">
						<motion.span 
							key={price}
							initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
							className="text-5xl font-black tracking-tight"
						>
							{fmt(price)}
						</motion.span>
					</AnimatePresence>
					<span className="text-white/20 font-bold text-sm uppercase">/ {durationLabel}</span>
				</div>
			</div>

			<ul className="space-y-4 mb-10 flex-1">
				{features.map((f) => (
					<li key={f.label} className={`flex items-center gap-3 text-sm font-medium ${f.included ? "text-white/60" : "text-white/10"}`}>
						{f.included ? (
							<Check className={`w-4 h-4 ${isVVIP ? "text-amber-400" : "text-pink-400"}`} />
						) : (
							<X className="w-4 h-4" />
						)}
						<span className={!f.included ? "line-through opacity-50" : ""}>{f.label}</span>
					</li>
				))}
			</ul>

			{/* --- PREMIUM SUBMIT BUTTON DESIGN --- */}
			<button
				onClick={onPurchase}
				disabled={disabled || isLoading}
				className="group relative w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] disabled:opacity-40 overflow-hidden"
			>
				{/* Background layer */}
				<div className={`absolute inset-0 transition-colors ${
					isVVIP 
					? "bg-gradient-to-r from-amber-500 to-orange-600" 
					: "bg-white/[0.08] hover:bg-white/[0.12]"
				}`} />

				{/* Shimmer effect */}
				<div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
				
				<span className={`relative z-10 flex items-center justify-center gap-2 ${isVVIP ? "text-black" : "text-white"}`}>
					{isLoading ? (
						<Loader2 className="w-5 h-5 animate-spin" />
					) : (
						<>Get {tier.toUpperCase()} Access <ArrowRight className="w-4 h-4" /></>
					)}
				</span>
			</button>
		</motion.div>
	);
}

// --- Active Subscription Banner ---
function ActiveSubscriptionBanner({
	tier,
	planId,
	activatedAt,
	expiresAt,
}: {
	tier: string;
	planId?: string;
	activatedAt?: number;
	expiresAt: number;
}) {
	const [now, setNow] = useState(INITIAL_NOW_MS);
	useEffect(() => {
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, []);

	const remaining = expiresAt - now;
	const totalMs = activatedAt ? expiresAt - activatedAt : null;
	const progress = totalMs ? Math.max(0, Math.min(100, (remaining / totalMs) * 100)) : null;

	const days = Math.floor(remaining / 86400000);
	const hours = Math.floor((remaining % 86400000) / 3600000);
	const mins = Math.floor((remaining % 3600000) / 60000);
	const secs = Math.floor((remaining % 60000) / 1000);

	let countdownStr = "";
	if (days > 0) countdownStr = `${days}d ${hours}h ${mins}m remaining`;
	else if (hours > 0) countdownStr = `${hours}h ${mins}m ${secs}s remaining`;
	else countdownStr = `${mins}m ${secs}s remaining`;

	// Infer friendly plan name from planId e.g. "vip_7d" -> "7 Days"
	const durationMap: Record<string, string> = { "1h": "1 Hour", "24h": "24 Hours", "7d": "7 Days", "30d": "30 Days" };
	const durationKey = planId?.split("_")[1] ?? "";
	const durationLabel = durationMap[durationKey] ?? durationKey;

	const isVVIP = tier === "vvip";
	const accentColor = isVVIP ? "#f59e0b" : "#ec4899";
	const accentBg = isVVIP ? "rgba(245,158,11,0.08)" : "rgba(236,72,153,0.08)";
	const accentBorder = isVVIP ? "rgba(245,158,11,0.25)" : "rgba(236,72,153,0.25)";

	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			style={{ background: accentBg, borderColor: accentBorder }}
			className="mb-10 rounded-3xl border p-6"
		>
			{/* Header row */}
			<div className="flex flex-wrap items-center justify-between gap-4 mb-4">
				<div className="flex items-center gap-3">
					<div
						style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
						className="p-2 rounded-xl"
					>
						<Zap style={{ color: accentColor }} className="w-5 h-5" />
					</div>
					<div>
						<p className="text-[10px] font-black uppercase tracking-widest" style={{ color: accentColor }}>Active Subscription</p>
						<p className="text-white font-black text-lg uppercase tracking-tight">
							{tier.toUpperCase()} {durationLabel && `— ${durationLabel}`}
						</p>
					</div>
				</div>
				<div className="text-right">
					<p className="text-[10px] text-white/30 uppercase tracking-widest font-bold flex items-center gap-1 justify-end">
						<Clock className="w-3 h-3" /> Expires
					</p>
					<p className="text-white font-bold text-sm">{new Date(expiresAt).toLocaleString()}</p>
				</div>
			</div>

			{/* Progress bar */}
			{progress !== null && (
				<div className="mb-3">
					<div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
						<motion.div
							className="h-full rounded-full"
							style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)` }}
							initial={false}
						/>
					</div>
				</div>
			)}

			{/* Countdown */}
			<p className="text-sm font-bold" style={{ color: accentColor }}>
				{countdownStr}
			</p>

			{/* Activated at */}
			{activatedAt && (
				<p className="mt-1 text-[11px] text-white/25 flex items-center gap-1">
					<Calendar className="w-3 h-3" /> Activated {new Date(activatedAt).toLocaleString()}
				</p>
			)}
		</motion.div>
	);
}

function Zap({ className, style }: { className?: string; style?: React.CSSProperties }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
			<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
		</svg>
	);
}