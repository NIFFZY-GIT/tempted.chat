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
	const menuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const handleOutsideClick = (event: MouseEvent) => {
			if (!menuRef.current) {
				return;
			}
			if (!menuRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleOutsideClick);
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, []);

	useEffect(() => {
		if (!isAuthenticated) {
			setIsMenuOpen(false);
		}
	}, [isAuthenticated]);

	return (
		<nav className="fixed top-0 left-0 right-0 z-50">
			<div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
				{/* Left — Logo + nav links */}
				<div className="flex items-center gap-2">
					<Link href="/" aria-label="Go to home page" className="mr-1 transition-opacity hover:opacity-80">
						<Image
							src="/asstes/logo/logologoheartandtempetedchat.png"
							alt="TEMPTED.CHAT"
							width={130}
							height={26}
							className="h-5 w-auto sm:h-[22px]"
							priority
						/>
					</Link>

					<div className="hidden items-center md:flex">
						<Link href="/" className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/75">Home</Link>
						<Link href="/safety" className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/75">Safety</Link>
						<Link href="/about" className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/75">About</Link>
					</div>
				</div>

				{/* Right — actions */}
				<div className="flex items-center gap-1.5">
					{isAuthenticated ? (
						<>
							{isAdmin && onGoToAdmin ? (
								<button
									type="button"
									onClick={onGoToAdmin}
									disabled={isWorking}
									className="hidden rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/75 disabled:opacity-40 sm:inline-flex"
								>
									Admin
								</button>
							) : null}
							<button
								type="button"
								onClick={onLogout}
								disabled={isWorking}
								className="hidden rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/[0.06] hover:text-rose-400/80 disabled:opacity-40 sm:inline-flex"
							>
								Log out
							</button>
						</>
					) : (
						<button
							type="button"
							onClick={onLogin}
							disabled={isWorking}
							className="hidden rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-[13px] font-semibold text-white/60 transition-all duration-150 hover:bg-white/[0.08] hover:text-white active:scale-[0.97] disabled:opacity-40 sm:inline-flex"
						>
							Sign in
						</button>
					)}

					{/* Mobile hamburger */}
					<div className="relative sm:hidden" ref={menuRef}>
						<button
							type="button"
							onClick={() => setIsMenuOpen((prev) => !prev)}
							disabled={isWorking}
							aria-label="Open menu"
							className="flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40"
						>
							{isMenuOpen ? (
								<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
							) : (
								<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
							)}
						</button>

						{isMenuOpen && (
							<div className="animate-pop-in absolute right-0 mt-2 min-w-[180px] rounded-2xl border border-white/[0.06] bg-[#0e0e16]/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
								<Link href="/" onClick={() => setIsMenuOpen(false)} className="flex rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-white/60 transition-all duration-150 hover:bg-white/[0.06] hover:text-white">Home</Link>
								<Link href="/safety" onClick={() => setIsMenuOpen(false)} className="flex rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-white/60 transition-all duration-150 hover:bg-white/[0.06] hover:text-white">Safety</Link>
								<Link href="/about" onClick={() => setIsMenuOpen(false)} className="flex rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-white/60 transition-all duration-150 hover:bg-white/[0.06] hover:text-white">About</Link>
								<div className="my-1 border-t border-white/[0.04]" />
								{isAuthenticated ? (
									<>
										{isAdmin && onGoToAdmin ? (
											<button
												type="button"
												onClick={() => { onGoToAdmin(); setIsMenuOpen(false); }}
												disabled={isWorking}
												className="flex w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] font-medium text-white/60 transition-all duration-150 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
											>
												Admin
											</button>
										) : null}
										<button
											type="button"
											onClick={() => { onLogout(); setIsMenuOpen(false); }}
											disabled={isWorking}
											className="flex w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] font-medium text-rose-400/70 transition-all duration-150 hover:bg-rose-500/[0.08] hover:text-rose-400 disabled:opacity-40"
										>
											Log out
										</button>
									</>
								) : (
									<button
										type="button"
										onClick={() => { onLogin(); setIsMenuOpen(false); }}
										disabled={isWorking}
										className="flex w-full rounded-xl px-3.5 py-2.5 text-left text-[13px] font-medium text-white/60 transition-all duration-150 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
									>
										Sign in
									</button>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
}
