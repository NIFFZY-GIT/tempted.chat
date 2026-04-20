"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import { getUserRole } from "@/lib/admin";
import { auth } from "@/lib/firebase";
import { TopNav } from "@/components/navbar";

export function AuthTopNav({ showAdmin = true }: { showAdmin?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);

      if (!nextUser || nextUser.isAnonymous) {
        setIsAdmin(false);
        return;
      }

      void getUserRole(nextUser.uid)
        .then((role) => setIsAdmin(role === "admin"))
        .catch(() => setIsAdmin(false));
    });

    return unsubscribe;
  }, []);

  return (
    <TopNav
      isAuthenticated={Boolean(user)}
      onLogin={() => router.push("/")}
      onLogout={() => void signOut(auth)}
      isWorking={authLoading}
      isAdmin={showAdmin && isAdmin}
      onGoToAdmin={showAdmin && isAdmin ? () => router.push("/admin") : undefined}
    />
  );
}