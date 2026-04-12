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

type FeedbackType = "bug" | "error" | "feedback" | "feature";

const TYPES: { value: FeedbackType; label: string; icon: string; desc: string; gradient: string; activeBg: string; activeBorder: string }[] = [
  {
    value: "bug",
    label: "Bug",
    icon: "🐛",
    desc: "Something isn't working",
    gradient: "from-red-500/20 to-red-600/10",
    activeBg: "bg-red-500/[0.08]",
    activeBorder: "border-red-500/30 ring-1 ring-red-500/20",
  },
  {
    value: "error",
    label: "Error",
    icon: "⚠️",
    desc: "Crash or error message",
    gradient: "from-orange-500/20 to-amber-600/10",
    activeBg: "bg-orange-500/[0.08]",
    activeBorder: "border-orange-500/30 ring-1 ring-orange-500/20",
  },
  {
    value: "feedback",
    label: "Feedback",
    icon: "💬",
    desc: "General thoughts",
    gradient: "from-blue-500/20 to-cyan-600/10",
    activeBg: "bg-blue-500/[0.08]",
    activeBorder: "border-blue-500/30 ring-1 ring-blue-500/20",
  },
  {
    value: "feature",
    label: "Feature",
    icon: "✨",
    desc: "Request something new",
    gradient: "from-violet-500/20 to-purple-600/10",
    activeBg: "bg-violet-500/[0.08]",
    activeBorder: "border-violet-500/30 ring-1 ring-violet-500/20",
  },
];

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function FeedbackPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

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
      if (u) {
        void getUserRole(u.uid).then((role) => setIsAdmin(role === "admin"));
      }
    });
    return () => unsub();
  }, []);

  const addFiles = (files: File[]) => {
    setError("");
    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) { setError("Only image files are allowed."); continue; }
      if (file.size > MAX_FILE_SIZE) { setError("Each image must be under 5 MB."); continue; }
      validFiles.push(file);
    }
    const remaining = MAX_IMAGES - images.length;
    if (validFiles.length > remaining) {
      setError(`You can add ${remaining} more image${remaining !== 1 ? "s" : ""}.`);
      validFiles.splice(remaining);
    }
    if (validFiles.length === 0) return;
    setImages((prev) => [...prev, ...validFiles]);
    const newPreviews = validFiles.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (!description.trim()) { setError("Please describe the issue."); return; }

    setSubmitting(true);
    setError("");
    setUploadProgress(0);

    try {
      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const path = `feedback/${user.uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file, { contentType: file.type });
        const url = await getDownloadURL(storageRef);
        imageUrls.push(url);
        setUploadProgress(Math.round(((i + 1) / images.length) * 100));
      }

      await addDoc(collection(db, "feedback"), {
        uid: user.uid,
        email: user.email ?? "anonymous",
        displayName: user.displayName ?? null,
        type,
        title: title.trim(),
        description: description.trim(),
        imageUrls,
        status: "open",
        createdAt: serverTimestamp(),
      });

      setSubmitted(true);
    } catch (err) {
      console.error("Feedback submission error:", err);
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setTitle("");
    setDescription("");
    setImages([]);
    setPreviews([]);
    setType("feedback");
    setUploadProgress(0);
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#07070d]">
        <ParticleBackground />
        <div className="relative z-10 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  /* ── Not signed in ── */
  if (!user) {
    return (
      <>
        <TopNav
          isAuthenticated={false}
          onLogin={() => router.push("/")}
          onLogout={() => router.push("/")}
          isWorking={false}
        />
        <main className="flex min-h-dvh items-center justify-center bg-[#07070d] px-6 pt-16 text-center">
          <ParticleBackground />
          <div className="relative z-10 max-w-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 ring-1 ring-white/[0.08]">
              <svg className="h-7 w-7 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Sign in to send feedback</h1>
            <p className="mt-2 text-sm text-white/40">We need to know who you are to follow up on your report.</p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-6 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Go to Sign In
            </button>
          </div>
        </main>
      </>
    );
  }

  /* ── Success state ── */
  if (submitted) {
    return (
      <>
        <TopNav
          isAuthenticated={true}
          onLogin={() => {}}
          onLogout={() => void signOut(auth)}
          isWorking={false}
          isAdmin={isAdmin}
          onGoToAdmin={() => router.push("/admin")}
        />
        <main className="flex min-h-dvh items-center justify-center bg-[#07070d] px-6 pt-16 text-center">
          <ParticleBackground />
          <div className="relative z-10 max-w-md">
            {/* Animated check */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" className="animate-[draw_0.5s_ease-out_forwards]" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Thank you!</h1>
            <p className="mt-2 text-[15px] text-white/50">Your feedback has been submitted successfully. Our team will review it shortly.</p>
            <div className="mt-8 flex justify-center gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white/80"
              >
                Submit Another
              </button>
              <Link
                href="/"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Back to Chat
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  /* ── Main form ── */
  return (
    <>
      <TopNav
        isAuthenticated={true}
        onLogin={() => {}}
        onLogout={() => void signOut(auth)}
        isWorking={false}
        isAdmin={isAdmin}
        onGoToAdmin={() => router.push("/admin")}
      />

      <main className="relative min-h-dvh bg-[#07070d] pb-16 pt-24">
        <ParticleBackground />
        <div className="relative z-10 mx-auto max-w-2xl px-4 sm:px-6">
          {/* ── Header ── */}
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 ring-1 ring-white/[0.08]">
                <svg className="h-5 w-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white/90">Send Feedback</h1>
                <p className="text-[13px] text-white/35">Help us improve Tempted.Chat</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* ── Type selector ── */}
            <div>
              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-white/25">
                What kind of feedback?
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TYPES.map((t) => {
                  const isActive = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center transition-all duration-200 ${
                        isActive
                          ? `${t.activeBg} ${t.activeBorder}`
                          : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="text-2xl transition-transform duration-200 group-hover:scale-110">{t.icon}</span>
                      <span className={`text-[13px] font-semibold transition ${isActive ? "text-white/90" : "text-white/50"}`}>
                        {t.label}
                      </span>
                      <span className={`text-[10px] leading-tight transition ${isActive ? "text-white/40" : "text-white/20"}`}>
                        {t.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Title ── */}
            <div>
              <label htmlFor="fb-title" className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-white/25">
                Title
              </label>
              <input
                id="fb-title"
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                placeholder="Brief summary..."
                maxLength={200}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 text-[14px] text-white placeholder-white/15 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-white/10"
              />
            </div>

            {/* ── Description ── */}
            <div>
              <label htmlFor="fb-desc" className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-white/25">
                Description
              </label>
              <textarea
                id="fb-desc"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(""); }}
                placeholder="Describe the issue, steps to reproduce, or your suggestion..."
                rows={6}
                maxLength={5000}
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 text-[14px] leading-relaxed text-white placeholder-white/15 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.04] focus:ring-1 focus:ring-white/10"
              />
              <p className="mt-1.5 text-right text-[10px] text-white/15">{description.length}/5000</p>
            </div>

            {/* ── Screenshots ── */}
            <div>
              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-white/25">
                Screenshots
                <span className="ml-2 font-normal normal-case tracking-normal text-white/15">
                  {images.length}/{MAX_IMAGES} · optional
                </span>
              </label>

              {/* Preview grid */}
              {previews.length > 0 && (
                <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {previews.map((src, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/40" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 opacity-0 ring-1 ring-white/10 backdrop-blur transition hover:bg-red-500/80 group-hover:opacity-100"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drop zone */}
              {images.length < MAX_IMAGES && (
                <div
                  ref={dropZoneRef}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-all duration-200 ${
                    dragOver
                      ? "border-violet-500/40 bg-violet-500/[0.06]"
                      : "border-white/[0.08] bg-white/[0.015] hover:border-white/[0.15] hover:bg-white/[0.03]"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${dragOver ? "bg-violet-500/20" : "bg-white/[0.04]"}`}>
                    <svg className={`h-5 w-5 transition ${dragOver ? "text-violet-400" : "text-white/25"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-[13px] text-white/30">
                    <span className="font-medium text-white/50">Click to upload</span> or drag & drop
                  </p>
                  <p className="text-[11px] text-white/15">PNG, JPG, GIF up to 5 MB</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageAdd}
                className="hidden"
              />
            </div>

            {/* ── Error ── */}
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                <svg className="h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-[13px] text-red-400">{error}</p>
              </div>
            )}

            {/* ── Upload progress ── */}
            {submitting && images.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-white/30">
                  <span>Uploading screenshots...</span>
                  <span className="tabular-nums">{uploadProgress}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={submitting}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-4 text-[15px] font-semibold text-white transition-all duration-300 disabled:opacity-40"
            >
              {/* Background gradient */}
              <span className="absolute inset-0 bg-gradient-to-r from-pink-500/25 via-violet-500/25 to-blue-500/25 transition-all duration-300 group-hover:from-pink-500/35 group-hover:via-violet-500/35 group-hover:to-blue-500/35" />
              <span className="absolute inset-0 ring-1 ring-inset ring-white/[0.1] rounded-xl" />
              {/* Shimmer effect */}
              <span className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />

              {submitting ? (
                <span className="relative z-10 flex items-center gap-2.5">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
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
          </form>

          {/* ── Footer note ── */}
          <p className="mt-8 text-center text-[11px] text-white/15">
            Your email ({user.email}) will be attached so we can follow up if needed.
          </p>
        </div>
      </main>
    </>
  );
}
