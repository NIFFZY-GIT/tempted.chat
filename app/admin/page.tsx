"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { getUserRole } from "@/lib/admin";
import { TopNav } from "@/components/navbar";
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

    const now = Date.now();
    const onlineThresholdMs = now - 2 * 60 * 1000;

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
      nextStats = {
        ...nextStats,
        waitingUsers: snapshot.size,
      };
      applyStats();
    });

    const unsubActiveRooms = onSnapshot(activeRoomsQuery, (snapshot) => {
      let usersInChats = 0;

      snapshot.docs.forEach((roomDoc) => {
        const data = roomDoc.data() as { participants?: unknown[] };
        usersInChats += Array.isArray(data.participants) ? data.participants.length : 0;
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
        const data = roomDoc.data() as { participants?: unknown[] };
        usersTexting += Array.isArray(data.participants) ? data.participants.length : 0;
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
        const data = roomDoc.data() as { participants?: unknown[] };
        usersVideo += Array.isArray(data.participants) ? data.participants.length : 0;
      });

      nextStats = {
        ...nextStats,
        usersVideo,
      };
      applyStats();
    });

    return () => {
      unsubOnlineUsers();
      unsubWaitingUsers();
      unsubActiveRooms();
      unsubTextRooms();
      unsubVideoRooms();
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
    <>
      <TopNav
        isAuthenticated={true}
        onLogin={() => {
          router.push("/");
        }}
        onLogout={handleLogout}
        isWorking={false}
        isAdmin={true}
        onGoToAdmin={() => {
          router.push("/admin");
        }}
      />
      <main className="mx-auto min-h-screen w-full max-w-6xl px-6 pb-16 pt-28 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Admin Dashboard</h1>
        <p className="mt-3 text-white/75">
          Welcome back, admin. This page is restricted to users with role set to admin.
        </p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Current Users</p>
            <p className="mt-2 text-3xl font-bold">{stats.totalCurrentUsers}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Anonymous Users</p>
            <p className="mt-2 text-3xl font-bold">{stats.anonymousUsers}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Google Users</p>
            <p className="mt-2 text-3xl font-bold">{stats.googleUsers}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Email Users</p>
            <p className="mt-2 text-3xl font-bold">{stats.emailUsers}</p>
          </article>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Users In Chats</p>
            <p className="mt-2 text-3xl font-bold">{stats.usersInChats}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Waiting Users</p>
            <p className="mt-2 text-3xl font-bold">{stats.waitingUsers}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Users Texting</p>
            <p className="mt-2 text-3xl font-bold">{stats.usersTexting}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Users In Video</p>
            <p className="mt-2 text-3xl font-bold">{stats.usersVideo}</p>
          </article>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">User</p>
            <p className="mt-2 text-sm font-semibold">{user.email ?? user.uid}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Role</p>
            <p className="mt-2 text-sm font-semibold">Administrator</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-xs uppercase tracking-wider text-white/50">Status</p>
            <p className="mt-2 text-sm font-semibold text-emerald-300">Access Granted</p>
          </article>
        </section>
      </main>
    </>
  );
}
