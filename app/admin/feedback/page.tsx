"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { getUserRole } from "@/lib/admin";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  type Timestamp,
} from "firebase/firestore";

type FeedbackType = "bug" | "error" | "feedback" | "feature";
type FeedbackStatus = "open" | "in-progress" | "resolved" | "closed";

type FeedbackItem = {
  id: string;
  uid: string;
  email: string;
  displayName: string | null;
  type: FeedbackType;
  title: string;
  description: string;
  imageUrls: string[];
  status: FeedbackStatus;
  createdAt: Timestamp | null;
};

const TYPE_CONFIG: Record<FeedbackType, { icon: string; color: string; label: string }> = {
  bug: { icon: "🐛", color: "bg-red-500/10 text-red-400 border-red-500/20", label: "Bug" },
  error: { icon: "⚠️", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Error" },
  feedback: { icon: "💬", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Feedback" },
  feature: { icon: "✨", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", label: "Feature" },
};

const STATUS_CONFIG: Record<FeedbackStatus, { color: string; label: string }> = {
  open: { color: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "Open" },
  "in-progress": { color: "bg-blue-500/10 text-blue-400 border-blue-500/30", label: "In Progress" },
  resolved: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "Resolved" },
  closed: { color: "bg-white/5 text-white/30 border-white/10", label: "Closed" },
};

export default function AdminFeedbackPage() {
  const router = useRouter();
  const initialUser = auth.currentUser;
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(initialUser === null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(initialUser !== null);

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filterType, setFilterType] = useState<FeedbackType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | "all">("all");
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    void getUserRole(user.uid)
      .then((role) => { if (!cancelled) setIsAdmin(role === "admin"); })
      .catch(() => { if (!cancelled) setIsAdmin(false); })
      .finally(() => { if (!cancelled) setRoleLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FeedbackItem, "id">),
      }));
      setItems(data);
    });
    return () => unsub();
  }, [user, isAdmin]);

  const updateStatus = useCallback(async (id: string, status: FeedbackStatus) => {
    await updateDoc(doc(db, "feedback", id), { status });
    if (selectedItem?.id === id) {
      setSelectedItem((prev) => prev ? { ...prev, status } : null);
    }
  }, [selectedItem]);

  const deleteFeedback = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "feedback", id));
    if (selectedItem?.id === id) setSelectedItem(null);
  }, [selectedItem]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const filtered = items.filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const counts = {
    total: items.length,
    open: items.filter((i) => i.status === "open").length,
    inProgress: items.filter((i) => i.status === "in-progress").length,
    resolved: items.filter((i) => i.status === "resolved").length,
  };

  if (loading || (roleLoading && !user)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#07070d]">
        <p className="text-white/80">Checking admin access...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#07070d] px-6 text-center">
        <div className="max-w-xl rounded-2xl border border-white/10 bg-black/25 p-6 text-white">
          <h1 className="text-2xl font-bold">Sign in required</h1>
          <p className="mt-2 text-white/75">You must sign in with an admin account.</p>
          <button type="button" onClick={() => router.push("/")} className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">Go Home</button>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#07070d] px-6 text-center">
        <div className="max-w-xl rounded-2xl border border-red-300/20 bg-black/25 p-6 text-white">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="mt-2 text-white/75">Your account does not have admin role.</p>
          <button type="button" onClick={() => router.push("/")} className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">Go Home</button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#07070d] text-white">
      {/* ── Sidebar ── */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a14] md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-violet-500">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white/90">Admin Panel</p>
            <p className="text-[10px] text-white/30">tempted.chat</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">Analytics</p>
          <button onClick={() => router.push("/admin")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/40 transition hover:bg-white/[0.04] hover:text-white/60">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
            Overview
          </button>

          <p className="mb-2 mt-5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">Management</p>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/40 transition hover:bg-white/[0.04] hover:text-white/60">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
            Users
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/40 transition hover:bg-white/[0.04] hover:text-white/60">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>
            Rooms
          </button>
          <button onClick={() => router.push("/admin?tab=demo")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/40 transition hover:bg-white/[0.04] hover:text-white/60">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
            Demo Videos
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[13px] font-medium text-white/80">
            <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
            Feedback
            {counts.open > 0 && (
              <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">{counts.open}</span>
            )}
          </button>
        </nav>

        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white/80">{user.email ?? "Admin"}</p>
              <p className="text-[10px] text-emerald-400">Administrator</p>
            </div>
          </div>
          <button onClick={() => router.push("/")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/40 transition hover:bg-white/[0.08] hover:text-white/60">
            ← Back to App
          </button>
          <button onClick={handleLogout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/40 transition hover:bg-rose-500/10 hover:text-rose-400">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0a0a14]/60 px-5 backdrop-blur-xl md:px-8">
          <div>
            <h1 className="text-lg font-bold text-white/90">Feedback</h1>
            <p className="text-[11px] text-white/30">{counts.total} total · {counts.open} open · {counts.inProgress} in progress · {counts.resolved} resolved</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin")} className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/40 transition hover:bg-white/[0.08] hover:text-white/60">
              ← Overview
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-3 md:px-8">
          <span className="text-[11px] font-semibold text-white/20">TYPE:</span>
          {(["all", "bug", "error", "feedback", "feature"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                filterType === t
                  ? "bg-white/[0.08] text-white/80"
                  : "text-white/30 hover:bg-white/[0.04] hover:text-white/50"
              }`}
            >
              {t === "all" ? "All" : TYPE_CONFIG[t].icon + " " + TYPE_CONFIG[t].label}
            </button>
          ))}

          <span className="ml-4 text-[11px] font-semibold text-white/20">STATUS:</span>
          {(["all", "open", "in-progress", "resolved", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                filterStatus === s
                  ? "bg-white/[0.08] text-white/80"
                  : "text-white/30 hover:bg-white/[0.04] hover:text-white/50"
              }`}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* List */}
          <div className={`flex-1 overflow-y-auto ${selectedItem ? "hidden md:block md:max-w-md md:border-r md:border-white/[0.06]" : ""}`}>
            {filtered.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-white/20">
                No feedback found
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {filtered.map((item) => {
                  const tc = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.feedback;
                  const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open;
                  const isSelected = selectedItem?.id === item.id;
                  const timeStr = item.createdAt
                    ? new Date(item.createdAt.seconds * 1000).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })
                    : "—";

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition md:px-6 ${
                        isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="mt-0.5 text-base">{tc.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-white/80">{item.title}</p>
                          {item.imageUrls.length > 0 && (
                            <svg className="h-3.5 w-3.5 flex-shrink-0 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                            </svg>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-white/30">{item.email} · {timeStr}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${tc.color}`}>{tc.label}</span>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedItem && (
            <div className="flex flex-1 flex-col overflow-y-auto bg-[#0a0a14]/40">
              {/* Detail header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="rounded-lg px-2 py-1 text-[12px] text-white/30 transition hover:bg-white/[0.06] hover:text-white/60 md:hidden"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedItem.status}
                    onChange={(e) => void updateStatus(selectedItem.id, e.target.value as FeedbackStatus)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/70 outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    onClick={() => {
                      if (confirm("Delete this feedback?")) void deleteFeedback(selectedItem.id);
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-[12px] text-rose-400/60 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Detail body */}
              <div className="flex-1 px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{TYPE_CONFIG[selectedItem.type]?.icon ?? "💬"}</span>
                  <div>
                    <h2 className="text-lg font-bold text-white/90">{selectedItem.title}</h2>
                    <p className="mt-1 text-[12px] text-white/30">
                      {selectedItem.email}
                      {selectedItem.displayName && ` (${selectedItem.displayName})`}
                      {" · "}
                      {selectedItem.createdAt
                        ? new Date(selectedItem.createdAt.seconds * 1000).toLocaleString()
                        : "—"}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_CONFIG[selectedItem.type]?.color ?? ""}`}>
                        {TYPE_CONFIG[selectedItem.type]?.label ?? selectedItem.type}
                      </span>
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CONFIG[selectedItem.status]?.color ?? ""}`}>
                        {STATUS_CONFIG[selectedItem.status]?.label ?? selectedItem.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/70">{selectedItem.description}</p>
                </div>

                {selectedItem.imageUrls.length > 0 && (
                  <div className="mt-6">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">
                      Screenshots ({selectedItem.imageUrls.length})
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {selectedItem.imageUrls.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setLightboxUrl(url)}
                          className="group relative aspect-video overflow-hidden rounded-xl border border-white/[0.08] transition hover:border-white/20"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Screenshot ${i + 1}`}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                            <svg className="h-6 w-6 text-white opacity-0 transition group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[11px] text-white/20">
                    User ID: <span className="font-mono text-white/40">{selectedItem.uid}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Full screenshot"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
