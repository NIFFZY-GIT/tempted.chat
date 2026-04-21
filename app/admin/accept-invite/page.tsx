"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

function AcceptInvitePageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const accept = async () => {
    if (!user || !token) return;
    setStatus("accepting");
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch("/api/admin/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? "Something went wrong.");
        setStatus("error");
      } else {
        setStatus("success");
        setTimeout(() => router.push("/admin"), 2500);
      }
    } catch {
      setErrorMsg("Network error. Try again.");
      setStatus("error");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-3xl border border-white/[0.08] bg-[#13131a] overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-pink-500 to-violet-500" />
          <div className="p-8 text-center space-y-6">
            <div className="inline-flex p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <ShieldCheck className="h-8 w-8 text-violet-400" />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight">Admin Invite</h1>
              <p className="mt-2 text-sm text-white/40">
                You&apos;ve been invited to become an admin on Tempted Chat.
              </p>
            </div>

            {!token && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Invalid or missing invite token.
              </div>
            )}

            {!user && token && (
              <div className="space-y-3">
                <p className="text-sm text-white/50">Sign in first, then accept the invite.</p>
                <button
                  onClick={() => router.push(`/?redirect=/admin/accept-invite?token=${token}`)}
                  className="w-full py-3.5 rounded-2xl bg-white text-black font-black text-sm uppercase tracking-widest transition active:scale-[0.98] hover:bg-white/90"
                >
                  Sign In
                </button>
              </div>
            )}

            {user && token && status === "idle" && (
              <div className="space-y-3">
                <p className="text-sm text-white/50">
                  Signed in as <span className="text-white/80">{user.email ?? user.uid}</span>
                </p>
                <button
                  onClick={accept}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-violet-600 text-white font-black text-sm uppercase tracking-widest transition active:scale-[0.98] hover:opacity-90"
                >
                  Accept & Become Admin
                </button>
              </div>
            )}

            {status === "accepting" && (
              <div className="flex items-center justify-center gap-2 text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                Accepting invite…
              </div>
            )}

            {status === "success" && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                ✓ You are now an admin! Redirecting to the dashboard…
              </div>
            )}

            {status === "error" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {errorMsg}
                </div>
                <button
                  onClick={() => setStatus("idle")}
                  className="text-sm text-white/30 hover:text-white transition"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AcceptInvitePageFallback() {
  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white/30" />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInvitePageFallback />}>
      <AcceptInvitePageContent />
    </Suspense>
  );
}
