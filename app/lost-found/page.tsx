"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
	addDoc,
	collection,
	doc,
	onSnapshot,
	orderBy,
	query,
	runTransaction,
	serverTimestamp,
	type Timestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { getUserRole } from "@/lib/admin";
import { TopNav } from "@/components/navbar";
import { motion, AnimatePresence } from "framer-motion";
import { 
	Search, 
	Plus, 
	CheckCircle2, 
	Clock, 
	Mail, 
	User as UserIcon, 
	AlertCircle,
	X,
	MessageSquare
} from "lucide-react";

// --- Types & Helpers ---
type LostFoundPost = {
	id: string;
	lookingForName: string;
	message: string;
	contact: string;
	createdByUid: string;
	createdAtMs: number;
	status: "open" | "claimed";
	claimedAtMs?: number;
};

const toMillis = (value: unknown): number => {
	if (typeof value === "number") return value;
	const maybeTimestamp = value as Timestamp | undefined;
	if (maybeTimestamp && typeof maybeTimestamp.toMillis === "function") return maybeTimestamp.toMillis();
	return Date.now();
};

const formatDate = (valueMs: number): string => {
	try {
		const date = new Date(valueMs);
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
	} catch {
		return "Unknown time";
	}
};

// --- Animation Variants ---
const containerVariants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
	hidden: { opacity: 0, y: 15 },
	visible: { opacity: 1, y: 0 }
};

export default function LostFoundPage() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(auth.currentUser);
	const [isAdmin, setIsAdmin] = useState(false);
	const [loadingAuth, setLoadingAuth] = useState(true);
	const [posts, setPosts] = useState<LostFoundPost[]>([]);
	const [loadingPosts, setLoadingPosts] = useState(true);

	// Form State
	const [lookingForName, setLookingForName] = useState("");
	const [message, setMessage] = useState("");
	const [contact, setContact] = useState("");
	const [createPostOpen, setCreatePostOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [claimingPostId, setClaimingPostId] = useState<string | null>(null);
	const [claimContactModal, setClaimContactModal] = useState<{ contact: string } | null>(null);

	// Auth Listener
	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
			setUser(nextUser);
			setLoadingAuth(false);
			if (nextUser) {
				getUserRole(nextUser.uid).then((role) => setIsAdmin(role === "admin"));
			} else {
				setIsAdmin(false);
			}
		});
		return () => unsubscribe();
	}, []);

	// Real-time Posts Listener
	useEffect(() => {
		const postsQuery = query(collection(db, "lostFoundPosts"), orderBy("createdAt", "desc"));
		const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
			const nextPosts: LostFoundPost[] = [];
			snapshot.forEach((postDoc) => {
				const data = postDoc.data() as any;
				nextPosts.push({
					id: postDoc.id,
					lookingForName: data.lookingForName || "Unknown",
					message: data.message || "",
					contact: data.contact || "",
					createdByUid: data.createdByUid || "",
					createdAtMs: typeof data.createdAtMs === "number" ? data.createdAtMs : toMillis(data.createdAt),
					status: data.status === "claimed" ? "claimed" : "open",
					claimedAtMs: typeof data.claimedAtMs === "number" ? data.claimedAtMs : toMillis(data.claimedAt),
				});
			});
			setPosts(nextPosts);
			setLoadingPosts(false);
		}, () => setLoadingPosts(false));
		return () => unsubscribe();
	}, []);

	const stats = useMemo(() => ({
		total: posts.length,
		claimed: posts.filter(p => p.status === "claimed").length,
		open: posts.filter(p => p.status === "open").length
	}), [posts]);

	const handleCreatePost = async (e: FormEvent) => {
		e.preventDefault();
		if (!user || submitting) return;

		if (!lookingForName.trim() || !message.trim() || !contact.trim()) {
			setSubmitError("All fields are required.");
			return;
		}

		setSubmitting(true);
		try {
			await addDoc(collection(db, "lostFoundPosts"), {
				lookingForName: lookingForName.trim(),
				message: message.trim(),
				contact: contact.trim(),
				createdByUid: user.uid,
				status: "open",
				createdAt: serverTimestamp(),
				createdAtMs: Date.now(),
			});
			setLookingForName(""); setMessage(""); setContact("");
			setCreatePostOpen(false);
			setSubmitError(null);
		} catch (err: any) {
			setSubmitError(err.message);
		} finally {
			setSubmitting(false);
		}
	};

	const handleClaimPost = async (postId: string) => {
		if (!user || claimingPostId) return;
		setClaimingPostId(postId);
		try {
			let revealedContact = "";
			await runTransaction(db, async (transaction) => {
				const postRef = doc(db, "lostFoundPosts", postId);
				const snap = await transaction.get(postRef);
				if (!snap.exists()) throw new Error("Post deleted.");
				if (snap.data()?.status === "claimed") throw new Error("Already claimed.");
				revealedContact = snap.data()?.contact || "No contact info";
				transaction.update(postRef, { status: "claimed", claimedAt: serverTimestamp(), claimedAtMs: Date.now() });
			});
			setClaimContactModal({ contact: revealedContact });
		} catch (err: any) {
			setActionError(err.message);
		} finally {
			setClaimingPostId(null);
		}
	};

	return (
		<div className="min-h-screen bg-[#050508] text-white selection:bg-pink-500/30">
			<TopNav
				isAuthenticated={!!user}
				onLogin={() => router.push("/")}
				onLogout={() => signOut(auth)}
				isWorking={loadingAuth}
				isAdmin={isAdmin}
				onGoToAdmin={() => router.push("/admin")}
			/>

			{/* Background Ambient Glows */}
			<div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
				<div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full" />
				<div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-pink-600/10 blur-[120px] rounded-full" />
			</div>

			<main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
				{/* ── Header & Stats ── */}
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
						<div>
							<h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
								Lost & <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">Found</span>
							</h1>
							<p className="mt-4 text-white/50 max-w-xl">
								Reconnect with someone you lost during a session. Post who you're looking for and let the community help you find them.
							</p>
						</div>
						
						<div className="flex gap-3">
							<StatCard label="Total" value={stats.total} icon={<MessageSquare className="w-3.5 h-3.5" />} color="white" />
							<StatCard label="Found" value={stats.claimed} icon={<CheckCircle2 className="w-3.5 h-3.5" />} color="emerald" />
							<StatCard label="Looking" value={stats.open} icon={<Clock className="w-3.5 h-3.5" />} color="amber" />
						</div>
					</div>
				</motion.div>

				{/* ── Action Bar ── */}
				<motion.div 
					initial={{ opacity: 0 }} 
					animate={{ opacity: 1 }} 
					transition={{ delay: 0.3 }}
					className="mt-12"
				>
					{!user ? (
						<div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md text-center">
							<p className="text-white/60 mb-4">You must be signed in to create or claim posts.</p>
							<button onClick={() => router.push("/")} className="px-6 py-2 bg-white text-black rounded-xl font-bold hover:bg-white/90 transition-all">
								Sign In to Post
							</button>
						</div>
					) : (
						<div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f101a]/50 backdrop-blur-xl">
							<button 
								onClick={() => setCreatePostOpen(!createPostOpen)}
								className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
							>
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
										<Plus className="w-5 h-5" />
									</div>
									<span className="font-bold">Create a Reconnection Post</span>
								</div>
								<span className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${createPostOpen ? "border-white/20 text-white" : "border-blue-500/30 text-blue-400"}`}>
									{createPostOpen ? "Cancel" : "Get Started"}
								</span>
							</button>

							<AnimatePresence>
								{createPostOpen && (
									<motion.form 
										initial={{ height: 0, opacity: 0 }}
										animate={{ height: "auto", opacity: 1 }}
										exit={{ height: 0, opacity: 0 }}
										onSubmit={handleCreatePost}
										className="p-6 border-t border-white/10 grid gap-4"
									>
										<div className="grid md:grid-cols-2 gap-4">
											<div className="space-y-1.5">
												<label className="text-[11px] font-bold text-white/40 uppercase ml-1">Target Name</label>
												<input 
													value={lookingForName} 
													onChange={e => setLookingForName(e.target.value)}
													placeholder="Who are you looking for?"
													className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all"
												/>
											</div>
											<div className="space-y-1.5">
												<label className="text-[11px] font-bold text-white/40 uppercase ml-1">Your Contact</label>
												<input 
													value={contact} 
													onChange={e => setContact(e.target.value)}
													placeholder="Email, Telegram, or Discord"
													className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all"
												/>
											</div>
										</div>
										<div className="space-y-1.5">
											<label className="text-[11px] font-bold text-white/40 uppercase ml-1">Message</label>
											<textarea 
												value={message} 
												onChange={e => setMessage(e.target.value)}
												placeholder="Describe your conversation or how they can recognize you..."
												className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-blue-500/50 outline-none transition-all min-h-[120px]"
											/>
										</div>
										{submitError && <p className="text-rose-400 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" /> {submitError}</p>}
										<div className="flex justify-end pt-2">
											<button 
												disabled={submitting}
												className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
											>
												{submitting ? "Publishing..." : "Post Reconnection"}
											</button>
										</div>
									</motion.form>
								)}
							</AnimatePresence>
						</div>
					)}
				</motion.div>

				{/* ── Posts Feed ── */}
				<div className="mt-16">
					<div className="flex items-center gap-3 mb-8">
						<Search className="w-5 h-5 text-white/20" />
						<h2 className="text-xl font-bold">Recent Requests</h2>
					</div>

					{loadingPosts ? (
						<div className="grid gap-4">
							{[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />)}
						</div>
					) : (
						<motion.div 
							variants={containerVariants}
							initial="hidden"
							animate="visible"
							className="grid gap-4"
						>
							{posts.map((post) => (
								<motion.article 
									key={post.id}
									variants={itemVariants}
									className={`group relative p-6 rounded-2xl border transition-all ${
										post.status === "claimed" 
										? "bg-emerald-500/[0.02] border-emerald-500/10 grayscale-[0.5]" 
										: "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
									}`}
								>
									<div className="flex flex-col sm:flex-row justify-between items-start gap-4">
										<div className="flex-1">
											<div className="flex items-center gap-3 mb-2">
												<div className={`p-1.5 rounded-lg ${post.status === "claimed" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}`}>
													<UserIcon className="w-4 h-4" />
												</div>
												<h3 className="font-bold text-lg">Looking for <span className="text-blue-400">{post.lookingForName}</span></h3>
											</div>
											<p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap max-w-2xl">
												{post.message}
											</p>
											<div className="mt-4 flex items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-white/30">
												<span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {formatDate(post.createdAtMs)}</span>
											</div>
										</div>

										<div className="flex flex-col items-end gap-3 self-stretch sm:self-auto">
											<span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
												post.status === "claimed" 
												? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" 
												: "border-amber-500/30 bg-amber-500/10 text-amber-400"
											}`}>
												{post.status === "claimed" ? "Reconnected" : "Waiting"}
											</span>
											
											{post.status === "open" && user && (
												<button
													onClick={() => handleClaimPost(post.id)}
													disabled={!!claimingPostId}
													className="mt-auto w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
												>
													{claimingPostId === post.id ? "Identifying..." : "That's Me!"}
												</button>
											)}
										</div>
									</div>
								</motion.article>
							))}
						</motion.div>
					)}
				</div>
			</main>

			{/* ── Success Modal ── */}
			<AnimatePresence>
				{claimContactModal && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60">
						<motion.div 
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							className="w-full max-w-md bg-[#0f101a] border border-white/10 rounded-3xl p-8 shadow-2xl"
						>
							<div className="flex justify-center mb-6">
								<div className="h-16 w-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
									<CheckCircle2 className="w-8 h-8" />
								</div>
							</div>
							<h3 className="text-2xl font-bold text-center">It's a Match!</h3>
							<p className="text-white/50 text-center text-sm mt-2 mb-8">
								You have successfully claimed this reconnection. Here is the contact info provided:
							</p>
							
							<div className="relative group">
								<div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
								<div className="relative flex items-center gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl overflow-hidden">
									<Mail className="w-5 h-5 text-emerald-400 flex-shrink-0" />
									<p className="font-mono text-emerald-100 break-all">{claimContactModal.contact}</p>
								</div>
							</div>

							<button 
								onClick={() => setClaimContactModal(null)}
								className="w-full mt-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-white/90 transition-all"
							>
								Close & Connect
							</button>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
}

// Sub-components for cleaner code
function StatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: 'white' | 'emerald' | 'amber' }) {
	const colors = {
		white: "text-white/40 border-white/10 bg-white/5",
		emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
		amber: "text-amber-400 border-amber-500/20 bg-amber-500/5"
	};

	return (
		<div className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl border ${colors[color]} min-w-[80px]`}>
			<span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter opacity-60">
				{icon} {label}
			</span>
			<span className="text-xl font-bold mt-0.5">{value}</span>
		</div>
	);
}