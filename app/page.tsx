"use client";

import { auth, db, googleProvider, storage } from "@/lib/firebase";
import {
  AuthView,
  ChatFilters,
  ChatMode,
  ChatRoomView,
  FilterOptionsView,
  generateRandomStrangerProfile,
  ModeSelectionView,
  ProfileGender,
  ProfileSetupView,
  type ChatMessage,
  type UserProfile,
} from "@/components/chat-ui";
import { SiteFooter } from "@/components/footer";
import { TopNav } from "@/components/navbar";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type FirestoreError,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

type WaitingUser = {
  uid: string;
  status: "searching" | "matched";
  mode: ChatMode;
  roomId?: string;
  filters: ChatFilters;
  profile: {
    gender: ProfileGender;
    age: number;
    countryCode?: string;
  };
};

const ageGroupMatches = (ageGroup: ChatFilters["ageGroup"], age: number): boolean => {
  if (ageGroup === "Any age") {
    return true;
  }

  if (ageGroup === "Under 18") {
    return age < 18;
  }

  if (ageGroup === "18-25") {
    return age >= 18 && age <= 25;
  }

  return age >= 25;
};

const countryMatches = (country: ChatFilters["country"], countryCode?: string): boolean => {
  if (country === "Any") {
    return true;
  }

  return countryCode?.toUpperCase() === country;
};

const styleMatches = (a: ChatFilters["style"], b: ChatFilters["style"]): boolean => {
  return a === "Any style" || b === "Any style" || a === b;
};

const profileMatchesFilters = (filters: ChatFilters, profile: WaitingUser["profile"]): boolean => {
  const genderOk = filters.gender === "Any" || filters.gender === profile.gender;
  const ageOk = ageGroupMatches(filters.ageGroup, profile.age);
  const countryOk = countryMatches(filters.country, profile.countryCode);
  return genderOk && ageOk && countryOk;
};

const areUsersCompatible = (a: WaitingUser, b: WaitingUser): boolean => {
  return (
    styleMatches(a.filters.style, b.filters.style) &&
    profileMatchesFilters(a.filters, b.profile) &&
    profileMatchesFilters(b.filters, a.profile)
  );
};

const STRANGER_LEFT_PROMPT = "Stranger left. Connect to the next stranger?";

type PersistedChatSession = {
  roomId: string;
  chatMode: ChatMode;
  chatFilters: ChatFilters;
};

const getChatSessionStorageKey = (uid: string): string => `chat_session_${uid}`;

const normalizeCountryCode = (countryCode?: string): string | null => {
  if (!countryCode) {
    return null;
  }

  const normalized = countryCode.trim().toUpperCase();
  if (normalized.length !== 2) {
    return null;
  }

  return normalized === "UK" ? "GB" : normalized;
};

const getCountryNameFromCode = (countryCode: string, locale: string): string => {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authMethod, setAuthMethod] = useState<"email" | "google" | "anonymous">(
    "anonymous",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode | null>(null);
  const [chatFilters, setChatFilters] = useState<ChatFilters | null>(null);
  const [strangerProfile, setStrangerProfile] = useState<UserProfile>(generateRandomStrangerProfile());
  const [profileGender, setProfileGender] = useState<ProfileGender | null>(null);
  const [profileAge, setProfileAge] = useState("");
  const [profileCountry, setProfileCountry] = useState("");
  const [profileCountryCode, setProfileCountryCode] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageTimerSeconds, setImageTimerSeconds] = useState(0);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingStatus, setConnectingStatus] = useState("Checking availability...");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [strangerIsTyping, setStrangerIsTyping] = useState(false);
  const [showNextStrangerPrompt, setShowNextStrangerPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const roomUnsubRef = useRef<(() => void) | null>(null);
  const roomMessagesUnsubRef = useRef<(() => void) | null>(null);
  const waitingUnsubRef = useRef<(() => void) | null>(null);
  const retryMatchIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const typingIdleTimeoutRef = useRef<number | null>(null);
  const imageCleanupIntervalRef = useRef<number | null>(null);
  const selfTypingRef = useRef(false);
  const activeRoomIdRef = useRef<string | null>(null);
  const hasAttemptedSessionRestoreRef = useRef(false);

  const formatFirebaseError = (error: unknown): string => {
    const fallback = "Unknown error";

    if (typeof error === "object" && error !== null) {
      const maybeCode = "code" in error ? String(error.code) : fallback;
      const maybeMessage = "message" in error ? String(error.message) : fallback;
      return `${maybeCode}: ${maybeMessage}`;
    }

    return typeof error === "string" ? error : fallback;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setChatMode(null);
      setChatFilters(null);
      setProfileGender(null);
      setProfileAge("");
      setProfileError(null);
      return;
    }

    const storageKey = `profile_${user.uid}`;
    const rawProfile = window.localStorage.getItem(storageKey);

    if (!rawProfile) {
      setProfile(null);
      return;
    }

    try {
      const parsed = JSON.parse(rawProfile) as UserProfile;
      if (
        (parsed.gender === "Male" || parsed.gender === "Female" || parsed.gender === "Other") &&
        Number.isFinite(parsed.age)
      ) {
        setProfile(parsed);
        if (typeof parsed.country === "string" && parsed.country.trim().length > 0) {
          setProfileCountry(parsed.country === "GB" || parsed.country === "UK" ? "United Kingdom" : parsed.country);
        }
        if (typeof parsed.countryCode === "string" && parsed.countryCode.trim().length === 2) {
          const normalizedCode = parsed.countryCode.toUpperCase() === "UK" ? "GB" : parsed.countryCode.toUpperCase();
          setProfileCountryCode(normalizedCode);
        }
      }
    } catch {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    if (profileCountryCode) {
      return;
    }

    const locale = navigator.languages?.[0] ?? navigator.language;
    let cancelled = false;

    const applyCountry = (countryCode: string, countryName?: string) => {
      if (cancelled) {
        return;
      }

      const normalizedCode = normalizeCountryCode(countryCode);
      if (!normalizedCode) {
        return;
      }

      setProfileCountryCode(normalizedCode);
      setProfileCountry(countryName?.trim() || getCountryNameFromCode(normalizedCode, locale));
    };

    const fallbackToLocale = () => {
      const localeCode = normalizeCountryCode(locale.split("-")[1]);
      if (!localeCode) {
        if (!cancelled) {
          setProfileCountry("Unknown");
          setProfileCountryCode("");
        }
        return;
      }

      applyCountry(localeCode);
    };

    const detectCountryFromGeolocation = async (latitude: number, longitude: number) => {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      );

      if (!response.ok) {
        throw new Error(`Geocode request failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        countryCode?: string;
        countryName?: string;
      };

      const geocodedCode = normalizeCountryCode(data.countryCode);
      if (!geocodedCode) {
        throw new Error("Geocoder returned invalid country code");
      }

      applyCountry(geocodedCode, data.countryName);
    };

    if (!("geolocation" in navigator)) {
      fallbackToLocale();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void detectCountryFromGeolocation(position.coords.latitude, position.coords.longitude).catch(() => {
          fallbackToLocale();
        });
      },
      () => {
        fallbackToLocale();
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 10 * 60 * 1000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [profileCountry, profileCountryCode]);

  useEffect(() => {
    return () => {
      if (roomUnsubRef.current) {
        roomUnsubRef.current();
      }
      if (roomMessagesUnsubRef.current) {
        roomMessagesUnsubRef.current();
      }
      if (waitingUnsubRef.current) {
        waitingUnsubRef.current();
      }
      if (retryMatchIntervalRef.current) {
        window.clearInterval(retryMatchIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
      }
      if (typingIdleTimeoutRef.current) {
        window.clearTimeout(typingIdleTimeoutRef.current);
      }
      if (imageCleanupIntervalRef.current) {
        window.clearInterval(imageCleanupIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    if (!user) {
      hasAttemptedSessionRestoreRef.current = false;
      return;
    }

    if (hasAttemptedSessionRestoreRef.current) {
      return;
    }

    hasAttemptedSessionRestoreRef.current = true;

    const sessionRaw = window.localStorage.getItem(getChatSessionStorageKey(user.uid));
    if (!sessionRaw) {
      return;
    }

    try {
      const parsed = JSON.parse(sessionRaw) as Partial<PersistedChatSession>;
      const hasRoom = typeof parsed.roomId === "string" && parsed.roomId.length > 0;
      const modeValid = parsed.chatMode === "text" || parsed.chatMode === "video" || parsed.chatMode === "group";
      const filtersValid = typeof parsed.chatFilters === "object" && parsed.chatFilters !== null;

      if (!hasRoom || !modeValid || !filtersValid) {
        window.localStorage.removeItem(getChatSessionStorageKey(user.uid));
        return;
      }

      const restoredRoomId = parsed.roomId as string;
      const restoredMode = parsed.chatMode as ChatMode;
      const restoredFilters = parsed.chatFilters as ChatFilters;

      setChatMode(restoredMode);
      setChatFilters(restoredFilters);
      setActiveRoomId(restoredRoomId);
      setIsConnecting(true);
      setConnectingStatus("Reconnecting to your previous chat...");
      setShowNextStrangerPrompt(false);
    } catch {
      window.localStorage.removeItem(getChatSessionStorageKey(user.uid));
    }
  }, [user]);

  useEffect(() => {
    if (!user || !hasAttemptedSessionRestoreRef.current) {
      return;
    }

    const sessionKey = getChatSessionStorageKey(user.uid);

    if (activeRoomId && chatMode && chatFilters) {
      const payload: PersistedChatSession = {
        roomId: activeRoomId,
        chatMode,
        chatFilters,
      };
      window.localStorage.setItem(sessionKey, JSON.stringify(payload));
      return;
    }

    window.localStorage.removeItem(sessionKey);
  }, [activeRoomId, chatFilters, chatMode, user]);

  useEffect(() => {
    if (!user) {
      waitingUnsubRef.current?.();
      waitingUnsubRef.current = null;
      setIsConnecting(false);
      setActiveRoomId(null);
      setMessages([]);
      return;
    }

    if (activeRoomId) {
      waitingUnsubRef.current?.();
      waitingUnsubRef.current = null;
      return;
    }

    if (showNextStrangerPrompt) {
      setIsConnecting(false);
      return;
    }

    const waitingRef = doc(db, "waitingUsers", user.uid);
    setIsConnecting(true);
    setConnectingStatus("Checking availability...");

    waitingUnsubRef.current?.();
    waitingUnsubRef.current = onSnapshot(waitingRef, (snapshot) => {
      if (!snapshot.exists()) {
        if (!activeRoomIdRef.current) {
          setConnectingStatus("Waiting for available strangers...");
        }
        return;
      }

      const data = snapshot.data() as WaitingUser;
      const matchedRoomId = data.roomId;
      if (data.status === "matched" && typeof matchedRoomId === "string" && matchedRoomId.length > 0) {
        if (activeRoomIdRef.current !== matchedRoomId) {
          setActiveRoomId(matchedRoomId);
        }
      }
    });

    return () => {
      waitingUnsubRef.current?.();
      waitingUnsubRef.current = null;
    };
  }, [activeRoomId, showNextStrangerPrompt, user]);

  useEffect(() => {
    if (!user || !activeRoomId) {
      return;
    }

    cleanupWaitIntervals();
    void deleteDoc(doc(db, "waitingUsers", user.uid)).catch(() => {
      // Ignore if queue entry already removed.
    });
  }, [activeRoomId, user]);

  useEffect(() => {
    if (!activeRoomId || !user) {
      roomUnsubRef.current?.();
      roomUnsubRef.current = null;
      roomMessagesUnsubRef.current?.();
      roomMessagesUnsubRef.current = null;
      setStrangerIsTyping(false);
      selfTypingRef.current = false;
      return;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    const messagesRef = query(collection(roomRef, "messages"), orderBy("createdAt", "asc"));

    roomUnsubRef.current?.();
    roomUnsubRef.current = onSnapshot(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setIsConnecting(false);
          setConnectingStatus("Previous chat ended.");
          setActiveRoomId(null);
          return;
        }

        setIsConnecting(false);

        const roomData = snapshot.data() as {
          participantProfiles?: Array<{ uid: string; gender: ProfileGender; age: number; countryCode?: string }>;
          typingBy?: Record<string, boolean>;
          status?: string;
          endedBy?: string;
        };

        const stranger = roomData.participantProfiles?.find((p) => p.uid !== user.uid);
        if (stranger) {
          setStrangerProfile({
            gender: stranger.gender,
            age: stranger.age,
            countryCode: stranger.countryCode,
          });
        }

        if (roomData.status === "ended") {
          if (roomData.endedBy && roomData.endedBy !== user.uid) {
            setShowNextStrangerPrompt(true);
            setConnectingStatus(STRANGER_LEFT_PROMPT);
            setIsConnecting(false);
            setStrangerIsTyping(false);
            setMessages((current) => {
              const alreadyNotified = current.some((message) => message.text === STRANGER_LEFT_PROMPT);
              if (alreadyNotified) {
                return current;
              }

              const now = new Date();
              return [
                ...current,
                {
                  id: `system-${Date.now()}`,
                  author: "stranger",
                  text: STRANGER_LEFT_PROMPT,
                  sentAt: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
                },
              ];
            });
            setActiveRoomId(null);
            return;
          }
        }

        const isOtherUserTyping = Object.entries(roomData.typingBy ?? {}).some(
          ([uid, typing]) => uid !== user.uid && Boolean(typing),
        );
        setStrangerIsTyping(isOtherUserTyping);
      },
      (error: FirestoreError) => {
        console.error("Room subscription failed", {
          roomId: activeRoomId,
          uid: user.uid,
          error: formatFirebaseError(error),
        });
        setIsConnecting(false);
        setConnectingStatus("Realtime connection lost. Reconnecting...");
      },
    );

    roomMessagesUnsubRef.current?.();
    roomMessagesUnsubRef.current = onSnapshot(
      messagesRef,
      (snapshot) => {
        const nextMessages: ChatMessage[] = snapshot.docs.map((messageDoc) => {
          const data = messageDoc.data() as {
            senderId?: string;
            clientMessageId?: string;
            text?: string;
            imageUrl?: string;
            imageViewTimerSeconds?: number | null;
            imageRevealAtMs?: number | null;
            imageExpiresAtMs?: number | null;
            imageDeleted?: boolean;
            createdAt?: { toDate?: () => Date };
          };

          const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();

          return {
            id: messageDoc.id,
            author: data.senderId === user.uid ? "you" : "stranger",
            clientMessageId: data.clientMessageId,
            text: data.text,
            image: data.imageUrl,
            imageViewTimerSeconds:
              typeof data.imageViewTimerSeconds === "number" && data.imageViewTimerSeconds > 0
                ? data.imageViewTimerSeconds
                : undefined,
            imageRevealAtMs:
              typeof data.imageRevealAtMs === "number" && data.imageRevealAtMs > 0
                ? data.imageRevealAtMs
                : undefined,
            imageExpiresAtMs:
              typeof data.imageExpiresAtMs === "number" && data.imageExpiresAtMs > 0
                ? data.imageExpiresAtMs
                : undefined,
            imageDeleted: Boolean(data.imageDeleted),
            sentAt: `${String(createdAtDate.getHours()).padStart(2, "0")}:${String(createdAtDate.getMinutes()).padStart(2, "0")}`,
          };
        });

        setMessages(nextMessages);
        setIsConnecting(false);
        setConnectingStatus("Connected");
        setShowNextStrangerPrompt(false);
      },
      (error: FirestoreError) => {
        console.error("Message subscription failed", {
          roomId: activeRoomId,
          uid: user.uid,
          error: formatFirebaseError(error),
        });
        setIsConnecting(false);
        setConnectingStatus("Message sync lost. Reconnecting...");
      },
    );

    return () => {
      roomUnsubRef.current?.();
      roomUnsubRef.current = null;
      roomMessagesUnsubRef.current?.();
      roomMessagesUnsubRef.current = null;
    };
  }, [activeRoomId, user]);

  useEffect(() => {
    if (!activeRoomId) {
      if (imageCleanupIntervalRef.current) {
        window.clearInterval(imageCleanupIntervalRef.current);
        imageCleanupIntervalRef.current = null;
      }
      return;
    }

    const cleanupExpiredImages = async () => {
      try {
        const expiredSnapshot = await getDocs(
          query(
            collection(db, "rooms", activeRoomId, "messages"),
            where("imageExpiresAtMs", "<=", Date.now()),
            limit(20),
          ),
        );

        await Promise.all(
          expiredSnapshot.docs.map(async (messageDoc) => {
            const data = messageDoc.data() as {
              imageUrl?: string | null;
              imagePath?: string | null;
              text?: string | null;
              imageDeleted?: boolean;
            };

            if (data.imageDeleted || (!data.imagePath && !data.imageUrl)) {
              return;
            }

            if (data.imagePath) {
              try {
                await deleteObject(ref(storage, data.imagePath));
              } catch {
                // Ignore if already deleted.
              }
            }

            await updateDoc(messageDoc.ref, {
              imageUrl: deleteField(),
              imagePath: deleteField(),
              imageDeleted: true,
              imageDeletedAt: serverTimestamp(),
              imageExpiresAtMs: deleteField(),
              imageRevealAtMs: deleteField(),
              text: data.text ?? "Timer ran out. Image deleted.",
            });
          }),
        );
      } catch (error) {
        console.error("Expired image cleanup failed", {
          roomId: activeRoomId,
          error: formatFirebaseError(error),
        });
      }
    };

    void cleanupExpiredImages();
    imageCleanupIntervalRef.current = window.setInterval(() => {
      void cleanupExpiredImages();
    }, 1000);

    return () => {
      if (imageCleanupIntervalRef.current) {
        window.clearInterval(imageCleanupIntervalRef.current);
        imageCleanupIntervalRef.current = null;
      }
    };
  }, [activeRoomId]);

  const cleanupWaitIntervals = () => {
    if (retryMatchIntervalRef.current) {
      window.clearInterval(retryMatchIntervalRef.current);
      retryMatchIntervalRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  const setTypingStatus = async (typing: boolean) => {
    if (!user || !activeRoomId) {
      return;
    }

    if (selfTypingRef.current === typing) {
      return;
    }

    selfTypingRef.current = typing;

    try {
      await updateDoc(doc(db, "rooms", activeRoomId), {
        [`typingBy.${user.uid}`]: typing,
        typingUpdatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore transient typing update failures.
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);

    if (isConnecting || !user || !activeRoomId) {
      return;
    }

    if (value.trim().length === 0) {
      if (typingIdleTimeoutRef.current) {
        window.clearTimeout(typingIdleTimeoutRef.current);
        typingIdleTimeoutRef.current = null;
      }
      void setTypingStatus(false);
      return;
    }

    void setTypingStatus(true);

    if (typingIdleTimeoutRef.current) {
      window.clearTimeout(typingIdleTimeoutRef.current);
    }

    typingIdleTimeoutRef.current = window.setTimeout(() => {
      void setTypingStatus(false);
      typingIdleTimeoutRef.current = null;
    }, 1500);
  };

  const markRoomEnded = async () => {
    if (!activeRoomId || !user) {
      return;
    }

    setShowNextStrangerPrompt(false);
    await setTypingStatus(false);

    try {
      await updateDoc(doc(db, "rooms", activeRoomId), {
        status: "ended",
        endedBy: user.uid,
        endedAt: serverTimestamp(),
      });
    } catch {
      // Ignore room end race conditions.
    }

    setActiveRoomId(null);
    setMessages([]);
  };

  const tryMatchWithAvailableUser = async (
    filters: ChatFilters,
    mode: ChatMode,
    currentUser: User,
    currentProfile: UserProfile,
  ) => {
    setConnectingStatus("Checking availability...");

    const waitingUsersRef = collection(db, "waitingUsers");
    const searchingQuery = query(
      waitingUsersRef,
      where("status", "==", "searching"),
      where("mode", "==", mode),
      limit(25),
    );
    const searchSnapshot = await getDocs(searchingQuery);

    const me: WaitingUser = {
      uid: currentUser.uid,
      status: "searching",
      mode,
      filters,
      profile: {
        gender: currentProfile.gender,
        age: currentProfile.age,
        countryCode: currentProfile.countryCode,
      },
    };

    const candidates = searchSnapshot.docs
      .filter((candidateDoc) => candidateDoc.id !== currentUser.uid)
      .map((candidateDoc) => candidateDoc.data() as WaitingUser)
      .filter((candidate) => areUsersCompatible(me, candidate));

    if (candidates.length === 0) {
      setConnectingStatus("Waiting for an available stranger...");
      return;
    }

    const candidate = candidates[0];

    try {
      const matchedRoomId = await runTransaction(db, async (transaction) => {
        const myWaitingRef = doc(db, "waitingUsers", currentUser.uid);
        const candidateWaitingRef = doc(db, "waitingUsers", candidate.uid);

        const [mySnapshot, candidateSnapshot] = await Promise.all([
          transaction.get(myWaitingRef),
          transaction.get(candidateWaitingRef),
        ]);

        if (!mySnapshot.exists() || !candidateSnapshot.exists()) {
          throw new Error("Queue entry expired");
        }

        const myData = mySnapshot.data() as WaitingUser;
        const candidateData = candidateSnapshot.data() as WaitingUser;

        if (
          myData.status !== "searching" ||
          candidateData.status !== "searching" ||
          myData.mode !== mode ||
          candidateData.mode !== mode ||
          !areUsersCompatible(myData, candidateData)
        ) {
          throw new Error("Candidate no longer available");
        }

        const roomRef = doc(collection(db, "rooms"));

        transaction.set(roomRef, {
          status: "active",
          mode,
          participants: [currentUser.uid, candidate.uid],
          participantProfiles: [
            {
              uid: currentUser.uid,
              gender: myData.profile.gender,
              age: myData.profile.age,
              countryCode: myData.profile.countryCode ?? null,
            },
            {
              uid: candidate.uid,
              gender: candidateData.profile.gender,
              age: candidateData.profile.age,
              countryCode: candidateData.profile.countryCode ?? null,
            },
          ],
          createdAt: serverTimestamp(),
        });

        transaction.update(myWaitingRef, {
          status: "matched",
          roomId: roomRef.id,
          matchedAt: serverTimestamp(),
        });

        transaction.update(candidateWaitingRef, {
          status: "matched",
          roomId: roomRef.id,
          matchedAt: serverTimestamp(),
        });

        return roomRef.id;
      });

      setConnectingStatus("Stranger found. Connecting...");
      setActiveRoomId(matchedRoomId);
    } catch {
      setConnectingStatus("Retrying match...");
    }
  };

  const startSearching = async (filters: ChatFilters) => {
    if (!user || !profile || !chatMode) {
      return;
    }

    cleanupWaitIntervals();
    setIsConnecting(true);
    setConnectingStatus("Checking availability...");
    setShowNextStrangerPrompt(false);
    setMessages([]);
    setText("");
    clearAttachment();
    setActiveRoomId(null);

    const waitingRef = doc(db, "waitingUsers", user.uid);
    await setDoc(
      waitingRef,
      {
        uid: user.uid,
        status: "searching",
        mode: chatMode,
        filters,
        profile: {
          gender: profile.gender,
          age: profile.age,
          countryCode: profile.countryCode ?? null,
        },
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      },
      { merge: true },
    );

    await tryMatchWithAvailableUser(filters, chatMode, user, profile);

    retryMatchIntervalRef.current = window.setInterval(() => {
      void tryMatchWithAvailableUser(filters, chatMode, user, profile);
    }, 2500);

    heartbeatIntervalRef.current = window.setInterval(() => {
      void (async () => {
        try {
          await updateDoc(waitingRef, { lastSeenAt: serverTimestamp() });
        } catch (error) {
          const firebaseCode =
            typeof error === "object" && error !== null && "code" in error
              ? String(error.code)
              : "unknown";

          if (firebaseCode === "not-found") {
            if (heartbeatIntervalRef.current) {
              window.clearInterval(heartbeatIntervalRef.current);
              heartbeatIntervalRef.current = null;
            }
            return;
          }

          console.error("Waiting heartbeat update failed", {
            uid: user.uid,
            error: formatFirebaseError(error),
          });
        }
      })();
    }, 8000);
  };

  const stopSearching = async () => {
    if (!user) {
      return;
    }

    cleanupWaitIntervals();

    try {
      await deleteDoc(doc(db, "waitingUsers", user.uid));
    } catch {
      // Ignore if already removed.
    }
  };

  const onSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(URL.createObjectURL(file));
    setSelectedFileName(file.name);
    setSelectedImageFile(file);
  };

  const clearAttachment = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(null);
    setSelectedFileName(null);
    setSelectedImageFile(null);
    setImageTimerSeconds(0);
    setImageUploadProgress(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sendMessage = async () => {
    if (!user || !activeRoomId || isSendingMessage || (!text.trim() && !selectedImageFile)) {
      return;
    }

    setSendError(null);
    const outgoingText = text.trim() || null;

    let imageUrl: string | undefined;
    let imagePath: string | null = null;
    let imageViewTimer: number | null = null;
    setIsSendingMessage(true);
    setImageUploadProgress(selectedImageFile ? 0 : null);

    try {
      if (selectedImageFile) {
        imagePath = `chatUploads/${activeRoomId}/${user.uid}/${Date.now()}-${selectedImageFile.name}`;
        const uploadRef = ref(storage, imagePath);
        const uploadTask = uploadBytesResumable(uploadRef, selectedImageFile);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              if (snapshot.totalBytes === 0) {
                return;
              }

              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setImageUploadProgress(progress);
            },
            reject,
            resolve,
          );
        });

        imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
        imageViewTimer = imageTimerSeconds > 0 ? imageTimerSeconds : null;
      }

      const messagePayload: {
        senderId: string;
        text: string | null;
        createdAt: ReturnType<typeof serverTimestamp>;
        imageUrl?: string;
        imagePath?: string;
        imageViewTimerSeconds?: number;
        imageRevealAtMs?: null;
        imageExpiresAtMs?: null;
        imageDeleted?: boolean;
      } = {
        senderId: user.uid,
        text: outgoingText,
        createdAt: serverTimestamp(),
      };

      if (imageUrl && imagePath) {
        messagePayload.imageUrl = imageUrl;
        messagePayload.imagePath = imagePath;
        messagePayload.imageViewTimerSeconds = imageViewTimer ?? 0;
        messagePayload.imageRevealAtMs = null;
        messagePayload.imageExpiresAtMs = null;
        messagePayload.imageDeleted = false;
      }

      await addDoc(collection(db, "rooms", activeRoomId, "messages"), messagePayload);

      if (typingIdleTimeoutRef.current) {
        window.clearTimeout(typingIdleTimeoutRef.current);
        typingIdleTimeoutRef.current = null;
      }

      await setTypingStatus(false);
      setText("");
      clearAttachment();
    } catch (error) {
      console.error("Message send failed", {
        roomId: activeRoomId,
        uid: user.uid,
        hasImage: Boolean(selectedImageFile),
        error: formatFirebaseError(error),
      });
      setSendError(
        selectedImageFile
          ? "Send failed. Image upload or message write was blocked. Check console and Firebase rules."
          : "Send failed. Message write was blocked. Check console and Firebase rules.",
      );
    } finally {
      setIsSendingMessage(false);
      setImageUploadProgress(null);
    }
  };

  const onRevealTimedImage = async (messageId: string, timerSeconds: number) => {
    if (!activeRoomId || timerSeconds <= 0) {
      return;
    }

    const messageRef = doc(db, "rooms", activeRoomId, "messages", messageId);

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(messageRef);
        if (!snapshot.exists()) {
          return;
        }

        const data = snapshot.data() as {
          senderId?: string;
          imageUrl?: string | null;
          imageDeleted?: boolean;
          imageExpiresAtMs?: number | null;
        };

        if (!data.imageUrl || data.imageDeleted || typeof data.imageExpiresAtMs === "number") {
          return;
        }

        if (data.senderId === user?.uid) {
          return;
        }

        const nowMs = Date.now();
        transaction.update(messageRef, {
          imageRevealAtMs: nowMs,
          imageExpiresAtMs: nowMs + timerSeconds * 1000,
        });
      });
    } catch {
      // Ignore reveal race conditions.
    }
  };

  const loginAnonymously = async () => {
    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      await signInAnonymously(auth);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Guest login failed. Try again.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google login failed. Try again.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const loginWithEmail = async () => {
    if (!email || !password) {
      setAuthError("Enter email and password.");
      return;
    }

    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);

      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Email login failed. Try again.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email) {
      setAuthError("Enter your email above, then click Forgot Password.");
      return;
    }

    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      await sendPasswordResetEmail(auth, email);
      setAuthNotice("Password reset email sent. Check your inbox.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not send reset email. Try again.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try {
      setAuthBusy(true);
      await markRoomEnded();
      await stopSearching();
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  };

  const isAuthenticated = Boolean(user);

  const saveProfile = () => {
    const parsedAge = Number(profileAge);

    if (!profileGender) {
      setProfileError("Please choose your gender.");
      return;
    }

    if (!Number.isInteger(parsedAge) || parsedAge < 5 || parsedAge > 99) {
      setProfileError("Enter a valid age between 5 and 99.");
      return;
    }

    if (!user) {
      setProfileError("User session not found. Please login again.");
      return;
    }

    const nextProfile: UserProfile = {
      gender: profileGender,
      age: parsedAge,
      country: profileCountry || "Unknown",
      countryCode: profileCountryCode || undefined,
    };

    window.localStorage.setItem(`profile_${user.uid}`, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setProfileError(null);
  };

  if (authLoading) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={false}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={true}
          />
          <section className="auth-shell">
            <article className="auth-panel auth-loading">Checking account session...</article>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
          />
          <AuthView
            authMethod={authMethod}
            setAuthMethod={setAuthMethod}
            authMode={authMode}
            setAuthMode={setAuthMode}
            authBusy={authBusy}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            setAuthError={setAuthError}
            authError={authError}
            authNotice={authNotice}
            emailInputRef={emailInputRef}
            loginAnonymously={loginAnonymously}
            loginWithGoogle={loginWithGoogle}
            loginWithEmail={loginWithEmail}
            resetPassword={resetPassword}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
          />
          <ProfileSetupView
            profileGender={profileGender}
            setProfileGender={setProfileGender}
            profileAge={profileAge}
            setProfileAge={setProfileAge}
            profileCountry={profileCountry}
            profileCountryCode={profileCountryCode}
            profileError={profileError}
            onBack={logout}
            onContinue={saveProfile}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!chatMode) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
          />
          <ModeSelectionView
            onChooseMode={(mode) => {
              setChatMode(mode);
              setChatFilters(null);
            }}
            onBack={async () => {
              await markRoomEnded();
              await stopSearching();
              setChatMode(null);
              setProfileGender(profile.gender);
              setProfileAge(String(profile.age));
            }}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!chatFilters) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
          />
          <FilterOptionsView
            initialFilters={{
              gender: "Any",
              ageGroup: "Any age",
              style: "Any style",
              country: "Any",
            }}
            onApply={(filters) => {
              setChatFilters(filters);
              void startSearching(filters);
            }}
            onBack={async () => {
              await stopSearching();
              setChatMode(null);
            }}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <main className="screen screen-chat">
        <TopNav
          isAuthenticated={isAuthenticated}
          onLogin={() => {
            setAuthMethod("email");
            emailInputRef.current?.focus();
          }}
          onLogout={logout}
          isWorking={authBusy}
        />
        <ChatRoomView
          strangerProfile={strangerProfile}
          chatMode={chatMode}
          chatFilters={chatFilters}
          isConnecting={isConnecting}
          connectingStatus={connectingStatus}
          showNextStrangerPrompt={showNextStrangerPrompt}
          strangerIsTyping={strangerIsTyping}
          messages={messages}
          text={text}
          setText={handleTextChange}
          sendMessage={sendMessage}
          onRevealTimedImage={onRevealTimedImage}
          fileInputRef={fileInputRef}
          onSelectImage={onSelectImage}
          clearAttachment={clearAttachment}
          imagePreview={imagePreview}
          selectedFileName={selectedFileName}
          imageTimerSeconds={imageTimerSeconds}
          setImageTimerSeconds={setImageTimerSeconds}
          isSendingMessage={isSendingMessage}
          imageUploadProgress={imageUploadProgress}
          sendError={sendError}
          onLeaveChat={(filters) => {
            void (async () => {
              await markRoomEnded();
              await stopSearching();
              await startSearching(filters);
            })();
          }}
          onChangeMode={() => {
            void (async () => {
              await markRoomEnded();
              await stopSearching();
              setChatFilters(null);
            })();
          }}
          onNextStranger={() => {
            void startSearching(chatFilters);
          }}
        />
      </main>
      <div className="hidden md:block">
        <SiteFooter />
      </div>
    </>
  );
}
