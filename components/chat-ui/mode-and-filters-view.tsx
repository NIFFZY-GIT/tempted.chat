"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
	MessageCircle, Video, Zap, Globe, X, Plus, 
	Settings2, Rocket, ChevronRight, Cpu, Crown, 
	ArrowUpRight, Sparkles 
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

	const activeFiltersCount = [
		gender !== "Any", ageGroup !== "Any age", 
		style !== "Any style", country !== "Any", hideCountry
	].filter(Boolean).length;

	const handleStart = () => {
		onStart(selectedMode, { gender, ageGroup, style, country, hideCountry }, undefined, interests);
	};

	return (
		<section className="relative flex h-[100dvh] w-full flex-col items-center justify-start overflow-hidden bg-[#020203] font-sans selection:bg-pink-500/30">
			
			{/* ─── DYNAMIC COLORFUL AURA BG ─── */}
			<div className="absolute inset-0 z-0 pointer-events-none">
				<div className="absolute top-[-5%] left-[-5%] w-[80%] h-[70%] rounded-full bg-violet-600/10 blur-[120px] animate-aura-slow" />
				<div className="absolute bottom-[0%] right-[-10%] w-[70%] h-[60%] rounded-full bg-blue-600/10 blur-[110px] animate-aura-medium" />
				<div className="absolute top-[20%] right-[0%] w-[50%] h-[50%] rounded-full bg-pink-600/10 blur-[100px] animate-aura-fast" />
			</div>

			{/* ─── SCROLLABLE MAIN CONTENT ─── */}
			<div className="relative z-10 flex w-full flex-col items-center overflow-y-auto no-scrollbar px-6 pt-16 pb-20">
				
				{/* BRANDING */}
				<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
					<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.4em] text-white/30 mb-8">
						<Cpu size={12} className="text-pink-500" /> Secure Encryption
					</div>
					<Image src="/asstes/logo/logologoheartandtempetedchat.png" alt="Logo" width={180} height={36} className="mx-auto brightness-200 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
				</motion.div>

				{/* MODE SWITCHER */}
				<div className="w-full max-w-[400px] flex p-1.5 bg-white/[0.03] border border-white/[0.08] backdrop-blur-3xl rounded-[2.5rem] mb-10 shadow-2xl">
					{(['text', 'video'] as const).map((m) => (
						<button
							key={m}
							onClick={() => setSelectedMode(m)}
							className={`relative flex-1 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-700 ${
								selectedMode === m ? "text-black" : "text-white/20 hover:text-white/40"
							}`}
						>
							{selectedMode === m && (
								<motion.div layoutId="posh-pill" className="absolute inset-0 bg-white shadow-[0_0_30px_rgba(255,255,255,0.3)] rounded-[2rem]" transition={{ type: "spring", bounce: 0.1, duration: 0.8 }} />
							)}
							<span className="relative z-10 flex items-center justify-center gap-2">
								{m === 'text' ? <MessageCircle size={14} /> : <Video size={14} />} {m}
							</span>
						</button>
					))}
				</div>

				{/* INTERESTS */}
				<div className="w-full max-w-[400px] mb-2 space-y-4">
					<div className="flex flex-wrap gap-2 min-h-[40px] px-2">
						<AnimatePresence>
							{interests.map((tag) => (
								<motion.span 
									key={tag} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
									className="px-4 py-2 rounded-2xl bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[10px] font-black uppercase flex items-center gap-2"
								>
									{tag} <X size={12} className="cursor-pointer" onClick={() => setInterests(interests.filter(i => i !== tag))} />
								</motion.span>
							))}
						</AnimatePresence>
					</div>
					<div className="relative">
						<Plus className="absolute left-5 top-1/2 -translate-y-1/2 text-white/10" size={20} />
						<input 
							value={intInput} onChange={e => setIntInput(e.target.value)}
							onKeyDown={e => e.key === 'Enter' && interests.length < 10 && intInput.trim() && (setInterests([...interests, intInput.trim().toLowerCase()]), setIntInput(""))}
							placeholder="DEFINE INTERESTS..."
							className="w-full bg-white/[0.02] border border-white/5 rounded-[2rem] py-6 pl-14 pr-6 text-xs font-bold text-white uppercase tracking-widest outline-none focus:border-white/20 transition-all"
						/>
					</div>
				</div>

				{/* ─── REVENUE UNLOCK BUTTON (FIXED POSITION & GLOW) ─── */}
				{!hasActiveSubscription ? (
					<motion.button
						whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
						onClick={onShowPaywall}
						className="w-full max-w-[400px] mt-12 mb-10 group relative overflow-hidden rounded-[2.5rem] p-[1px] bg-gradient-to-r from-amber-500/50 via-amber-200 to-amber-600/50 shadow-[0_15px_40px_rgba(245,158,11,0.1)]"
					>
						{/* Inner Dark Content Holder */}
						<div className="relative flex items-center justify-between bg-[#080808] rounded-[2.45rem] p-6 transition-colors duration-500 group-hover:bg-black">
							<div className="flex items-center gap-4">
								<div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
									<Crown className="animate-pulse" size={24} />
								</div>
								<div className="text-left">
									<h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500">Unlock VVIP Filters</h4>
									<p className="text-[9px] font-bold text-white/20 uppercase mt-0.5 tracking-tighter">Global • Age • Priority</p>
								</div>
							</div>
							{/* Improved Arrow Visibility */}
							<div className="h-8 w-8 rounded-full bg-white/[0.03] flex items-center justify-center border border-white/5">
								<ArrowUpRight className="text-amber-500 opacity-60 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={16} />
							</div>
						</div>
						
						{/* Subtle hover shimmer that doesn't blind the user */}
						<div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-r from-white via-transparent to-white pointer-events-none" />
					</motion.button>
				) : (
					<div className="h-12" /> // Spacing if already subscribed
				)}

				{/* PRIMARY ACTION */}
				<button
					onClick={handleStart}
					className="group relative w-full max-w-[400px] py-7 bg-white text-black rounded-full font-black text-sm uppercase tracking-[0.5em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl overflow-hidden mb-6"
				>
					<span className="relative z-10 flex items-center justify-center gap-3">
						Start Session <Rocket size={18} />
					</span>
					<div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-transparent to-blue-500/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
				</button>

				{/* FILTER TRIGGER */}
				<button
					onClick={() => { if (!hasActiveSubscription) { onShowPaywall?.(); return; } setShowFilters(true); }}
					className="flex items-center gap-2 text-white/20 hover:text-white/40 transition-all group py-4"
				>
					<Settings2 size={16} className="group-hover:rotate-45 transition-transform" />
					<span className="text-[9px] font-black uppercase tracking-[0.4em]">Filter Settings</span>
					{activeFiltersCount > 0 && <span className="text-pink-500 ml-1 text-[10px] font-black">{activeFiltersCount}</span>}
				</button>
			</div>

			{/* ─── FILTER DRAWER ─── */}
			<AnimatePresence>
				{showFilters && (
					<>
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFilters(false)} className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100]" />
						<motion.div 
							initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 200 }}
							className="fixed inset-x-0 bottom-0 z-[101] max-h-[85vh] bg-[#080808] border-t border-white/10 rounded-t-[3.5rem] flex flex-col overflow-hidden shadow-[0_-20px_80px_rgba(0,0,0,1)]"
						>
							<div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-5 mb-2" />
							<div className="p-10 pb-8 flex justify-between items-center border-b border-white/[0.03]">
								<div>
									<h3 className="text-2xl font-black uppercase tracking-tighter italic">Refine</h3>
									<p className="text-white/20 text-[9px] font-black uppercase tracking-[0.3em] mt-1">Configure matchmaking</p>
								</div>
								<button onClick={() => setShowFilters(false)} className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5 active:scale-90"><X size={20} /></button>
							</div>

							<div className="flex-1 overflow-y-auto px-10 pt-10 space-y-16 no-scrollbar pb-40">
								<FilterSection label="Target Identity">
									{["Any", "Male", "Female", "Other"].map(o => (
										<FilterPill key={o} label={o} active={gender === o} onClick={() => setGender(o as any)} color="pink" />
									))}
								</FilterSection>

								<FilterSection label="Match Intensity">
									{["Any style", "Casual", "Intimate"].map(o => (
										<FilterPill key={o} label={o === "Any style" ? "Any" : o} active={style === o} onClick={() => setStyle(o as any)} color="pink" />
									))}
								</FilterSection>

								{subscriptionTier === 'vvip' && (
									<div className="space-y-10 border-t border-white/5 pt-12">
										<label className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 flex items-center gap-2">
											<Crown size={14} /> VVIP Reach
										</label>
										<FilterSection label="Age Group">
											{["Any age", "Under 18", "18-25", "25+"].map(o => (
												<FilterPill key={o} label={o} active={ageGroup === o} onClick={() => setAgeGroup(o as any)} color="amber" />
											))}
										</FilterSection>
										<button className="w-full py-6 px-8 rounded-[2rem] bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all">
											<div className="flex items-center gap-4"><Globe size={18} /> {country === 'Any' ? 'Global Hub' : getCountryLabel(country)}</div>
											<ChevronRight size={16} />
										</button>
									</div>
								)}
							</div>

							<div className="absolute bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black via-black to-transparent">
								<button onClick={handleStart} className="w-full py-6 bg-white text-black rounded-full font-black uppercase text-[11px] tracking-[0.5em] shadow-2xl active:scale-95 transition-all">
									Confirm Criteria
								</button>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			<style jsx global>{`
				@keyframes aura-slow { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(8%, 8%); } }
				@keyframes aura-medium { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-8%, -4%); } }
				@keyframes aura-fast { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(4%, -8%); } }
				.animate-aura-slow { animation: aura-slow 18s infinite ease-in-out; }
				.animate-aura-medium { animation: aura-medium 14s infinite ease-in-out; }
				.animate-aura-fast { animation: aura-fast 11s infinite ease-in-out; }
				.no-scrollbar::-webkit-scrollbar { display: none; }
				.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
			`}</style>
		</section>
	);
}

// ─── POSH HELPERS ───

function FilterSection({ label, children }: { label: string, children: React.ReactNode }) {
	return (
		<div className="space-y-6">
			<label className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 ml-1">{label}</label>
			<div className="flex flex-wrap gap-3">{children}</div>
		</div>
	);
}

function FilterPill({ label, active, onClick, color }: { label: string, active: boolean, onClick: () => void, color: 'pink' | 'amber' }) {
	const activeCls = color === 'pink' ? "bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-600/20" : "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20";
	return (
		<button 
			onClick={onClick}
			className={`px-7 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
				active ? activeCls : "bg-white/[0.02] border-white/5 text-white/20 hover:text-white"
			}`}
		>
			{label}
		</button>
	);
}