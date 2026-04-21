"use client";

import { AuthTopNav } from "@/components/auth-top-nav";
import { motion } from "framer-motion";
import { Zap, ShieldCheck, Layout, Rocket, Target, Users } from "lucide-react";

// Animation Variants
const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.15, delayChildren: 0.2 },
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function AboutPage() {
	return (
		<>
			<AuthTopNav />
			
			{/* Background Decorative Glows - Matches Safety Page */}
			<div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
				<div className="absolute top-[10%] left-[20%] h-[40%] w-[40%] rounded-full bg-violet-600/10 blur-[120px]" />
				<div className="absolute bottom-[10%] right-[10%] h-[40%] w-[40%] rounded-full bg-pink-600/10 blur-[120px]" />
			</div>

			<main className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-24 pt-32 text-white">
				{/* ── Header Section ── */}
				<motion.div 
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					className="text-center md:text-left"
				>
					<h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-7xl">
						About <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500">Tempted.Chat</span>
					</h1>
					<p className="mt-6 max-w-2xl text-lg text-white/60 leading-relaxed">
						We are redefining spontaneous human connection. Our platform is built for those who value privacy, speed, and real conversations.
					</p>
				</motion.div>

				{/* ── Core Pillars Grid ── */}
				<motion.section 
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
				>
					<AboutCard 
						icon={<Zap className="text-amber-400" />}
						title="Instant Matching"
						description="No long waits or complex profiles. Get into a text-first conversation in seconds."
					/>
					<AboutCard 
						icon={<ShieldCheck className="text-emerald-400" />}
						title="Privacy Aware"
						description="Your data is yours. We design systems that minimize footprint while maximizing connection."
					/>
					<AboutCard 
						icon={<Layout className="text-blue-400" />}
						title="Lightweight Design"
						description="A clean, distraction-free interface that keeps the focus entirely on the chat experience."
					/>
				</motion.section>

				{/* ── Mission / Direction Section ── */}
				<motion.section 
					initial={{ opacity: 0, y: 30 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.8 }}
					className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-8 md:p-16"
				>
					<div className="grid md:grid-cols-2 gap-12 items-center">
						<div>
							<div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 mb-6">
								<Rocket className="text-violet-400" />
							</div>
							<h2 className="text-3xl font-bold">Our Direction</h2>
							<p className="mt-4 text-lg text-white/50 leading-relaxed">
								Tempted.Chat isn&apos;t just a chat site; it&apos;s an evolving ecosystem. We are constantly iterating on our moderation AI, trust signals, and safety protocols to ensure a premium environment for every user.
							</p>
						</div>
						
						<div className="grid grid-cols-1 gap-4">
							<div className="flex items-start gap-4 rounded-2xl bg-white/5 p-4 border border-white/5">
								<Target className="h-6 w-6 text-pink-500 mt-1" />
								<div>
									<h4 className="font-bold">The Goal</h4>
									<p className="text-sm text-white/40">Zero friction between meeting and talking.</p>
								</div>
							</div>
							<div className="flex items-start gap-4 rounded-2xl bg-white/5 p-4 border border-white/5">
								<Users className="h-6 w-6 text-blue-500 mt-1" />
								<div>
									<h4 className="font-bold">The Community</h4>
									<p className="text-sm text-white/40">Building a space where respect is the default.</p>
								</div>
							</div>
						</div>
					</div>
				</motion.section>

				{/* ── Footer CTA ── */}
				<motion.div 
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					className="mt-20 text-center"
				>
					<p className="text-white/30 text-sm italic">
						Join thousands of users having real conversations every day.
					</p>
				</motion.div>
			</main>
		</>
	);
}

function AboutCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
	return (
		<motion.div 
			variants={itemVariants}
			whileHover={{ scale: 1.02 }}
			className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.05] hover:border-white/20"
		>
			<div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
				{icon}
			</div>
			<h3 className="text-xl font-bold text-white mb-3">{title}</h3>
			<p className="text-sm leading-relaxed text-white/50">{description}</p>
		</motion.div>
	);
}