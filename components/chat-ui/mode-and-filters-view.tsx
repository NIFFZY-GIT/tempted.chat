"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
	MessageCircle, Video, Zap, Globe, Plus, X, 
	Settings2, ShieldCheck, Crown, Rocket, ChevronRight 
} from "lucide-react";

import { TierLogo } from "@/components/tier-logo";
import { COUNTRY_OPTIONS, CountryFlagIcon, getCountryLabel } from "@/components/chat-ui";
import type { 
	AgeGroupFilter, ChatFilters, ChatMode, ChatStyleFilter, 
	CountryFilter, GenderFilter 
} from "@/components/chat-ui";

export function ModeAndFiltersView({
	onStart,
	onBack,
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
	const [interestsInput, setInterestsInput] = useState("");
	const [interests, setInterests] = useState<string[]>([]);
	const [showFilters, setShowFilters] = useState(false);
	
	// Filter States
	const [gender, setGender] = useState<GenderFilter>("Any");
	const [ageGroup, setAgeGroup] = useState<AgeGroupFilter>("Any age");
	const [style, setStyle] = useState<ChatStyleFilter>("Any style");
	const [country, setCountry] = useState<CountryFilter>("Any");
	const [hideCountry, setHideCountry] = useState(false);
	const [countryMenuOpen, setCountryMenuOpen] = useState(false);
	const countryMenuRef = useRef<HTMLDivElement | null>(null);

	// --- Logic ---
	const addInterest = (value: string) => {
		const tag = value.trim().toLowerCase();
		if (tag && interests.length < 10 && !interests.includes(tag)) {
			setInterests((prev) => [...prev, tag]);
		}
		setInterestsInput("");
	};

	const handleInterestsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			addInterest(interestsInput);
		}
	};

	const handleStart = () => {
		onStart(selectedMode, { gender, ageGroup, style, country, hideCountry }, undefined, interests);
	};

	const activeFiltersCount = [
		gender !== "Any", ageGroup !== "Any age", 
		style !== "Any style", country !== "Any", hideCountry
	].filter(Boolean).length;

	const modeConfig = {
		text: {
			accent: "59, 130, 246", // Blue
			icon: <MessageCircle size={24} />,
			label: "Text Mode",
			desc: "Secure messages & images"
		},
		video: {
			accent: "167, 139, 250", // Violet
			icon: <Video size={24} />,
			label: "Video Mode",
			desc: "Face-to-face P2P chat"
		}
	};

	const activeConfig = modeConfig[selectedMode];

	return (
		<section className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 overflow-hidden">
			
			{/* Ambient Background Glow */}
			<div 
				className="pointer-events-none fixed inset-0 transition-colors duration-1000"
				style={{
					background: `radial-gradient(circle at 50% 40%, rgba(${activeConfig.accent}, 0.15) 0%, transparent 60%)`
				}}
			/>

			<div className="relative w-full max-w-md z-10">
				
				{/* Logo Section */}
				<div className="text-center mb-10">
					<motion.div 
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
					>
						<Image
							src="/asstes/logo/logologoheartandtempetedchat.png"
							alt="TEMPTED.CHAT"
							width={180}
							height={36}
							className="mx-auto drop-shadow-2xl"
							priority
						/>
					</motion.div>
					<p className="text-white/30 text-[11px] font-black uppercase tracking-[0.3em] mt-4">
						Elite Social Connectivity
					</p>
				</div>

				{/* Mode Selector Cards */}
				<div className="grid grid-cols-2 gap-4 mb-8">
					{(["text", "video"] as const).map((m) => {
						const isActive = selectedMode === m;
						return (
							<button
								key={m}
								onClick={() => setSelectedMode(m)}
								className={`group relative flex flex-col items-center p-6 rounded-[2rem] border transition-all duration-300 ${
									isActive 
									? "bg-white/5 border-white/20 shadow-2xl scale-105" 
									: "bg-white/[0.02] border-white/5 opacity-40 hover:opacity-100"
								}`}
							>
								<div className={`mb-3 ${isActive ? 'text-white' : 'text-white/40'}`}>
									{modeConfig[m].icon}
								</div>
								<span className="text-[10px] font-black uppercase tracking-widest">{modeConfig[m].label}</span>
								
								{isActive && (
									<motion.div 
										layoutId="active-glow"
										className="absolute inset-0 rounded-[2rem] blur-2xl -z-10"
										style={{ backgroundColor: `rgba(${modeConfig[m].accent}, 0.2)` }}
									/>
								)}
							</button>
						);
					})}
				</div>

				{/* Interests Input Area */}
				<div className="mb-8 space-y-3">
					<div className="flex justify-between items-center px-1">
						<label className="text-[10px] font-black uppercase tracking-widest text-white/30">Shared Interests</label>
						<span className="text-[9px] font-bold text-white/20">{interests.length}/10</span>
					</div>
					<div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5 min-h-[56px] focus-within:border-white/10 transition-colors">
						<AnimatePresence>
							{interests.map((tag) => (
								<motion.span 
									key={tag}
									initial={{ opacity: 0, scale: 0.8 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.8 }}
									className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-white/70"
								>
									{tag}
									<button onClick={() => setInterests(interests.filter(i => i !== tag))}><X size={10} /></button>
								</motion.span>
							))}
						</AnimatePresence>
						<input 
							value={interestsInput}
							onChange={e => setInterestsInput(e.target.value)}
							onKeyDown={handleInterestsKeyDown}
							placeholder={interests.length === 0 ? "e.g. music, gaming..." : ""}
							className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/10 min-w-[100px]"
						/>
					</div>
				</div>

				{/* Main Action Area */}
				<div className="space-y-4">
					<button
						onClick={handleStart}
						className="group relative w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] overflow-hidden transition-all active:scale-95 shadow-2xl"
					>
						<div className="absolute inset-0 bg-white text-black" />
						<div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
						<span className="relative z-10 flex items-center justify-center gap-3 text-black">
							Start Session <Rocket size={18} />
						</span>
					</button>

					{/* Filter Trigger Button */}
					<button
						onClick={() => {
							if (!hasActiveSubscription) { onShowPaywall?.(); return; }
							setShowFilters(true);
						}}
						className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group"
					>
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-white/5 text-white/40 group-hover:text-white transition-colors">
								<Settings2 size={18} />
							</div>
							<span className="text-[11px] font-black uppercase tracking-widest text-white/40 group-hover:text-white">Adjust Match Filters</span>
						</div>
						<div className="flex items-center gap-2">
							{activeFiltersCount > 0 && (
								<span className="h-5 w-5 flex items-center justify-center rounded-full bg-pink-500 text-[10px] font-black">{activeFiltersCount}</span>
							)}
							{!hasActiveSubscription && <Zap size={14} className="text-amber-500" />}
							<ChevronRight size={16} className="text-white/20" />
						</div>
					</button>
				</div>
			</div>

			{/* --- Filter Modal (The "Better" Slide-up Logic) --- */}
			<AnimatePresence>
				{showFilters && (
					<>
						<motion.div 
							initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
							onClick={() => setShowFilters(false)}
							className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
						/>
						<motion.div 
							initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 25, stiffness: 200 }}
							className="fixed inset-x-0 bottom-0 max-h-[85vh] bg-[#0c0c12] border-t border-white/10 rounded-t-[3rem] z-[70] flex flex-col overflow-hidden"
						>
							<div className="p-8 pb-4 flex justify-between items-center">
								<div>
									<h3 className="text-2xl font-black tracking-tighter">Filters</h3>
									<p className="text-white/30 text-xs font-bold uppercase tracking-widest">Refine your next connection</p>
								</div>
								<button onClick={() => setShowFilters(false)} className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center"><X /></button>
							</div>

							<div className="flex-1 overflow-y-auto p-8 pt-4 space-y-10">
								{/* VIP Section */}
								<div className="space-y-6">
									<div className="flex items-center gap-3">
										<TierLogo tier="vip" size="sm" />
										<span className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-500/60">Core Filters</span>
									</div>
									
									<FilterGroup label="Who are you looking for?">
										{["Any", "Male", "Female", "Other"].map(o => (
											<FilterChip key={o} label={o} active={gender === o} onClick={() => setGender(o as any)} />
										))}
									</FilterGroup>

									<FilterGroup label="Conversation Style">
										{["Any style", "Casual", "Intimate"].map(o => (
											<FilterChip key={o} label={o} active={style === o} onClick={() => setStyle(o as any)} />
										))}
									</FilterGroup>
								</div>

								{/* VVIP Section */}
								<div className={`space-y-6 ${subscriptionTier !== 'vvip' ? 'opacity-30' : ''}`}>
									<div className="flex items-center gap-3">
										<TierLogo tier="vvip" size="sm" />
										<span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/60">Elite Filters</span>
									</div>

									<FilterGroup label="Age Range">
										{["Any age", "Under 18", "18-25", "25+"].map(o => (
											<FilterChip key={o} label={o} active={ageGroup === o} onClick={() => subscriptionTier === 'vvip' && setAgeGroup(o as any)} />
										))}
									</FilterGroup>

									<div className="space-y-3">
										<label className="text-[10px] font-black uppercase tracking-widest text-white/20">Target Country</label>
										<button className="w-full p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-sm font-bold text-white/60">
											<div className="flex items-center gap-3">
												<Globe size={16} /> {country === 'Any' ? 'Global' : getCountryLabel(country)}
											</div>
											<ChevronRight size={16} />
										</button>
									</div>
								</div>
							</div>

							<div className="p-8 bg-black/40 border-t border-white/5">
								<button 
									onClick={handleStart}
									className="w-full py-5 bg-pink-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl"
								>
									Apply & Find Match
								</button>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</section>
	);
}

// --- Internal Helper UI ---
function FilterGroup({ label, children }: { label: string, children: React.ReactNode }) {
	return (
		<div className="space-y-3">
			<label className="text-[10px] font-black uppercase tracking-widest text-white/20">{label}</label>
			<div className="flex flex-wrap gap-2">{children}</div>
		</div>
	);
}

function FilterChip({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
	return (
		<button 
			onClick={onClick}
			className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all border ${
				active 
				? "bg-pink-500/10 border-pink-500/40 text-pink-400" 
				: "bg-white/5 border-white/5 text-white/30 hover:text-white"
			}`}
		>
			{label}
		</button>
	);
}