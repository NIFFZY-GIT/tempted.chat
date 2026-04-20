"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
	MessageCircle, Video, Globe, X, Plus,
	Settings2, Rocket, ChevronRight, Cpu,
	ArrowUpRight, Lock
} from "lucide-react";

import { COUNTRY_OPTIONS, getCountryLabel } from "@/components/chat-ui";
import type { 
	AgeGroupFilter, ChatFilters, ChatMode, ChatStyleFilter, 
	CountryFilter, GenderFilter, ProfileGender 
} from "@/components/chat-ui";

export function ModeAndFiltersView({
	onStart,
	hasActiveSubscription = false,
	subscriptionTier = null,
	isAdmin = false,
	initialAdminProfile,
	onShowPaywall,
}: {
	onStart: (
		mode: ChatMode,
		filters: ChatFilters,
		nickname?: string,
		interests?: string[],
		adminProfileOverride?: { gender: ProfileGender; age: number; countryCode: string | null },
	) => void;
	onBack: () => void;
	hasActiveSubscription?: boolean;
	subscriptionTier?: "vip" | "vvip" | null;
	isAdmin?: boolean;
	initialAdminProfile?: { gender: ProfileGender; age: number; countryCode?: string | null };
	onShowPaywall?: () => void;
}) {
	const [selectedMode, setSelectedMode] = useState<ChatMode>("text");
	const [interests, setInterests] = useState<string[]>([]);
	const [intInput, setIntInput] = useState("");
	const [showFilters, setShowFilters] = useState(false);
	const [showCountryMenu, setShowCountryMenu] = useState(false);
	
	const [gender, setGender] = useState<GenderFilter>("Any");
	const [ageGroup, setAgeGroup] = useState<AgeGroupFilter>("Any age");
	const [style, setStyle] = useState<ChatStyleFilter>("Any style");
	const [country, setCountry] = useState<CountryFilter>("Any");
	const [hideCountry, setHideCountry] = useState(false);
	const [adminGender, setAdminGender] = useState<ProfileGender>(initialAdminProfile?.gender ?? "Other");
	const [adminAge, setAdminAge] = useState(initialAdminProfile?.age ? String(initialAdminProfile.age) : "25");
	const [adminCountryCode, setAdminCountryCode] = useState(initialAdminProfile?.countryCode ?? "Any");
	const [adminError, setAdminError] = useState<string | null>(null);

	const activeFiltersCount = [
		gender !== "Any", ageGroup !== "Any age", 
		style !== "Any style", country !== "Any", hideCountry
	].filter(Boolean).length;
	const canUseFilters = hasActiveSubscription;
	const isVvip = subscriptionTier === "vvip";

	const handleStart = () => {
		if (isAdmin) {
			const parsedAdminAge = Number(adminAge);
			if (!Number.isInteger(parsedAdminAge) || parsedAdminAge < 5 || parsedAdminAge > 99) {
				setAdminError("Admin age must be between 5 and 99.");
				return;
			}

			setAdminError(null);
			onStart(
				selectedMode,
				{ gender, ageGroup, style, country, hideCountry },
				undefined,
				interests,
				{ gender: adminGender, age: parsedAdminAge, countryCode: adminCountryCode === "Any" ? null : adminCountryCode },
			);
			return;
		}

		onStart(selectedMode, { gender, ageGroup, style, country, hideCountry }, undefined, interests);
	};

	return (
		<section className="relative flex min-h-[100dvh] w-full flex-col items-center justify-start overflow-hidden bg-[#050507] font-sans selection:bg-pink-500/30">
			
			{/* ─── ANIMATED COLORFUL BG BLOBS ─── */}
			<div className="absolute inset-0 z-0 pointer-events-none">
				<div className="absolute top-[-5%] left-[-5%] w-[80%] h-[70%] rounded-full bg-fuchsia-700/10 blur-[120px] animate-aura-slow" />
				<div className="absolute bottom-[0%] right-[-10%] w-[70%] h-[60%] rounded-full bg-cyan-700/10 blur-[110px] animate-aura-medium" />
				<div className="absolute top-[20%] right-[0%] w-[50%] h-[50%] rounded-full bg-rose-700/10 blur-[100px] animate-aura-fast" />
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.07),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.04),transparent_40%)]" />
			</div>

			{/* ─── MOBILE SCROLL AREA (MOBILE-FIRST) ─── */}
			<div className="relative z-10 flex w-full flex-col items-center overflow-y-auto no-scrollbar px-4 sm:px-6 lg:px-8 pt-[calc(env(safe-area-inset-top)+5.5rem)] sm:pt-[calc(env(safe-area-inset-top)+6rem)] pb-8 sm:pb-12 max-w-4xl mx-auto">
				
				{/* BRANDING */}
				<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="text-center mb-7 sm:mb-9 w-full">
					<div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 mb-4 sm:mb-6">
						<Cpu size={12} className="text-pink-400" /> End-to-end encrypted
					</div>
					<Image src="/asstes/logo/logologoheartandtempetedchat.png" alt="Logo" width={176} height={35} className="mx-auto w-36 sm:w-44 brightness-200 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
				</motion.div>

				<motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-4 sm:p-6 space-y-5 sm:space-y-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
					<motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="space-y-1">
						<h2 className="text-white text-[14px] sm:text-[16px] font-semibold tracking-[0.04em]">Start A New Match</h2>
						<p className="text-white/45 text-[11px] sm:text-[12px] font-medium">Choose mode, add interests, and refine match quality.</p>
					</motion.div>

					{/* MODE SWITCHER */}
					<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }} className="w-full flex p-1 sm:p-1.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl sm:rounded-3xl shadow-xl gap-1">
					{(['text', 'video'] as const).map((m) => (
						<button
							key={m}
							onClick={() => setSelectedMode(m)}
							className={`relative flex-1 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] transition-all duration-400 ${
								selectedMode === m ? "text-black" : "text-white/20 hover:text-white/40"
							}`}
						>
							{selectedMode === m && (
								<motion.div layoutId="posh-pill" className="absolute inset-0 bg-white shadow-[0_0_30px_rgba(255,255,255,0.25)] rounded-xl sm:rounded-2xl" transition={{ type: "spring", bounce: 0.1, duration: 0.8 }} />
							)}
							<span className="relative z-10 flex items-center justify-center gap-1 sm:gap-2">
								{m === 'text' ? <MessageCircle size={14} /> : <Video size={14} />} <span>{m}</span>
							</span>
						</button>
					))}
					</motion.div>

				{/* REVENUE BUTTON (VVIP UNLOCK) */}
					{!hasActiveSubscription && (
					<motion.button
						whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
						onClick={onShowPaywall}
						className="w-full group relative overflow-hidden rounded-2xl p-px sm:p-[1.5px] bg-gradient-to-r from-amber-500 via-amber-200 to-amber-600 shadow-[0_10px_30px_rgba(245,158,11,0.1)] sm:shadow-[0_20px_50px_rgba(245,158,11,0.15)]"
					>
					<div className="relative flex flex-row items-center justify-between bg-[#080808] rounded-[1rem] sm:rounded-[1.25rem] p-3.5 sm:p-4.5 gap-3 sm:gap-4 transition-colors group-hover:bg-[#0f0f0f]">
						<div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
								<div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
									<Image src="/asstes/vvip/vviplogo.png" alt="VVIP" width={26} height={26} className="h-6 w-6 sm:h-7 sm:w-7 object-contain" />
								</div>
								<div className="text-left min-w-0">
									<h4 className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.1em] text-amber-300 line-clamp-1">Unlock VIP Filters</h4>
									<p className="text-[10px] sm:text-[11px] font-medium text-white/50 mt-0.5 line-clamp-1">Global • Age • Priority matching</p>
								</div>
							</div>
							<ArrowUpRight className="text-amber-500 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 shrink-0" size={18} />
						{/* shimmer sweep */}
						<span className="absolute inset-0 translate-x-[-110%] group-hover:translate-x-[110%] transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg] pointer-events-none" />
						</div>
					</motion.button>
					)}

					{isAdmin && (
						<div className="w-full rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-3 sm:p-4 space-y-3">
							<div className="flex items-center justify-between gap-2">
								<p className="text-cyan-300 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.1em]">Admin Match Persona</p>
								<span className="text-white/45 text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.08em]">Applied before join</span>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
								<select
									value={adminGender}
									onChange={(e) => setAdminGender(e.target.value as ProfileGender)}
									className="bg-white border border-white/40 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-black outline-none"
								>
									<option value="Male" className="text-black bg-white">Male</option>
									<option value="Female" className="text-black bg-white">Female</option>
									<option value="Other" className="text-black bg-white">Other</option>
								</select>
								<input
									value={adminAge}
									onChange={(e) => setAdminAge(e.target.value.replace(/[^0-9]/g, ""))}
									placeholder="Age"
									className="bg-white border border-white/40 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-black placeholder:text-black/40 outline-none"
								/>
								<select
									value={adminCountryCode}
									onChange={(e) => setAdminCountryCode(e.target.value)}
									className="bg-white border border-white/40 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-black outline-none"
								>
									<option value="Any" className="text-black bg-white">Any country</option>
									{COUNTRY_OPTIONS.map((option) => (
										<option key={option.code} value={option.code} className="text-black bg-white">{option.label}</option>
									))}
								</select>
							</div>
							{adminError && <p className="text-rose-300 text-[10px] sm:text-[11px] font-medium">{adminError}</p>}
						</div>
					)}

				{/* INTERESTS */}
					<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.38 }} className="w-full space-y-3 sm:space-y-4">
						<p className="text-white/55 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em]">Interests</p>
					<div className="flex flex-wrap gap-1.5 sm:gap-2 min-h-[36px] sm:min-h-[42px] px-1 sm:px-2">
						<AnimatePresence>
							{interests.map((tag) => (
								<motion.span 
									key={tag} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
									className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white border border-white/70 text-black text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.06em] flex items-center gap-1.5 sm:gap-2"
								>
									{tag} <X size={11} className="cursor-pointer" onClick={() => setInterests(interests.filter(i => i !== tag))} />
								</motion.span>
							))}
						</AnimatePresence>
					</div>
					<div className="relative">
						<Plus className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 text-white/100" size={17} />
						<input
							value={intInput} onChange={e => setIntInput(e.target.value)}
							onKeyDown={e => e.key === 'Enter' && interests.length < 10 && intInput.trim() && (setInterests([...interests, intInput.trim().toLowerCase()]), setIntInput(""))}
							placeholder="Add interests (music, anime, travel...)"
							className="w-full bg-white/[0.02] border border-white/60 rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-10 sm:pl-12 pr-4 sm:pr-5 text-[12px] sm:text-[13px] font-medium text-white placeholder:text-white/25 outline-none focus:border-white/100 transition-all"
						/>
					</div>
					</motion.div>

					<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.44 }} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
						{/* PRIMARY START BUTTON */}
						<motion.button
						whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}
						onClick={handleStart}
						className="group relative w-full py-4 sm:py-4.5 bg-white text-black rounded-xl sm:rounded-2xl font-semibold text-[12px] sm:text-[13px] uppercase tracking-[0.12em] transition-all hover:brightness-95 shadow-xl overflow-hidden"
					>
						<span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
							Start Chat <motion.span animate={{ x: [0, 2, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}><Rocket size={15} /></motion.span>
						</span>
						<div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-transparent to-blue-500/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
						</motion.button>

						{/* FILTER SETTINGS TRIGGER */}
						{canUseFilters && (
							<motion.button
								whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
								onClick={() => setShowFilters(true)}
								className="flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-3.5 sm:py-4 rounded-lg sm:rounded-2xl transition-all group text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] sm:min-w-[210px] bg-white/[0.025] border border-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
							>
								<Settings2 size={15} className="group-hover:rotate-45 transition-transform" />
								<span>Match Filters</span>
								{activeFiltersCount > 0 && <span className="text-pink-500 text-[10px] sm:text-[11px] font-semibold ml-0.5">({activeFiltersCount})</span>}
							</motion.button>
						)}
					</motion.div>
				</motion.div>
			</div>

			{/* ─── MODERN FILTER DRAWER (MOBILE OPTIMIZED) ─── */}
			<AnimatePresence>
				{showFilters && (
					<>
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFilters(false)} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100]" />
						<motion.div 
							initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 200 }}
							className="fixed inset-x-0 bottom-0 z-[101] max-h-[90vh] sm:max-h-[85vh] bg-[#080808] border-t border-white/10 rounded-t-2xl sm:rounded-t-[3.5rem] flex flex-col overflow-hidden shadow-[0_-20px_80px_rgba(0,0,0,1)]"
						>
							{/* Drag Handle */}
							<div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-2" />

							{/* Header */}
							<div className="px-4 sm:px-10 pt-4 sm:pt-6 pb-4 sm:pb-7 flex justify-between items-center border-b border-white/[0.06] gap-4">
								<div className="min-w-0">
									<h3 className="text-xl sm:text-2xl font-semibold uppercase tracking-[0.06em]">Refine Matches</h3>
									<p className="text-white/45 text-[10px] sm:text-[11px] font-medium mt-1">Configure your matching preferences</p>
								</div>
								<button onClick={() => setShowFilters(false)} className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
									<X size={18} className="sm:w-5 sm:h-5" />
								</button>
							</div>

							{/* Filter Options (Scrollable with proper mobile padding) */}
							<div className="flex-1 overflow-y-auto px-4 sm:px-10 pt-6 sm:pt-10 space-y-10 sm:space-y-16 no-scrollbar pb-32 sm:pb-40">
								
								{/* VIP SECTION */}
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

								{/* VVIP SECTION */}
								<div className={`space-y-8 sm:space-y-10 border-t border-white/5 pt-10 sm:pt-12 ${!isVvip ? 'opacity-25 pointer-events-none' : ''}`}>
									<label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-400 flex items-center gap-2">
										<Image src="/asstes/vvip/vviplogo.png" alt="VVIP" width={14} height={14} className="h-3.5 w-3.5 sm:h-4 sm:w-4 object-contain" /> VVIP Global Node
									</label>
									
									<FilterSection label="Preferred Age Group">
										{["Any age", "Under 18", "18-25", "25+"].map(o => (
											<FilterPill key={o} label={o} active={ageGroup === o} onClick={() => isVvip && setAgeGroup(o as any)} color="amber" />
										))}
									</FilterSection>

									<div className="relative">
										<button
											onClick={() => isVvip && setShowCountryMenu((current) => !current)}
											className="w-full py-4 sm:py-5 px-4 sm:px-8 rounded-lg sm:rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50 hover:text-white transition-all"
										>
											<div className="flex items-center gap-3 sm:gap-4 min-w-0">
												<Globe size={14} className="sm:w-[18px] sm:h-[18px] shrink-0" /> 
												<span className="truncate">{country === 'Any' ? 'Global Reach' : getCountryLabel(country)}</span>
											</div>
											<ChevronRight size={14} className={`sm:w-4 sm:h-4 shrink-0 transition-transform ${showCountryMenu ? 'rotate-90' : ''}`} />
										</button>
										{isVvip && showCountryMenu && (
											<div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f14] p-2 shadow-[0_12px_34px_rgba(0,0,0,0.45)]">
												<button
													type="button"
													onClick={() => { setCountry("Any"); setShowCountryMenu(false); }}
													className={`w-full text-left rounded-xl px-3 py-2 text-[11px] transition-colors ${country === "Any" ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"}`}
												>
													Any country
												</button>
												{COUNTRY_OPTIONS.map((option) => (
													<button
														type="button"
														key={option.code}
														onClick={() => { setCountry(option.code); setShowCountryMenu(false); }}
														className={`w-full text-left rounded-xl px-3 py-2 text-[11px] transition-colors ${country === option.code ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"}`}
													>
														{option.label}
													</button>
												))}
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Fixed Drawer Footer (Prevents overlap) */}
							<div className="fixed bottom-0 left-0 right-0 p-4 sm:p-10 bg-gradient-to-t from-black via-black to-transparent z-[102]">
								<button onClick={handleStart} className="w-full py-4 sm:py-5 bg-white text-black rounded-lg sm:rounded-2xl font-semibold uppercase text-[11px] tracking-[0.1em] shadow-xl active:scale-95 transition-all">
									Confirm Criteria
								</button>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			<style jsx global>{`
				@keyframes aura-slow { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(10%, 10%); } }
				@keyframes aura-medium { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-10%, -5%); } }
				@keyframes aura-fast { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(5%, -10%); } }
				.animate-aura-slow { animation: aura-slow 15s infinite ease-in-out; }
				.animate-aura-medium { animation: aura-medium 12s infinite ease-in-out; }
				.animate-aura-fast { animation: aura-fast 10s infinite ease-in-out; }
				.no-scrollbar::-webkit-scrollbar { display: none; }
				.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
			`}</style>
		</section>
	);
}

// ─── POSH HELPERS ───

function FilterSection({ label, children }: { label: string, children: React.ReactNode }) {
	return (
		<div className="space-y-4 sm:space-y-6">
			<label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55 ml-0 sm:ml-1">{label}</label>
			<div className="flex flex-wrap gap-2 sm:gap-3">{children}</div>
		</div>
	);
}

function FilterPill({ label, active, onClick, color }: { label: string, active: boolean, onClick: () => void, color: 'pink' | 'amber' }) {
	const activeCls = color === 'pink' ? "bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-600/20" : "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20";
	return (
		<button 
			onClick={onClick}
			className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] transition-all duration-300 border ${
				active ? activeCls : "bg-white/[0.02] border-white/5 text-white/20 hover:text-white"
			}`}
		>
			{label}
		</button>
	);
}