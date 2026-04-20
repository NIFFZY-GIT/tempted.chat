"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type TopNavProps = {
	isAuthenticated: boolean;
	onLogin: () => void;
	onLogout: () => void;
	isWorking: boolean; // This is important to prevent the "Sign In" flicker
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
	const pathname = usePathname();
	const menuRef = useRef<HTMLDivElement | null>(null);

	// Close menu on click outside
	useEffect(() => {
		const handleOutsideClick = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, []);

	const navLinks = [
		{ href: "/", label: "Home" },
		{ href: "/plans", label: "Plans" },
		{ href: "/lost-found", label: "Lost & Found" },
		{ href: "/safety", label: "Safety" },
		{ href: "/about", label: "About" },
		{ href: "/feedback", label: "Feedback" },
	];

	return (
		<header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-3 pointer-events-none">
			<nav
				className={`
					pointer-events-auto
					transition-all duration-500 ease-in-out
					flex items-center justify-between
					h-14 w-full max-w-6xl px-4
					rounded-2xl
					!bg-transparent !shadow-none !backdrop-blur-0 !border-transparent
				`}
			>
				{/* ── Left: Logo ── */}
				<div className="flex-shrink-0">
					<Link href="/" className="flex items-center transition-transform active:scale-95">
						<Image
							src="/asstes/logo/logologoheartandtempetedchat.png"
							alt="TEMPTED.CHAT"
							width={110}
							height={22}
							className="h-6 w-auto sm:h-7"
							priority
						/>
					</Link>
				</div>

				{/* ── Center: Desktop Links ── */}
				<div className="hidden md:flex items-center gap-1">
					{navLinks.map((link) => {
						const isActive = pathname === link.href;
						return (
							<Link
								key={link.href}
								href={link.href}
								className={`
									relative px-3 py-1.5 text-[13px] font-medium transition-all duration-200 rounded-lg
									${isActive ? "text-white" : "text-white/40 hover:text-white/80 hover:bg-white/5"}
								`}
							>
								{isActive && (
									<span className="absolute inset-0 bg-white/10 rounded-lg -z-10" />
								)}
								{link.label}
							</Link>
						);
					})}
				</div>

				{/* ── Right: Auth Logic ── */}
				<div className="flex items-center gap-2">
					{/* 
					   Logic Fix: 
					   We hide BOTH buttons if isWorking is true. 
					   This prevents the "About" page from accidentally showing "Sign In" 
					   for a split second while it's still checking your login status.
					*/}
					{!isWorking && (
						<>
							{isAuthenticated ? (
								<div className="flex items-center gap-2">
									{isAdmin && (
										<button
											onClick={onGoToAdmin}
											className="hidden sm:flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white/60 hover:bg-white/5 hover:text-white transition-all"
										>
											Admin
										</button>
									)}
									<button
										onClick={onLogout}
										className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-[12px] font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"
									>
										Log out
									</button>
								</div>
							) : (
								<button
									onClick={onLogin}
									className="relative group overflow-hidden px-5 py-1.5 text-[12px] font-bold text-white transition-all active:scale-95"
								>
									<div className="absolute inset-0 bg-white rounded-full" />
									<div className="absolute inset-0 rounded-full ring-1 ring-white/25 group-hover:ring-white/40 transition-all" />
									<span className="relative z-10 text-black">Sign In</span>
								</button>
							)}
						</>
					)}

					{/* Mobile Hamburger */}
					<button
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						className="md:hidden p-2 text-white/50 hover:text-white"
					>
						<div className="w-5 h-4 relative">
							<span className={`absolute w-full h-0.5 bg-current transition-all ${isMenuOpen ? "rotate-45 top-2" : "top-0"}`} />
							<span className={`absolute w-full h-0.5 bg-current top-1.5 transition-all ${isMenuOpen ? "opacity-0" : "opacity-100"}`} />
							<span className={`absolute w-full h-0.5 bg-current transition-all ${isMenuOpen ? "-rotate-45 top-2" : "top-3"}`} />
						</div>
					</button>
				</div>

				{/* ── Mobile Menu ── */}
				<div
					ref={menuRef}
					className={`
						absolute top-full left-4 right-4 mt-2 p-2 md:hidden
						bg-white/[0.08] border border-white/15 rounded-2xl shadow-2xl backdrop-blur-xl
						transition-all duration-300 origin-top
						${isMenuOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"}
					`}
				>
					{navLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							onClick={() => setIsMenuOpen(false)}
							className={`block px-4 py-3 rounded-xl text-[14px] ${
								pathname === link.href ? "bg-white/5 text-white" : "text-white/40"
							}`}
						>
							{link.label}
						</Link>
					))}
				</div>
			</nav>
		</header>
	);
}