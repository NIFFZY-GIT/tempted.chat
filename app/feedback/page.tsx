"use client";

import { useState, useRef, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopNav } from "@/components/navbar";
import { getUserRole } from "@/lib/admin";
import { ParticleBackground } from "@/components/particle-background";
import { motion, AnimatePresence } from "framer-motion";
import { 
	Bug, 
	AlertTriangle, 
	MessageSquare, 
	Sparkles, 
	X, 
	UploadCloud, 
	CheckCircle2,
	Lock,
	Loader2
} from "lucide-react";

type FeedbackType = "bug" | "error" | "feedback" | "feature";

const TYPES = [
	{ value: "bug", label: "Bug", icon: <Bug className="w-5 h-5" />, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
	{ value: "error", label: "Error", icon: <AlertTriangle className="w-5 h-5" />, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
	{ value: "feedback", label: "Feedback", icon: <MessageSquare className="w-5 h-5" />, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
	{ value: "feature", label: "Feature", icon: <Sparkles className="w-5 h-5" />, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
] as const;

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function FeedbackPage() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [user, setUser] = useState<User | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);
	const [loading, setLoading] = useState(true);

	const [type, setType] = useState<FeedbackType>("feedback");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [images, setImages] = useState<File[]>([]);
	const [previews, setPreviews] = useState<string[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState("");
	const [dragOver, setDragOver] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);

	useEffect(() => {
		const unsub = onAuthStateChanged(auth, (u) => {
			setUser(u);
			setLoading(false);
			if (u) void getUserRole(u.uid).then((role) => setIsAdmin(role === "admin"));
		});
		return () => unsub();
	}, []);

	const addFiles = (files: File[]) => {
		setError("");
		const validFiles = files.filter(f => f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE);
		const remaining = MAX_IMAGES - images.length;
		const finalFiles = validFiles.slice(0, remaining);
		setImages(prev => [...prev, ...finalFiles]);
		setPreviews(prev => [...prev, ...finalFiles.map(f => URL.createObjectURL(f))]);
	};

	const removeImage = (index: number) => {
		URL.revokeObjectURL(previews[index]);
		setImages(prev => prev.filter((_, i) => i !== index));
		setPreviews(prev => prev.filter((_, i) => i !== index));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !title.trim() || !description.trim()) return;
		setSubmitting(true);
		try {
			const imageUrls = [];
			for (let i = 0; i < images.length; i++) {
				const storageRef = ref(storage, `feedback/${user.uid}/${Date.now()}_${images[i].name}`);
				await uploadBytes(storageRef, images[i]);
				imageUrls.push(await getDownloadURL(storageRef));
				setUploadProgress(Math.round(((i + 1) / images.length) * 100));
			}
			await addDoc(collection(db, "feedback"), {
				uid: user.uid, email: user.email, type, title: title.trim(),
				description: description.trim(), imageUrls, status: "open", createdAt: serverTimestamp(),
			});
			setSubmitted(true);
		} catch (err) {
			setError("Failed to submit.");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) return <div className="flex h-screen items-center justify-center bg-[#07070d]"><Loader2 className="h-8 w-8 animate-spin text-white/20" /></div>;

	return (
		<div className="min-h-screen bg-[#050508] text-white">
			<TopNav isAuthenticated={!!user} onLogin={() => router.push("/")} onLogout={() => signOut(auth)} isWorking={false} isAdmin={isAdmin} onGoToAdmin={() => router.push("/admin")} />
			<ParticleBackground />

			<main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
				<AnimatePresence mode="wait">
					{!user ? (
						<motion.div key="login" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
							<Lock className="mx-auto w-8 h-8 text-white/20 mb-6" />
							<h1 className="text-2xl font-bold">Sign in Required</h1>
							<button onClick={() => router.push("/")} className="mt-8 px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all">Sign In</button>
						</motion.div>
					) : submitted ? (
						<motion.div key="success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
							<CheckCircle2 className="mx-auto w-16 h-16 text-emerald-400 mb-8" />
							<h1 className="text-4xl font-extrabold mb-4">Thank You!</h1>
							<p className="text-white/50 mb-10">We've received your feedback.</p>
							<div className="flex justify-center gap-4">
								<button onClick={() => setSubmitted(false)} className="px-6 py-3 rounded-xl border border-white/10 text-sm font-bold">Submit Another</button>
								<Link href="/" className="px-6 py-3 rounded-xl bg-white text-black font-bold text-sm">Return Home</Link>
							</div>
						</motion.div>
					) : (
						<motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
							<header className="mb-12">
								<h1 className="text-4xl font-extrabold tracking-tight">Send <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">Feedback</span></h1>
								<p className="mt-4 text-white/40">Help us improve the experience.</p>
							</header>

							<form onSubmit={handleSubmit} className="space-y-8">
								{/* Type Selector */}
								<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
									{TYPES.map((t) => (
										<button key={t.value} type="button" onClick={() => setType(t.value)} className={`relative p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${type === t.value ? `${t.bg} ${t.border}` : "bg-white/5 border-white/10 opacity-50 hover:opacity-100"}`}>
											<div className={type === t.value ? t.color : ""}>{t.icon}</div>
											<span className="text-xs font-bold">{t.label}</span>
										</button>
									))}
								</div>

								{/* Fields */}
								<div className="space-y-4">
									<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Subject line" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-violet-500/50" />
									<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's on your mind?" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-violet-500/50 min-h-[160px]" />
								</div>

								{/* Image Grid */}
								<div className="grid grid-cols-5 gap-3">
									{previews.map((src, i) => (
										<div key={src} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
											<img src={src} className="w-full h-full object-cover" />
											<button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 p-1 bg-black/60 rounded-md opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
										</div>
									))}
									{images.length < MAX_IMAGES && (
										<button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
											<UploadCloud className="w-6 h-6 text-white/20" />
										</button>
									)}
								</div>
								<input ref={fileInputRef} type="file" multiple hidden accept="image/*" onChange={(e) => addFiles(Array.from(e.target.files || []))} />

								{/* Progress Bar */}
								{submitting && images.length > 0 && (
									<div className="h-1 bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full bg-violet-500" initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} /></div>
								)}

								{/* ── PREVIOUS SUBMIT BUTTON DESIGN ── */}
								<button
									type="submit"
									disabled={submitting}
									className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-4 text-[15px] font-semibold text-white transition-all duration-300 disabled:opacity-40"
								>
									{/* Background gradient */}
									<span className="absolute inset-0 bg-gradient-to-r from-pink-500/25 via-violet-500/25 to-blue-500/25 transition-all duration-300 group-hover:from-pink-500/35 group-hover:via-violet-500/35 group-hover:to-blue-500/35" />
									
									{/* Subtle inner border */}
									<span className="absolute inset-0 ring-1 ring-inset ring-white/[0.1] rounded-xl" />
									
									{/* Shimmer effect */}
									<span className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />

									{submitting ? (
										<span className="relative z-10 flex items-center gap-2.5">
											<Loader2 className="h-4 w-4 animate-spin text-white" />
											Submitting...
										</span>
									) : (
										<span className="relative z-10 flex items-center gap-2">
											<svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
												<path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
											</svg>
											Submit Feedback
										</span>
									)}
								</button>
								{/* ────────────────────────────────── */}
								
								{error && <p className="text-red-400 text-sm text-center">{error}</p>}
							</form>
						</motion.div>
					)}
				</AnimatePresence>
			</main>
		</div>
	);
}