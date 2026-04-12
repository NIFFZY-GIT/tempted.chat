"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type TopNavProps = {
	isAuthenticated: boolean;
	onLogin: () => void;
	onLogout: () => void;
	isWorking: boolean;
	isAdmin?: boolean;
	onGoToAdmin?: () => void;
};

export function TopNav({
	isAuthenticated,
	onLogin,
	onLogout,
	isWorking,
	isAdmin = false,
	onGoToAdmin,
}: TopNavProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const panelRef = useRef<HTMLDivElement | null>(null);

	/* close menu on outside click */
	useEffect(() => {
		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target as Node;
			if (menuRef.current?.contains(target) || panelRef.current?.contains(target)) return;
			setIsMenuOpen(false);
		};
		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, []);

	/* close menu on auth change */
	useEffect(() => {
		if (!isAuthenticated) setIsMenuOpen(false);
	}, [isAuthenticated]);

	/* detect scroll for glass effect */
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 10);
		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const navLinks = [
	{ href: "/", label: "Home" },
		{ href: "/plans", label: "Plans" },
		{ href: "/safety", label: "Safety" },
		{ href: "/about", label: "About" },
	];

	return (
		<>
			<nav
				className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
					scrolled
						? "bg-[#0a0a12]/80 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
						: "bg-transparent"
				}`}
			>
				{/* Subtle gradient border at bottom */}
				<div
					className={`pointer-events-none absolute bottom-0 left-0 right-0 h-px transition-opacity duration-500 ${
						scrolled ? "opacity-100" : "opacity-0"
					}`}
					style={{
						background:
							"linear-gradient(90deg, transparent, rgba(236,72,153,0.2) 20%, rgba(167,139,250,0.25) 50%, rgba(59,130,246,0.2) 80%, transparent)",
					}}
				/>

				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
					{/* ── Left: Logo ── */}
					<div className="flex items-center">
						<Link
							href="/"
							aria-label="Go to home page"
							className="group relative flex items-center rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-white/[0.04]"
						>
							<Image
								src="/asstes/logo/logologoheartandtempetedchat.png"
								alt="TEMPTED.CHAT"
								width={130}
								height={26}
								className="h-5 w-auto transition-transform duration-200 group-hover:scale-[1.02] sm:h-[22px]"
								priority
							/>
						</Link>
					</div>

					{/* ── Center: Desktop links ── */}
					<div className="hidden items-center gap-0.5 md:flex absolute left-1/2 -translate-x-1/2">
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="group relative rounded-lg px-3.5 py-2 text-[13px] font-medium text-white/40 transition-all duration-200 hover:text-white/80"
							>
								<span className="relative z-10">{link.label}</span>
								<span className="absolute inset-0 rounded-lg bg-white/[0.06] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
							</Link>
						))}
					</div>

					{/* ── Right: actions ── */}
					<div className="flex items-center gap-2">
						{isAuthenticated ? (
							<>
								{isAdmin && onGoToAdmin ? (
									<button
										type="button"
										onClick={onGoToAdmin}
										disabled={isWorking}
										className="hidden items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-white/40 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-40 md:inline-flex"
									>
										<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
											<path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
											<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
										</svg>
										Admin
									</button>
								) : null}
								<button
									type="button"
									onClick={onLogout}
									disabled={isWorking}
									className="hidden items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-white/40 transition-all duration-200 hover:bg-rose-500/[0.08] hover:text-rose-400 disabled:opacity-40 md:inline-flex"
								>
									<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
										<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
									</svg>
									Log out
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={onLogin}
								disabled={isWorking}
								className="group relative hidden overflow-hidden rounded-full px-5 py-2 text-[13px] font-semibold text-white/70 transition-all duration-300 hover:text-white active:scale-[0.97] disabled:opacity-40 md:inline-flex"
							>
								{/* Gradient border */}
								<span
									className="pointer-events-none absolute inset-0 rounded-full opacity-60 transition-opacity duration-300 group-hover:opacity-100"
									style={{
										padding: "1px",
										background: "linear-gradient(135deg, rgba(236,72,153,0.5), rgba(167,139,250,0.5), rgba(59,130,246,0.5))",
										WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
										WebkitMaskComposite: "xor",
										maskComposite: "exclude",
									}}
								/>
								<span className="pointer-events-none absolute inset-0 rounded-full bg-white/[0.04] transition-colors duration-300 group-hover:bg-white/[0.08]" />
								<span className="relative z-10">Sign in</span>
							</button>
						)}

						{/* ── Mobile hamburger ── */}
						<div className="relative md:hidden" ref={menuRef}>
							<button
								type="button"
								onClick={() => setIsMenuOpen((prev) => !prev)}
								disabled={isWorking}
								aria-label={isMenuOpen ? "Close menu" : "Open menu"}
								className="flex h-10 w-10 items-center justify-center rounded-xl text-white/40 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40"
							>
								<div className="relative h-4 w-5">
									<span
										className={`absolute left-0 h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ${
											isMenuOpen
												? "top-[7.25px] rotate-45"
												: "top-0"
										}`}
									/>
									<span
										className={`absolute left-0 top-[7.25px] h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ${
											isMenuOpen ? "opacity-0 scale-x-0" : "opacity-100"
										}`}
									/>
									<span
										className={`absolute left-0 h-[1.5px] w-full rounded-full bg-current transition-all duration-300 ${
											isMenuOpen
												? "top-[7.25px] -rotate-45"
												: "top-[14.5px]"
										}`}
									/>
								</div>
							</button>
						</div>
					</div>
				</div>
			</nav>

			{/* ── Mobile menu overlay ── */}
			<div
				className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
					isMenuOpen
						? "pointer-events-auto opacity-100"
						: "pointer-events-none opacity-0"
				}`}
				onClick={() => setIsMenuOpen(false)}
			/>

			{/* ── Mobile slide-down panel ── */}
			<div
				ref={panelRef}
				className={`fixed left-3 right-3 top-[72px] z-50 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e18]/95 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition-all duration-300 md:hidden ${
					isMenuOpen
						? "pointer-events-auto translate-y-0 opacity-100"
						: "pointer-events-none -translate-y-4 opacity-0"
				}`}
			>
				{/* Gradient glow at top */}
				<div
					className="pointer-events-none absolute top-0 left-0 right-0 h-px"
					style={{
						background:
							"linear-gradient(90deg, transparent, rgba(236,72,153,0.3) 25%, rgba(167,139,250,0.35) 50%, rgba(59,130,246,0.3) 75%, transparent)",
					}}
				/>

				<div className="p-2">
					{navLinks.map((link, i) => (
						<Link
							key={link.href}
							href={link.href}
							onClick={() => setIsMenuOpen(false)}
							className="group flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium text-white/60 transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
							style={{
								animationDelay: `${i * 50}ms`,
							}}
						>
							{link.label}
						</Link>
					))}

					<div className="mx-3 my-1.5 border-t border-white/[0.06]" />

					{isAuthenticated ? (
						<>
							{isAdmin && onGoToAdmin ? (
								<button
									type="button"
									onClick={() => {
										onGoToAdmin();
										setIsMenuOpen(false);
									}}
									disabled={isWorking}
									className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium text-white/60 transition-all duration-200 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
								>
									<svg className="h-4 w-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
										<path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
										<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
									</svg>
									Admin
								</button>
							) : null}
							<button
								type="button"
								onClick={() => {
									onLogout();
									setIsMenuOpen(false);
								}}
								disabled={isWorking}
								className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-medium text-rose-400/70 transition-all duration-200 hover:bg-rose-500/[0.08] hover:text-rose-400 disabled:opacity-40"
							>
								<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
									<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
								</svg>
								Log out
							</button>
						</>
					) : (
						<button
							type="button"
							onClick={() => {
								onLogin();
								setIsMenuOpen(false);
							}}
							disabled={isWorking}
							className="mx-2 mb-1 mt-0.5 flex w-[calc(100%-16px)] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500/20 via-violet-500/20 to-blue-500/20 px-4 py-3 text-[14px] font-semibold text-white/80 ring-1 ring-white/[0.08] transition-all duration-200 hover:from-pink-500/30 hover:via-violet-500/30 hover:to-blue-500/30 hover:text-white disabled:opacity-40"
						>
							Sign in
						</button>
					)}
				</div>
			</div>
		</>
	);
}
