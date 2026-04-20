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
  if (typeof value === "number") {
    return value;
  }

  const maybeTimestamp = value as Timestamp | undefined;
  if (maybeTimestamp && typeof maybeTimestamp.toMillis === "function") {
    return maybeTimestamp.toMillis();
  }

  return Date.now();
};

const formatDate = (valueMs: number): string => {
  try {
    return new Date(valueMs).toLocaleString();
  } catch {
    return "Unknown time";
  }
};

export default function LostFoundPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(auth.currentUser === null);

  const [posts, setPosts] = useState<LostFoundPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [lookingForName, setLookingForName] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [claimingPostId, setClaimingPostId] = useState<string | null>(null);
  const [claimContactModal, setClaimContactModal] = useState<{ contact: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoadingAuth(false);
      if (!nextUser) {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setIsAdmin(false);
      return;
    }

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
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const postsQuery = query(collection(db, "lostFoundPosts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const nextPosts: LostFoundPost[] = [];
        snapshot.forEach((postDoc) => {
          const data = postDoc.data() as {
            lookingForName?: unknown;
            message?: unknown;
            contact?: unknown;
            createdByUid?: unknown;
            createdAt?: unknown;
            createdAtMs?: unknown;
            status?: unknown;
            claimedAt?: unknown;
            claimedAtMs?: unknown;
          };

          nextPosts.push({
            id: postDoc.id,
            lookingForName: typeof data.lookingForName === "string" ? data.lookingForName : "Unknown",
            message: typeof data.message === "string" ? data.message : "",
            contact: typeof data.contact === "string" ? data.contact : "",
            createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
            createdAtMs: typeof data.createdAtMs === "number" ? data.createdAtMs : toMillis(data.createdAt),
            status: data.status === "claimed" ? "claimed" : "open",
            claimedAtMs: typeof data.claimedAtMs === "number" ? data.claimedAtMs : toMillis(data.claimedAt),
          });
        });

        setPosts(nextPosts);
        setLoadingPosts(false);
      },
      () => {
        setLoadingPosts(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const openPostsCount = useMemo(() => posts.filter((post) => post.status === "open").length, [posts]);
  const claimedPostsCount = useMemo(() => posts.filter((post) => post.status === "claimed").length, [posts]);

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || submitting) {
      return;
    }

    const trimmedName = lookingForName.trim();
    const trimmedMessage = message.trim();
    const trimmedContact = contact.trim();

    if (!trimmedName || !trimmedMessage || !trimmedContact) {
      setSubmitError("Please fill in name, message, and contact details.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const nowMs = Date.now();
      await addDoc(collection(db, "lostFoundPosts"), {
        lookingForName: trimmedName,
        message: trimmedMessage,
        contact: trimmedContact,
        createdByUid: user.uid,
        status: "open",
        createdAt: serverTimestamp(),
        createdAtMs: nowMs,
      });

      setLookingForName("");
      setMessage("");
      setContact("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not create post.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimPost = async (postId: string) => {
    if (!user || claimingPostId) {
      return;
    }

    setClaimingPostId(postId);
    setActionError(null);

    try {
      let revealedContact = "No contact provided.";
      await runTransaction(db, async (transaction) => {
        const postRef = doc(db, "lostFoundPosts", postId);
        const snapshot = await transaction.get(postRef);

        if (!snapshot.exists()) {
          throw new Error("This post no longer exists.");
        }

        const data = snapshot.data() as { status?: string; contact?: string };
        if (data.status === "claimed") {
          throw new Error("This post is already claimed.");
        }

        if (typeof data.contact === "string" && data.contact.trim().length > 0) {
          revealedContact = data.contact.trim();
        }

        const nowMs = Date.now();
        transaction.update(postRef, {
          status: "claimed",
          claimedAt: serverTimestamp(),
          claimedAtMs: nowMs,
        });
      });

      setClaimContactModal({ contact: revealedContact });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not claim this post.");
    } finally {
      setClaimingPostId(null);
    }
  };

  return (
    <>
      <TopNav
        isAuthenticated={Boolean(user)}
        onLogin={() => router.push("/")}
        onLogout={() => void signOut(auth)}
        isWorking={loadingAuth}
        isAdmin={isAdmin}
        onGoToAdmin={() => router.push("/admin")}
      />

      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-16 pt-24 text-white sm:px-6">
        <section className="rounded-3xl border border-white/[0.08] bg-[#0f101a]/85 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-300/70">Community Recovery Board</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Lost and Found</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/65 sm:text-[15px]">
            Reconnect with strangers you got disconnected from. Post who you are looking for and share an email or contact number.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-white/35">Total Posts</p>
              <p className="mt-1 text-2xl font-bold text-white/90">{posts.length}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-emerald-500/[0.08] px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-emerald-300/70">Found</p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">{claimedPostsCount}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-amber-500/[0.08] px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-amber-300/70">Still Looking</p>
              <p className="mt-1 text-2xl font-bold text-amber-200">{openPostsCount}</p>
            </div>
          </div>
        </section>

        {loadingAuth ? (
          <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0f101a]/75 p-6 text-white/65">Checking account...</section>
        ) : !user ? (
          <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0f101a]/75 p-6">
            <h2 className="text-lg font-semibold text-white">Sign in required to post or claim</h2>
            <p className="mt-2 text-sm text-white/65">You can still browse posts, but you need to sign in to create or claim one.</p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Go to Sign In
            </button>
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0f101a]/75 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Create a post</h2>
            <p className="mt-1 text-sm text-white/60">Example: I am looking for Alex. We got disconnected in video chat. Email me if you are Alex.</p>

            <form onSubmit={handleCreatePost} className="mt-4 grid gap-3">
              <div>
                <label htmlFor="looking-for" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/45">Who are you looking for?</label>
                <input
                  id="looking-for"
                  value={lookingForName}
                  onChange={(event) => setLookingForName(event.target.value)}
                  placeholder="Name or short identifier (e.g. Alex)"
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-sky-300/45"
                  maxLength={40}
                />
              </div>

              <div>
                <label htmlFor="message" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/45">Message</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Describe what happened and how they can recognize you"
                  className="min-h-[96px] w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-sky-300/45"
                  maxLength={700}
                />
              </div>

              <div>
                <label htmlFor="contact" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-white/45">Contact (email or phone)</label>
                <input
                  id="contact"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="example@mail.com or +1 555 123 4567"
                  className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-sky-300/45"
                  maxLength={120}
                />
              </div>

              {submitError && <p className="text-sm text-rose-300">{submitError}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
                >
                  {submitting ? "Posting..." : "Post to Lost and Found"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0f101a]/75 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Recent posts</h2>
          <p className="mt-1 text-sm text-white/60">People looking for reconnects after disconnection.</p>

          {actionError && <p className="mt-3 text-sm text-rose-300">{actionError}</p>}

          {loadingPosts ? (
            <p className="mt-4 text-sm text-white/60">Loading posts...</p>
          ) : posts.length === 0 ? (
            <p className="mt-4 text-sm text-white/60">No posts yet. Be the first to post.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {posts.map((post) => {
                const canClaim = Boolean(user) && post.status === "open";
                const isClaiming = claimingPostId === post.id;
                return (
                  <article key={post.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Looking for <span className="text-sky-300">{post.lookingForName}</span>
                        </p>
                        <p className="mt-1 text-xs text-white/45">Posted • {formatDate(post.createdAtMs)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${post.status === "claimed" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>
                        {post.status === "claimed" ? "Found" : "Open"}
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm text-white/85">{post.message}</p>
                    {post.status === "claimed" ? (
                      <p className="mt-2 text-xs text-emerald-300/85">This post was marked as found.</p>
                    ) : (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleClaimPost(post.id)}
                          disabled={!canClaim || isClaiming}
                          className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isClaiming ? "Claiming..." : "Mark as Found"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {claimContactModal && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#10111a] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
              <h3 className="text-lg font-semibold text-white">Marked as found</h3>
              <p className="mt-2 text-sm text-white/65">Contact details are shown only now during claiming.</p>
              <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-emerald-200/75">Contact</p>
                <p className="mt-1 break-all text-sm font-medium text-emerald-100">{claimContactModal.contact}</p>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setClaimContactModal(null)}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
