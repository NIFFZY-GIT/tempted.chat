"use client";

import Image from "next/image";

export type TopNavProps = {
	isAuthenticated: boolean;
	onLogin: () => void;
	onLogout: () => void;
	isWorking: boolean;
};

export function TopNav({ isAuthenticated, onLogin, onLogout, isWorking }: TopNavProps) {
	return (
		<nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/5 bg-black/40 px-6 py-4 backdrop-blur-xl">
			<div className="flex items-center gap-8">
				<Image
					src="/asstes/logo/logologoheartandtempetedchat.png"
					alt="Logo"
					width={160}
					height={32}
					priority
				/>
				<div className="hidden gap-6 text-sm font-medium text-white/50 md:flex">
					<a href="#" className="transition hover:text-white">Home</a>
					<a href="#" className="transition hover:text-white">Safety</a>
					<a href="#" className="transition hover:text-white">About</a>
				</div>
			</div>
			<button
				type="button"
				onClick={isAuthenticated ? onLogout : onLogin}
				disabled={isWorking}
				className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/90 disabled:opacity-50"
			>
				{isAuthenticated ? "Sign Out" : "Sign In"}
			</button>
		</nav>
	);
}
