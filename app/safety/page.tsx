"use client";

import { AuthTopNav } from "@/components/auth-top-nav";
import { motion } from "framer-motion";
import Link from "next/link";
import { Shield, AlertTriangle, EyeOff, MessageSquareX, Heart, UserCheck } from "lucide-react";

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.2 },
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function SafetyPage() {
	return (
		<>
			<AuthTopNav />
			
			{/* Background Decorative Glows */}
			<div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
				<div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-pink-500/10 blur-[120px]" />
				<div className="absolute top-[20%] -right-[10%] h-[40%] w-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
			</div>

			<main className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-24 pt-32 text-white">
				{/* ── Header Section ── */}
				<motion.div 
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					className="max-w-2xl"
				>
					<div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-medium text-pink-400 mb-6">
						<Shield className="h-3.5 w-3.5" />
						Your Safety is Our Priority
					</div>
					<h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
						Safety <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500">Center</span>
					</h1>
					<p className="mt-6 text-lg text-white/60 leading-relaxed">
						Tempted.Chat is built for respectful, consent-first conversations. We provide the tools, but safety starts with you.
					</p>
				</motion.div>

				{/* ── Guidelines Grid ── */}
				<motion.section 
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					className="mt-16 grid gap-6 sm:grid-cols-2"
				>
					<h2 className="sr-only">Community Guidelines</h2>
					
					<SafetyCard 
						icon={<Heart className="text-pink-500" />}
						title="Respect is Mandatory"
						description="Harassment, hate speech, and threats have a zero-tolerance policy. Be kind or be gone."
					/>
					<SafetyCard 
						icon={<EyeOff className="text-violet-500" />}
						title="Protect Your Privacy"
						description="Never share your phone number, home address, or private social media handles in public chats."
					/>
					<SafetyCard 
						icon={<MessageSquareX className="text-blue-500" />}
						title="No Pressure"
						description="Don't pressure others for images, calls, or private details. Consent is the only way we play."
					/>
					<SafetyCard 
						icon={<AlertTriangle className="text-amber-500" />}
						title="Trust Your Gut"
						description="If a conversation feels off, leave. You have the power to block and report abusive behavior instantly."
					/>
				</motion.section>

				{/* ── Quick Tips Footer ── */}
				<motion.section 
					initial={{ opacity: 0, scale: 0.95 }}
					whileInView={{ opacity: 1, scale: 1 }}
					viewport={{ once: true }}
					className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8 md:p-12"
				>
					<div className="flex flex-col md:flex-row items-center gap-8">
						<div className="flex-1">
							<h2 className="text-2xl font-bold flex items-center gap-3">
								<UserCheck className="text-green-400" />
								Safety Pro-Tips
							</h2>
							<div className="mt-4 grid gap-4 text-white/70">
								<p>• Use a <strong>unique nickname</strong> that doesn&apos;t reveal your real name.</p>
								<p>• Be cautious of users who try to move you to <strong>third-party apps</strong> too quickly.</p>
								<p>• Remember: You are never obligated to stay in a chat that makes you uncomfortable.</p>
							</div>
						</div>
						<Link
							href="/feedback"
							className="whitespace-nowrap rounded-2xl bg-white px-8 py-4 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95"
						>
							Report an Incident
						</Link>
					</div>
				</motion.section>

				<motion.section
					initial={{ opacity: 0, y: 14 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					className="mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-5 text-sm leading-relaxed text-amber-100/90"
				>
					<h2 className="text-base font-semibold text-amber-100">Responsibility Notice</h2>
					<p className="mt-2">
						By logging in, creating an account, or using this site, you agree to follow our safety rules and community standards.
					</p>
					<p className="mt-2">
						Tempted.Chat does not accept responsibility for user actions or any harm caused by interactions between users.
						 If someone violates the rules, please report it immediately via the feedback page.
					</p>
				</motion.section>
			</main>
		</>
	);
}

function SafetyCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
	return (
		<motion.div 
			variants={itemVariants}
			whileHover={{ y: -5 }}
			className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition-colors hover:bg-white/[0.06]"
		>
			<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 transition-transform group-hover:scale-110">
				{icon}
			</div>
			<h3 className="text-xl font-bold text-white">{title}</h3>
			<p className="mt-3 text-sm leading-relaxed text-white/50">{description}</p>
			
			{/* Decorative Corner Accent */}
			<div className="absolute -right-4 -bottom-4 h-12 w-12 rounded-full bg-white/5 blur-xl group-hover:bg-white/10" />
		</motion.div>
	);
}