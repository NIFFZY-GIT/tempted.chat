"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/navbar";
import { motion } from "framer-motion";
import { Home, AlertCircle } from "lucide-react";
import { ParticleBackground } from "@/components/particle-background";

export default function NotFound() {
	const router = useRouter();

	return (
		<div className="relative min-h-screen w-full bg-[#050508] text-white overflow-x-hidden selection:bg-pink-500/30">
			{/* --- Navbar --- */}
			<TopNav
				isAuthenticated={false}
				onLogin={() => router.push("/")}
				onLogout={() => router.push("/")}
				isWorking={false}
			/>

			<ParticleBackground />

			{/* --- Fixed Background Effects --- */}
			<div className="fixed inset-0 pointer-events-none -z-10">
				<div className="absolute top-[20%] left-[10%] h-[500px] w-[500px] rounded-full bg-pink-600/10 blur-[130px] opacity-50" />
				<div className="absolute bottom-[20%] right-[10%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[130px] opacity-50" />
				
				{/* Large Decorative 404 Text */}
				<div className="absolute inset-0 flex items-center justify-center select-none">
					<span className="text-[30vw] font-black text-white/[0.02] leading-none">
						404
					</span>
				</div>
			</div>

			{/* --- Main Content Section --- */}
			<main className="relative flex flex-col items-center justify-center w-full min-h-screen pt-[80px] px-6">
				<div className="w-full max-w-2xl text-center">
					
					{/* Icon Badge */}
					<motion.div 
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 border border-white/10 mb-8 shadow-2xl backdrop-blur-xl"
					>
						<AlertCircle size={40} className="text-pink-500" />
					</motion.div>

					{/* Text Section */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
					>
						<p className="text-xs font-black uppercase tracking-[0.4em] text-pink-400 mb-4">
							Lost in Space
						</p>
						<h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
							Page Not <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">Found</span>
						</h1>
						<p className="text-white/40 text-lg md:text-xl max-w-md mx-auto leading-relaxed">
							The link you followed might be broken, or the page has been moved to a new dimension.
						</p>
					</motion.div>

					{/* Action Buttons */}
					<motion.div 
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
					>
						{/* --- Home Button (Shimmer) --- */}
						<Link href="/" className="group relative w-full sm:w-auto overflow-hidden rounded-2xl px-8 py-4 transition-all active:scale-[0.98]">
							<div className="absolute inset-0 bg-white text-black" />
							<div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.05] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
							
							<span className="relative z-10 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest text-black">
								<Home size={18} />
								Go Home
							</span>
						</Link>

						{/* --- Chat Button (Outline) --- */}
					
					</motion.div>

					{/* Subtle Footer */}
					<motion.p 
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.4 }}
						className="mt-20 text-[10px] font-black text-white/10 uppercase tracking-[0.5em]"
					>
						Error Code: 0x404_NULL_REF
					</motion.p>
				</div>
			</main>
		</div>
	);
}