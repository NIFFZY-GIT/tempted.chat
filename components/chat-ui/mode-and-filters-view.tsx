"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
	MessageCircle, 
	Video, 
	Zap, 
	Globe, 
	X, 
	Plus, 
	Settings2, 
	Rocket, 
	ChevronRight, 
	Sparkles, 
	Cpu,
	Crown,
	ArrowUpRight
} from "lucide-react";

import { TierLogo } from "@/components/tier-logo";
import { COUNTRY_OPTIONS, CountryFlagIcon, getCountryLabel } from "@/components/chat-ui";
import type { 
	AgeGroupFilter, ChatFilters, ChatMode, ChatStyleFilter, 
	CountryFilter, GenderFilter 
} from "@/components/chat-ui";

export function ModeAndFiltersView({
	onStart,
	hasActiveSubscription = false,
	subscriptionTier = null,
	onShowPaywall,
}: {
	onStart: (mode: ChatMode, filters: ChatFilters, nickname?: string, interests?: string[]) => void;
	onBack: () => void;
	hasActiveSubscription?: boolean;
	subscriptionTier?: "vip" | "vvip" | null;
	onShowPaywall?: () => void;
}) {
	const [selectedMode, setSelectedMode] = useState<ChatMode>("text");
	const [interests, setInterests] = useState<string[]>([]);
	const [intInput, setIntInput] = useState("");
	const [showFilters, setShowFilters] = useState(false);
	
	const [gender, setGender] = useState<GenderFilter>("Any");
	const [ageGroup, setAgeGroup] = useState<AgeGroupFilter>("Any age");
	const [style, setStyle] = useState<ChatStyleFilter>("Any style");
	const [country, setCountry] = useState<CountryFilter>("Any");
	const [hideCountry, setHideCountry] = useState(false);

	const handleStart = () => {
		onStart(selectedMode, { gender, ageGroup, style, country, hideCountry }, undefined, interests);
	};

	const activeFiltersCount = [
		gender !== "Any", ageGroup !== "Any age", 
		style !== "Any style", country !== "Any", hideCountry
	].filter(Boolean).length;

	const orbVariants = {
		animate: (i: number) => ({
			x: [0, i * 60, -i * 40, 0],
			y: [0, -i * 50, i * 70, 0],
			scale: [1, 1.3, 0.9, 1],
			opacity: [0.4, 0.7, 0.4],
			transition: {
				duration: 12 + i * 3,
				repeat: Infinity,
				ease: "easeInOut" as const
			}
		})
	};

	useEffect(() => {
		document.body.classList.add("mode-filters-page");
		return () => {
			document.body.classList.remove("mode-filters-page");
		};
	}, []);

	return (
		<section className="relative flex h-[100dvh] min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#050508]">
			
			<div className="absolute inset-0 z-0 pointer-events-none">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.08),transparent_36%),radial-gradient(circle_at_72%_24%,rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_26%_78%,rgba(244,114,182,0.1),transparent_40%)]" />
				<motion.div
					className="animated-aurora absolute -inset-[24%]"
					animate={{
						opacity: [0.5, 0.85, 0.55],
						scale: [1, 1.08, 1],
						rotate: [0, 6, -4, 0],
					}}
					transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
				/>
				<div className="animated-vignette absolute inset-0" />

				<motion.div
					custom={1.2}
					variants={orbVariants}
					animate="animate"
					className="absolute left-[6%] top-[2%] h-72 w-72 rounded-full bg-fuchsia-500/16 blur-[100px]"
				/>
				<motion.div
					custom={2.2}
					variants={orbVariants}
					animate="animate"
					className="absolute bottom-[3%] right-[8%] h-[380px] w-[380px] rounded-full bg-sky-400/16 blur-[118px]"
				/>
				<motion.div
					custom={1.8}
					variants={orbVariants}
					animate="animate"
					className="absolute right-[14%] top-[36%] h-64 w-64 rounded-full bg-amber-400/14 blur-[90px]"
				/>
				{Array.from({ length: 10 }).map((_, i) => (
					<motion.span
						key={`bg-p-${i}`}
						className="absolute h-1.5 w-1.5 rounded-full bg-white/45"
						style={{ left: `${5 + i * 9}%`, top: `${12 + ((i * 11) % 72)}%` }}
						animate={{ y: [0, -28, 0], opacity: [0.1, 0.8, 0.15] }}
						transition={{ duration: 4.5 + (i % 4), repeat: Infinity, ease: "easeInOut", delay: i * 0.22 }}
					/>
				))}
			</div>

			<motion.div
				initial={{ opacity: 0, y: 24 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
				className="relative z-10 flex w-full max-w-[420px] flex-col items-center px-6"
			>
				
				<motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
					<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-white/40 text-[9px] font-black uppercase tracking-[0.4em] mb-8">
						<Cpu size={12} className="text-pink-500 animate-pulse" /> Encryption Active
					</div>
					<Image src="/asstes/logo/logologoheartandtempetedchat.png" alt="Logo" width={190} height={38} className="mx-auto brightness-200 drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]" priority />
				</motion.div>

				<div className="w-full grid grid-cols-2 gap-4 mb-10">
					{(['text', 'video'] as const).map((m) => (
						<button
							key={m}
							onClick={() => setSelectedMode(m)}
							className={`relative flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border transition-all duration-500 active:scale-95 ${
								selectedMode === m 
								? "bg-white text-black border-white shadow-[0_0_50px_rgba(255,255,255,0.15)]" 
								: "bg-white/[0.02] border-white/5 text-white/30 hover:text-white hover:bg-white/[0.05]"
							}`}
						>
							<div className="relative z-10">{m === 'text' ? <MessageCircle size={22} /> : <Video size={22} />}</div>
							<span className="relative z-10 text-[10px] font-black uppercase tracking-widest">{m} Session</span>
							{selectedMode === m && <motion.div layoutId="glow-ring" className="absolute inset-0 bg-white blur-2xl opacity-10 -z-10" />}
						</button>
					))}
				</div>

				<div className="w-full mb-10 space-y-4">
					<div className="flex flex-wrap gap-2 min-h-[30px]">
						<AnimatePresence>
							{interests.map((tag) => (
								<motion.span key={tag} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="px-4 py-2 rounded-full bg-pink-900 text-white text-[9px] font-black uppercase flex items-center gap-2 shadow-xl shadow-pink-900/20 border border-pink-400/20">
									{tag} <X size={12} className="cursor-pointer hover:text-white/50" onClick={() => setInterests(interests.filter(i => i !== tag))} />
								</motion.span>
							))}
						</AnimatePresence>
					</div>
					<div className="relative group">
						<Plus className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-pink-500 transition-colors" size={18} />
						<input value={intInput} onChange={e => setIntInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && interests.length < 10 && intInput.trim() && (setInterests([...interests, intInput.trim().toLowerCase()]), setIntInput(""))} placeholder="DEFINE INTERESTS..." className="w-full bg-white/[0.02] border border-white/50 rounded-2xl py-6 pl-14 pr-6 text-[11px] font-bold text-white uppercase tracking-[0.2em] outline-none focus:border-white/100 focus:bg-white/[0.04] transition-all placeholder:text-white/20" />
					</div>
				</div>

				<button onClick={handleStart} className="group relative w-full py-7 bg-white text-black rounded-full font-black text-xs uppercase tracking-[0.5em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_25px_70px_rgba(255,255,255,0.1)] overflow-hidden">
					<span className="relative z-10 flex items-center justify-center gap-4">Start Session <Rocket size={18} /></span>
					<div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.08] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
				</button>

				{/* ─── REVENUE OPTIMIZED UNLOCK BUTTON ─── */}
				{!hasActiveSubscription ? (
					<motion.button
						whileHover={{ scale: 1.02, y: -2 }}
						whileTap={{ scale: 0.98 }}
						onClick={onShowPaywall}
						className="relative mt-10 w-full overflow-hidden rounded-3xl border border-amber-300/35 bg-[linear-gradient(125deg,rgba(245,158,11,0.12),rgba(251,191,36,0.06),rgba(255,255,255,0.03))] p-[1px] shadow-[0_16px_50px_rgba(245,158,11,0.22)]"
					>
						<div className="group relative flex w-full items-center justify-between rounded-[22px] bg-[#09090c]/95 px-5 py-4 backdrop-blur-xl transition-all hover:bg-[#0f0f12]">
							<div className="flex items-center gap-3.5">
								<div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-300/30">
									<TierLogo tier="vvip" size="sm" imageClassName="drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
									<span className="absolute -top-1 -right-1 rounded-full bg-amber-300 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-black">Pro</span>
								</div>
								<div className="text-left">
									<p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Unlock VVIP Filters</p>
									<p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">Country • Age • Priority matching</p>
								</div>
							</div>
							<div className="flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-400/10 px-3 py-1.5">
								<span className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">Upgrade</span>
								<ArrowUpRight size={14} className="text-amber-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
							</div>
						</div>
						
						<div className="absolute inset-0 -z-10 animate-amber-pulse bg-amber-500/20 blur-xl" />
						<div className="absolute -left-1/3 top-0 h-full w-1/3 animate-shimmer-fast bg-gradient-to-r from-transparent via-amber-100/35 to-transparent" />
					</motion.button>
				) : (
					<button
						onClick={() => setShowFilters(true)}
						className="mt-10 flex items-center gap-3 text-white/20 hover:text-white transition-all group px-6 py-3 rounded-full hover:bg-white/5 border border-white/5"
					>
						<Settings2 size={14} className="group-hover:rotate-180 transition-transform duration-700" />
						<span className="text-[10px] font-black uppercase tracking-[0.4em]">Refine Preferences</span>
						{activeFiltersCount > 0 && (
							<span className="h-5 w-5 flex items-center justify-center rounded-full bg-pink-600 text-[10px] font-black">{activeFiltersCount}</span>
						)}
					</button>
				)}
			</motion.div>

			{/* ─── Filter Drawer ─── */}
			<AnimatePresence>
				{showFilters && (
					<>
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFilters(false)} className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[60]" />
						<motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 32, stiffness: 200 }} className="fixed inset-x-0 bottom-0 max-h-[82vh] bg-[#080808] border-t border-white/10 rounded-t-[4rem] z-[70] flex flex-col overflow-hidden">
							<div className="p-12 pb-8 flex justify-between items-center border-b border-white/[0.03]">
								<div><h3 className="text-3xl font-black uppercase">Filters</h3><p className="text-white/20 text-[9px] font-black uppercase mt-2">Personalize Session Criteria</p></div>
								<button onClick={() => setShowFilters(false)} className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center border border-white/5"><X size={20} /></button>
							</div>
							<div className="flex-1 overflow-y-auto p-12 space-y-16">
								<FilterBlock label="Identity Preference">
									{["Any", "Male", "Female", "Other"].map(o => (<FilterPill key={o} label={o} active={gender === o} onClick={() => setGender(o as any)} />))}
								</FilterBlock>
								<FilterBlock label="Match Intensity">
									{["Any style", "Casual", "Intimate"].map(o => (<FilterPill key={o} label={o} active={style === o} onClick={() => setStyle(o as any)} />))}
								</FilterBlock>
								{subscriptionTier === 'vvip' && (
									<FilterBlock label="VVIP Demographics">
										<div className="flex flex-wrap gap-4">{["Any age", "Under 18", "18-25", "25+"].map(o => (<FilterPill key={o} label={o} active={ageGroup === o} onClick={() => setAgeGroup(o as any)} />))}</div>
									</FilterBlock>
								)}
							</div>
							<div className="p-12 bg-black border-t border-white/[0.05]"><button onClick={handleStart} className="w-full py-6 bg-white text-black rounded-full font-black uppercase text-[10px] tracking-[0.5em] active:scale-95 transition-all">Confirm Selection</button></div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			<style jsx global>{`
				@keyframes aurora-shift {
					0% { transform: translate3d(-8%, -4%, 0) rotate(0deg) scale(1); }
					50% { transform: translate3d(7%, 5%, 0) rotate(8deg) scale(1.05); }
					100% { transform: translate3d(-8%, -4%, 0) rotate(0deg) scale(1); }
				}
				@keyframes shimmer-fast {
					0% { transform: translateX(-220%); opacity: 0; }
					30% { opacity: 0.55; }
					100% { transform: translateX(380%); opacity: 0; }
				}
				@keyframes amber-pulse {
					0%, 100% { opacity: 0.28; }
					50% { opacity: 0.62; }
				}
				.animated-aurora {
					background:
						radial-gradient(42% 35% at 24% 34%, rgba(244,114,182,0.28), transparent 65%),
						radial-gradient(40% 33% at 78% 28%, rgba(56,189,248,0.24), transparent 67%),
						radial-gradient(30% 28% at 56% 74%, rgba(251,191,36,0.22), transparent 72%);
					filter: blur(30px) saturate(115%);
					animation: aurora-shift 18s ease-in-out infinite;
				}
				.animated-vignette {
					background: radial-gradient(circle at 50% 35%, transparent 12%, rgba(6,6,10,0.66) 58%, rgba(2,2,4,0.96) 100%);
				}
				.animate-shimmer-fast { animation: shimmer-fast 3.4s linear infinite; }
				.animate-amber-pulse { animation: amber-pulse 2.8s ease-in-out infinite; }
			`}</style>
		</section>
	);
}

function FilterBlock({ label, children }: { label: string, children: React.ReactNode }) {
	return (<div className="space-y-8"><label className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 ml-1">{label}</label><div className="flex flex-wrap gap-4">{children}</div></div>);
}

function FilterPill({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
	return (<button onClick={onClick} className={`px-8 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${active ? "bg-pink-600 text-white border-pink-500 shadow-[0_15px_40px_rgba(219,39,119,0.4)]" : "bg-white/[0.02] border-white/5 text-white/30 hover:text-white"}`}>{label}</button>);
}