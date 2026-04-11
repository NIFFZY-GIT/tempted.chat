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
		<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#060710]/80 px-4 py-2.5 backdrop-blur-xl sm:px-6 sm:py-3">
			<div className="flex items-center gap-4 sm:gap-8">
				<Link href="/" aria-label="Go to home page">
					<Image
						src="/asstes/logo/logologoheartandtempetedchat.png"
						alt="TEMPTED.CHAT"
						width={160}
						height={32}
						className="h-6 w-auto sm:h-7"
						priority
					/>
				</Link>
				<div className="hidden gap-5 text-[13px] font-medium text-white/40 md:flex">
					<Link href="/" className="transition hover:text-white/80">Home</Link>
					<Link href="/safety" className="transition hover:text-white/80">Safety</Link>
					<Link href="/about" className="transition hover:text-white/80">About</Link>
				</div>
			</div>
			<div className="relative" ref={menuRef}>
				<button
					type="button"
					onClick={() => setIsMenuOpen((prev) => !prev)}
					disabled={isWorking}
					aria-label="Open menu"
					className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-50"
				>
					{isMenuOpen ? (
						<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
					) : (
						<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
					)}
				</button>

				{isMenuOpen ? (
					<div className="absolute right-0 mt-2 min-w-40 rounded-xl border border-white/10 bg-[#121217] p-1.5 shadow-lg">
						<div className="grid gap-0.5 md:hidden">
							<Link href="/" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">Home</Link>
							<Link href="/safety" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">Safety</Link>
							<Link href="/about" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">About</Link>
							<div className="my-1 border-t border-white/[0.06]" />
						</div>
						{isAuthenticated ? (
							<>
								{isAdmin && onGoToAdmin ? (
									<button
										type="button"
										onClick={() => { onGoToAdmin(); setIsMenuOpen(false); }}
										disabled={isWorking}
										className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
									>
										Admin
									</button>
								) : null}
								<button
									type="button"
									onClick={() => { onLogout(); setIsMenuOpen(false); }}
									disabled={isWorking}
									className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-300/80 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
								>
									Log Out
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={() => { onLogin(); setIsMenuOpen(false); }}
								disabled={isWorking}
								className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
							>
								Sign In
							</button>
						)}
					</div>
				) : null}
			</div>
		</nav>
	);
}
