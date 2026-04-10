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
		<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/5 bg-black/40 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
			<div className="flex items-center gap-3 sm:gap-8">
				<Link href="/" aria-label="Go to home page">
					<Image
						src="/asstes/logo/logologoheartandtempetedchat.png"
						alt="TEMPTED.CHAT"
						width={160}
						height={32}
						className="h-7 w-auto sm:h-8"
						priority
					/>
				</Link>
				<div className="hidden gap-6 text-sm font-medium text-white/50 md:flex">
					<Link href="/" className="transition hover:text-white">Home</Link>
					<Link href="/safety" className="transition hover:text-white">Safety</Link>
					<Link href="/about" className="transition hover:text-white">About</Link>
				</div>
			</div>
			<div className="relative" ref={menuRef}>
				<button
					type="button"
					onClick={() => setIsMenuOpen((prev) => !prev)}
					disabled={isWorking}
					aria-label="Open settings"
					className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
				>
					<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
						<circle cx="12" cy="12" r="3" />
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 8.9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.61.76 1.03 1.4 1.05H21a2 2 0 0 1 0 4h-.09c-.64.02-1.2.44-1.4 1.05z" />
					</svg>
				</button>

				{isMenuOpen ? (
					<div className="absolute right-0 mt-2 min-w-36 rounded-xl border border-white/15 bg-[#121217] p-2 shadow-[0_20px_40px_rgba(0,0,0,0.45)]">
						{isAuthenticated ? (
							<>
								{isAdmin && onGoToAdmin ? (
									<button
										type="button"
										onClick={onGoToAdmin}
										disabled={isWorking}
										className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
									>
										Admin Dashboard
									</button>
								) : null}
								<button
									type="button"
									onClick={onLogout}
									disabled={isWorking}
									className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
								>
									Log Out
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={onLogin}
								disabled={isWorking}
								className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
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
