"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { getUserRole } from "@/lib/admin";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type DashboardStats = {
  totalCurrentUsers: number;
  anonymousUsers: number;
  googleUsers: number;
  emailUsers: number;
  usersInChats: number;
  waitingUsers: number;
  usersTexting: number;
  usersVideo: number;
  vipCount: number;
  vvipCount: number;
  genderMale: number;
  genderFemale: number;
  genderOther: number;
  age18Under: number;
  age18to24: number;
  age25to34: number;
  age35plus: number;
  vipByGender: { male: number; female: number; other: number };
  vvipByGender: { male: number; female: number; other: number };
};

const INITIAL_STATS: DashboardStats = {
  totalCurrentUsers: 0,
  anonymousUsers: 0,
  googleUsers: 0,
  emailUsers: 0,
  usersInChats: 0,
  waitingUsers: 0,
  usersTexting: 0,
  usersVideo: 0,
  vipCount: 0,
  vvipCount: 0,
  genderMale: 0,
  genderFemale: 0,
  genderOther: 0,
  age18Under: 0,
  age18to24: 0,
  age25to34: 0,
  age35plus: 0,
  vipByGender: { male: 0, female: 0, other: 0 },
  vvipByGender: { male: 0, female: 0, other: 0 },
};

const ROOM_PRESENCE_FRESH_MS = 20 * 1000;

const countFreshRoomParticipants = (
  participants: string[] | undefined,
  presenceBy: Record<string, number> | undefined,
): number => {
  if (!Array.isArray(participants) || participants.length === 0) {
    return 0;
  }

  const thresholdMs = Date.now() - ROOM_PRESENCE_FRESH_MS;
  return participants.reduce((count, uid) => {
    const seenAt = presenceBy?.[uid];
    return typeof seenAt === "number" && seenAt >= thresholdMs ? count + 1 : count;
  }, 0);
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
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
      .then((role) => {
        if (!cancelled) {
          setIsAdmin(role === "admin");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRoleLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (loading || roleLoading) {
      return;
    }
  }, [loading, roleLoading]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  useEffect(() => {
    if (!user || !isAdmin) {
      setStats(INITIAL_STATS);
      return;
    }

    const onlineThresholdMs = Date.now() - 2 * 60 * 1000;

    const onlineUsersQuery = query(collection(db, "users"), where("lastSeenAt", ">=", onlineThresholdMs));
    const waitingUsersQuery = query(collection(db, "waitingUsers"), where("status", "==", "searching"));
    const activeRoomsQuery = query(collection(db, "rooms"), where("status", "==", "active"));
    const activeTextRoomsQuery = query(
      collection(db, "rooms"),
      where("status", "==", "active"),
      where("mode", "==", "text"),
    );
    const activeVideoRoomsQuery = query(
      collection(db, "rooms"),
      where("status", "==", "active"),
      where("mode", "==", "video"),
    );

    let nextStats = { ...INITIAL_STATS };

    const applyStats = () => {
      setStats({ ...nextStats });
    };

    const unsubOnlineUsers = onSnapshot(onlineUsersQuery, (snapshot) => {
      let anonymousUsers = 0;
      let googleUsers = 0;
      let emailUsers = 0;

      snapshot.docs.forEach((userDoc) => {
        const data = userDoc.data() as { authProvider?: string; isAnonymous?: boolean };
        if (data.isAnonymous || data.authProvider === "anonymous") {
          anonymousUsers += 1;
          return;
        }

        if (data.authProvider === "google") {
          googleUsers += 1;
          return;
        }

        emailUsers += 1;
      });

      nextStats = {
        ...nextStats,
        totalCurrentUsers: snapshot.size,
        anonymousUsers,
        googleUsers,
        emailUsers,
      };
      applyStats();
    });

    const unsubWaitingUsers = onSnapshot(waitingUsersQuery, (snapshot) => {
      const thresholdMs = Date.now() - 2 * 60 * 1000;
      let waitingUsers = 0;
      let genderMale = 0;
      let genderFemale = 0;
      let genderOther = 0;
      let age18Under = 0;
      let age18to24 = 0;
      let age25to34 = 0;
      let age35plus = 0;

      snapshot.docs.forEach((waitingDoc) => {
        const data = waitingDoc.data() as {
          lastSeenAt?: { toMillis?: () => number } | number;
          profile?: { gender?: string; age?: number };
        };

        const lastSeenMs =
          typeof data.lastSeenAt === "number"
            ? data.lastSeenAt
            : data.lastSeenAt?.toMillis?.() ?? 0;

        if (lastSeenMs >= thresholdMs) {
          waitingUsers += 1;

          const gender = data.profile?.gender;
          if (gender === "Male") genderMale += 1;
          else if (gender === "Female") genderFemale += 1;
          else genderOther += 1;

          const age = data.profile?.age;
          if (typeof age === "number") {
            if (age < 18) age18Under += 1;
            else if (age <= 24) age18to24 += 1;
            else if (age <= 34) age25to34 += 1;
            else age35plus += 1;
          }
        }
      });

      nextStats = {
        ...nextStats,
        waitingUsers,
        genderMale,
        genderFemale,
        genderOther,
        age18Under,
        age18to24,
        age25to34,
        age35plus,
      };
      applyStats();
    });

    const unsubActiveRooms = onSnapshot(activeRoomsQuery, (snapshot) => {
      let usersInChats = 0;

      snapshot.docs.forEach((roomDoc) => {
        const data = roomDoc.data() as { participants?: string[]; presenceBy?: Record<string, number> };
        const freshParticipants = countFreshRoomParticipants(data.participants, data.presenceBy);
        if (freshParticipants >= 2) {
          usersInChats += freshParticipants;
        }
      });

      nextStats = {
        ...nextStats,
        usersInChats,
      };
      applyStats();
    });

    const unsubTextRooms = onSnapshot(activeTextRoomsQuery, (snapshot) => {
      let usersTexting = 0;

      snapshot.docs.forEach((roomDoc) => {
        const data = roomDoc.data() as { participants?: string[]; presenceBy?: Record<string, number> };
        const freshParticipants = countFreshRoomParticipants(data.participants, data.presenceBy);
        if (freshParticipants >= 2) {
          usersTexting += freshParticipants;
        }
      });

      nextStats = {
        ...nextStats,
        usersTexting,
      };
      applyStats();
    });

    const unsubVideoRooms = onSnapshot(activeVideoRoomsQuery, (snapshot) => {
      let usersVideo = 0;

      snapshot.docs.forEach((roomDoc) => {
        const data = roomDoc.data() as { participants?: string[]; presenceBy?: Record<string, number> };
        const freshParticipants = countFreshRoomParticipants(data.participants, data.presenceBy);
        if (freshParticipants >= 2) {
          usersVideo += freshParticipants;
        }
      });

      nextStats = {
        ...nextStats,
        usersVideo,
      };
      applyStats();
    });

    // --- Subscription listener (VIP / VVIP) ---
    const subscriptionsRef = collection(db, "subscriptions");
    const unsubSubscriptions = onSnapshot(subscriptionsRef, async (snapshot) => {
      const nowMs = Date.now();
      let vipCount = 0;
      let vvipCount = 0;
      const vipByGender = { male: 0, female: 0, other: 0 };
      const vvipByGender = { male: 0, female: 0, other: 0 };

      // Collect active subscriber UIDs with their tier
      const activeSubs: { uid: string; tier: string }[] = [];

      snapshot.docs.forEach((subDoc) => {
        const data = subDoc.data() as { tier?: string; expiresAt?: number };
        if (!data.tier || !data.expiresAt || data.expiresAt <= nowMs) return;

        if (data.tier === "vip") vipCount += 1;
        else if (data.tier === "vvip") vvipCount += 1;

        activeSubs.push({ uid: subDoc.id, tier: data.tier });
      });

      // Cross-reference with waitingUsers for gender breakdown
      // (waitingUsers docs are keyed by uid and have profile.gender)
      const { getDocs, doc, getDoc } = await import("firebase/firestore");
      for (const sub of activeSubs) {
        try {
          const waitingDoc = await getDoc(doc(db, "waitingUsers", sub.uid));
          const profile = waitingDoc.exists()
            ? (waitingDoc.data() as { profile?: { gender?: string } }).profile
            : undefined;

          const g = profile?.gender;
          const bucket = g === "Male" ? "male" : g === "Female" ? "female" : "other";

          if (sub.tier === "vip") vipByGender[bucket] += 1;
          else if (sub.tier === "vvip") vvipByGender[bucket] += 1;
        } catch {
          // skip if doc not found
        }
      }

      nextStats = {
        ...nextStats,
        vipCount,
        vvipCount,
        vipByGender,
        vvipByGender,
      };
      applyStats();
    });

    return () => {
      unsubOnlineUsers();
      unsubWaitingUsers();
      unsubActiveRooms();
      unsubTextRooms();
      unsubVideoRooms();
      unsubSubscriptions();
    };
  }, [isAdmin, user]);

  if (loading || roleLoading) {
    return (
      <main className="screen">
        <p className="text-white/80">Checking admin access...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="screen px-6 text-center">
        <div className="max-w-xl rounded-2xl border border-white/10 bg-black/25 p-6 text-white">
          <h1 className="text-2xl font-bold">Sign in required</h1>
          <p className="mt-2 text-white/75">You must sign in with an admin account to access the dashboard.</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="screen px-6 text-center">
        <div className="max-w-xl rounded-2xl border border-red-300/20 bg-black/25 p-6 text-white">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="mt-2 text-white/75">Your account is signed in, but it does not have admin role.</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#07070d] text-white">
      {/* ── Sidebar ── */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a14] md:flex">
        {/* Logo area */}
        <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-violet-500">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white/90">Admin Panel</p>
            <p className="text-[10px] text-white/30">tempted.chat</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">Analytics</p>
          <button className="flex w-full items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[13px] font-medium text-white/80">
            <svg className="h-4 w-4 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
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
          <button onClick={() => router.push("/admin/feedback")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-white/40 transition hover:bg-white/[0.04] hover:text-white/60">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
            Feedback
          </button>
        </nav>

        {/* User info at bottom */}
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
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/40 transition hover:bg-rose-500/10 hover:text-rose-400"
          >
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
            <h1 className="text-lg font-bold text-white/90">Overview</h1>
            <p className="text-[11px] text-white/30">Real-time analytics dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animation: "ripple 2s ease-out infinite" }} />
              Live
            </span>
            <button onClick={() => router.push("/")} className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/40 transition hover:bg-white/[0.08] hover:text-white/60">
              ← Back to App
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          {/* ── Primary stats row ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Users */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5 transition hover:border-white/[0.1]">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-pink-500/[0.06] blur-2xl transition-all group-hover:bg-pink-500/[0.1]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Total Online</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10">
                  <svg className="h-4 w-4 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                </div>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight">{stats.totalCurrentUsers}</p>
              <p className="mt-1 text-[11px] text-white/25">users active now</p>
            </div>

            {/* In Chats */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5 transition hover:border-white/[0.1]">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/[0.06] blur-2xl transition-all group-hover:bg-emerald-500/[0.1]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">In Chats</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>
                </div>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight">{stats.usersInChats}</p>
              <p className="mt-1 text-[11px] text-white/25">actively chatting</p>
            </div>

            {/* Waiting */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5 transition hover:border-white/[0.1]">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/[0.06] blur-2xl transition-all group-hover:bg-amber-500/[0.1]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Waiting</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight">{stats.waitingUsers}</p>
              <p className="mt-1 text-[11px] text-white/25">searching for match</p>
            </div>

            {/* Text vs Video ratio */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5 transition hover:border-white/[0.1]">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-violet-500/[0.06] blur-2xl transition-all group-hover:bg-violet-500/[0.1]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Text / Video</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                  <svg className="h-4 w-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" /></svg>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="text-3xl font-extrabold tracking-tight">{stats.usersTexting}</p>
                <span className="text-sm text-white/20">/</span>
                <p className="text-3xl font-extrabold tracking-tight">{stats.usersVideo}</p>
              </div>
              <p className="mt-1 text-[11px] text-white/25">text vs video users</p>
            </div>
          </div>

          {/* ── Auth breakdown + Activity visualiser ── */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {/* Auth method breakdown */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-6 lg:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Auth Methods</p>
              <div className="mt-5 space-y-4">
                {[
                  { label: "Anonymous", value: stats.anonymousUsers, color: "bg-white/20", textColor: "text-white/50" },
                  { label: "Google", value: stats.googleUsers, color: "bg-blue-500", textColor: "text-blue-400" },
                  { label: "Email", value: stats.emailUsers, color: "bg-violet-500", textColor: "text-violet-400" },
                ].map((item) => {
                  const pct = stats.totalCurrentUsers > 0 ? Math.round((item.value / stats.totalCurrentUsers) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className={`font-medium ${item.textColor}`}>{item.label}</span>
                        <span className="tabular-nums text-white/40">{item.value} <span className="text-white/20">({pct}%)</span></span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity distribution chart */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-6 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Activity Distribution</p>
              <div className="mt-5 flex h-48 items-end gap-3">
                {[
                  { label: "Online", value: stats.totalCurrentUsers, color: "from-pink-500 to-pink-600" },
                  { label: "Chatting", value: stats.usersInChats, color: "from-emerald-500 to-emerald-600" },
                  { label: "Waiting", value: stats.waitingUsers, color: "from-amber-500 to-amber-600" },
                  { label: "Text", value: stats.usersTexting, color: "from-blue-500 to-blue-600" },
                  { label: "Video", value: stats.usersVideo, color: "from-violet-500 to-violet-600" },
                  { label: "Anonymous", value: stats.anonymousUsers, color: "from-white/30 to-white/20" },
                  { label: "Google", value: stats.googleUsers, color: "from-sky-400 to-sky-500" },
                  { label: "Email", value: stats.emailUsers, color: "from-fuchsia-500 to-fuchsia-600" },
                ].map((bar) => {
                  const maxVal = Math.max(stats.totalCurrentUsers, 1);
                  const heightPct = Math.max((bar.value / maxVal) * 100, 2);
                  return (
                    <div key={bar.label} className="group flex flex-1 flex-col items-center gap-2">
                      <span className="text-[11px] tabular-nums font-bold text-white/60 opacity-0 transition group-hover:opacity-100">{bar.value}</span>
                      <div className="flex w-full justify-center">
                        <div
                          className={`w-full max-w-[36px] rounded-t-lg bg-gradient-to-t ${bar.color} transition-all duration-700 group-hover:opacity-100 opacity-80`}
                          style={{ height: `${heightPct}%`, minHeight: "4px" }}
                        />
                      </div>
                      <span className="text-[10px] text-white/25">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── VIP / VVIP stats ── */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* VIP count */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5 transition hover:border-white/[0.1]">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-yellow-500/[0.06] blur-2xl transition-all group-hover:bg-yellow-500/[0.1]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">VIP</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
                  <span className="text-sm">⭐</span>
                </div>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-yellow-400">{stats.vipCount}</p>
              <p className="mt-1 text-[11px] text-white/25">active VIP subscribers</p>
            </div>

            {/* VVIP count */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5 transition hover:border-white/[0.1]">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-500/[0.06] blur-2xl transition-all group-hover:bg-purple-500/[0.1]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">VVIP</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                  <span className="text-sm">💎</span>
                </div>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-purple-400">{stats.vvipCount}</p>
              <p className="mt-1 text-[11px] text-white/25">active VVIP subscribers</p>
            </div>

            {/* VIP by gender */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">VIP by Gender</p>
              <div className="mt-4 space-y-2.5">
                {[
                  { label: "Male", value: stats.vipByGender.male, color: "bg-blue-500" },
                  { label: "Female", value: stats.vipByGender.female, color: "bg-pink-500" },
                  { label: "Other", value: stats.vipByGender.other, color: "bg-white/30" },
                ].map((item) => {
                  const pct = stats.vipCount > 0 ? Math.round((item.value / stats.vipCount) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-white/50">{item.label}</span>
                        <span className="tabular-nums text-white/40">{item.value} <span className="text-white/20">({pct}%)</span></span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* VVIP by gender */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">VVIP by Gender</p>
              <div className="mt-4 space-y-2.5">
                {[
                  { label: "Male", value: stats.vvipByGender.male, color: "bg-blue-500" },
                  { label: "Female", value: stats.vvipByGender.female, color: "bg-pink-500" },
                  { label: "Other", value: stats.vvipByGender.other, color: "bg-white/30" },
                ].map((item) => {
                  const pct = stats.vvipCount > 0 ? Math.round((item.value / stats.vvipCount) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-white/50">{item.label}</span>
                        <span className="tabular-nums text-white/40">{item.value} <span className="text-white/20">({pct}%)</span></span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Gender & Age Demographics ── */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Gender breakdown */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Gender Distribution</p>
              <p className="mt-0.5 text-[10px] text-white/15">active waiting users</p>
              <div className="mt-5 flex items-end gap-4">
                {[
                  { label: "Male", value: stats.genderMale, color: "from-blue-500 to-blue-600", emoji: "♂" },
                  { label: "Female", value: stats.genderFemale, color: "from-pink-500 to-pink-600", emoji: "♀" },
                  { label: "Other", value: stats.genderOther, color: "from-white/30 to-white/20", emoji: "⚧" },
                ].map((bar) => {
                  const total = stats.genderMale + stats.genderFemale + stats.genderOther;
                  const pct = total > 0 ? Math.round((bar.value / total) * 100) : 0;
                  const maxVal = Math.max(stats.genderMale, stats.genderFemale, stats.genderOther, 1);
                  const heightPct = Math.max((bar.value / maxVal) * 100, 4);
                  return (
                    <div key={bar.label} className="group flex flex-1 flex-col items-center gap-2">
                      <span className="text-xs tabular-nums font-bold text-white/60">{bar.value}</span>
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          className={`w-full max-w-[48px] rounded-t-lg bg-gradient-to-t ${bar.color} transition-all duration-700 opacity-80 group-hover:opacity-100`}
                          style={{ height: `${heightPct}%`, minHeight: "6px" }}
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-sm">{bar.emoji}</span>
                        <p className="text-[10px] text-white/30">{bar.label}</p>
                        <p className="text-[10px] tabular-nums text-white/20">{pct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Age breakdown */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Age Distribution</p>
              <p className="mt-0.5 text-[10px] text-white/15">active waiting users</p>
              <div className="mt-5 space-y-4">
                {[
                  { label: "Under 18", value: stats.age18Under, color: "bg-rose-500" },
                  { label: "18 – 24", value: stats.age18to24, color: "bg-orange-500" },
                  { label: "25 – 34", value: stats.age25to34, color: "bg-emerald-500" },
                  { label: "35+", value: stats.age35plus, color: "bg-cyan-500" },
                ].map((item) => {
                  const total = stats.age18Under + stats.age18to24 + stats.age25to34 + stats.age35plus;
                  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-white/50">{item.label}</span>
                        <span className="tabular-nums text-white/40">{item.value} <span className="text-white/20">({pct}%)</span></span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Quick info row ── */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10">
                <svg className="h-5 w-5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Signed in as</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white/80">{user.email ?? user.uid}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Role</p>
                <p className="mt-0.5 text-sm font-semibold text-emerald-400">Administrator</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0d0d16] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <svg className="h-5 w-5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Status</p>
                <p className="mt-0.5 text-sm font-semibold text-white/60">All systems operational</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
