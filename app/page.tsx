"use client";

import { auth, db, googleProvider, storage } from "@/lib/firebase";
import {
  decryptBytes,
  decryptString,
  deriveRoomKey,
  encryptBytes,
  encryptString,
  exportPrivateJwk,
  exportPublicJwk,
  generateE2EEKeyPair,
  importPrivateJwk,
  importPublicJwk,
  payloadBase64ToBytes,
} from "@/lib/e2ee";
import {
  AuthView,
  ChatFilters,
  ChatMode,
  ChatRoomView,
  FilterOptionsView,
  ModeSelectionView,
  ProfileGender,
  ProfileSetupView,
  type ChatMessage,
  type UserProfile,
} from "@/components/chat-ui";
import { LandingPageSection } from "@/components/landing-page";
import { SiteFooter } from "@/components/footer";
import { TopNav } from "@/components/navbar";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
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
import { deleteObject, getDownloadURL, listAll, ref, uploadBytesResumable, type StorageReference } from "firebase/storage";
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
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { getUserRole } from "@/lib/admin";

type WaitingUser = {
  uid: string;
  status: "searching" | "matched";
  mode: ChatMode;
  roomId?: string;
  lastSeenAt?: { toMillis?: () => number } | number;
  filters: ChatFilters;
  profile: {
    gender: ProfileGender;
    age: number;
    countryCode?: string;
  };
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isValidWaitingUser = (value: unknown): value is WaitingUser => {
  if (!isObjectRecord(value)) {
    return false;
  }

  const status = value.status;
  const mode = value.mode;
  const profile = value.profile;
  const filters = value.filters;

  if (
    typeof value.uid !== "string" ||
    (status !== "searching" && status !== "matched") ||
    (mode !== "text" && mode !== "video" && mode !== "group")
  ) {
    return false;
  }

  if (!isObjectRecord(profile) || !isObjectRecord(filters)) {
    return false;
  }

  if (
    (profile.gender !== "Male" && profile.gender !== "Female" && profile.gender !== "Other") ||
    typeof profile.age !== "number" ||
    (typeof profile.countryCode !== "undefined" && profile.countryCode !== null && typeof profile.countryCode !== "string")
  ) {
    return false;
  }

  return (
    (filters.gender === "Any" || filters.gender === "Male" || filters.gender === "Female" || filters.gender === "Other") &&
    (filters.ageGroup === "Any age" || filters.ageGroup === "Under 18" || filters.ageGroup === "18-25" || filters.ageGroup === "25+") &&
    (filters.style === "Any style" || filters.style === "Casual" || filters.style === "Intimate") &&
    (typeof filters.country === "string")
  );
};

const toTimestampMillis = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "object" && value !== null && "toMillis" in value) {
    try {
      const maybeToMillis = (value as { toMillis?: () => number }).toMillis;
      const millis = typeof maybeToMillis === "function" ? maybeToMillis() : NaN;
      return Number.isFinite(millis) ? millis : null;
    } catch {
      return null;
    }
  }

  return null;
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
const ROOM_PRESENCE_HEARTBEAT_MS = 5000;
const ROOM_PRESENCE_TIMEOUT_MS = 45000;
const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
const PENDING_STRANGER_PROFILE: UserProfile = {
  gender: "Other",
  age: 0,
};

const inferImageMimeTypeFromName = (fileName: string): string | null => {
  const lowerName = fileName.trim().toLowerCase();
  if (lowerName.endsWith(".gif")) {
    return "image/gif";
  }
  if (lowerName.endsWith(".png")) {
    return "image/png";
  }
  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return null;
};

const findEmbeddableImageUrlInText = (value?: string): { url: string; mimeType: string; matchedText: string } | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/https?:\/\/\S+/i);
  if (!match) {
    return null;
  }

  const rawUrl = match[0].replace(/[),.;!?]+$/, "");
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  const inferredMimeType = inferImageMimeTypeFromName(parsedUrl.pathname);
  if (!inferredMimeType) {
    return null;
  }

  return {
    url: parsedUrl.toString(),
    mimeType: inferredMimeType,
    matchedText: match[0],
  };
};

type PersistedChatSession = {
  roomId: string;
  chatMode: ChatMode;
  chatFilters: ChatFilters;
};

type RoomE2EEKeys = {
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
};

const getChatSessionStorageKey = (uid: string): string => `chat_session_${uid}`;
const getChatModeStorageKey = (uid: string): string => `chat_mode_${uid}`;
const getRoomE2EEKeyStorageKey = (roomId: string, uid: string): string => `room_e2ee_${roomId}_${uid}`;

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

const getAuthProviderType = (nextUser: User): "anonymous" | "google" | "email" => {
  if (nextUser.isAnonymous) {
    return "anonymous";
  }

  const providerIds = nextUser.providerData
    .map((provider) => provider.providerId)
    .filter((providerId): providerId is string => Boolean(providerId));

  if (providerIds.includes("google.com")) {
    return "google";
  }

  return "email";
};

export default function Home() {
  const router = useRouter();
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
  const [strangerProfile, setStrangerProfile] = useState<UserProfile>(PENDING_STRANGER_PROFILE);
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
  const [roomParticipants, setRoomParticipants] = useState<string[]>([]);
  const [strangerIsTyping, setStrangerIsTyping] = useState(false);
  const [showNextStrangerPrompt, setShowNextStrangerPrompt] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRoleLoading, setAdminRoleLoading] = useState(false);
  const [e2eeReadyVersion, setE2eeReadyVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const roomUnsubRef = useRef<(() => void) | null>(null);
  const roomMessagesUnsubRef = useRef<(() => void) | null>(null);
  const waitingUnsubRef = useRef<(() => void) | null>(null);
  const videoRoomUnsubRef = useRef<(() => void) | null>(null);
  const videoCandidatesUnsubRef = useRef<(() => void) | null>(null);
  const retryMatchIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const roomPresenceIntervalRef = useRef<number | null>(null);
  const typingIdleTimeoutRef = useRef<number | null>(null);
  const imageCleanupIntervalRef = useRef<number | null>(null);
  const pendingSendRetryIntervalRef = useRef<number | null>(null);
  const selfTypingRef = useRef(false);
  const activeRoomIdRef = useRef<string | null>(null);
  const hasAttemptedSessionRestoreRef = useRef(false);
  const disconnectHandledRoomRef = useRef<string | null>(null);
  const roomPrivateKeyRef = useRef<CryptoKey | null>(null);
  const roomPublicJwkRef = useRef<JsonWebKey | null>(null);
  const roomCipherKeyRef = useRef<CryptoKey | null>(null);
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const remoteMediaStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const videoOfferSentRef = useRef(false);
  const videoAnswerSentRef = useRef(false);
  const processedCandidateIdsRef = useRef<Set<string>>(new Set());
  const pendingRemoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const processedFallbackCandidateSignaturesRef = useRef<Set<string>>(new Set());
  const decryptedTextCacheRef = useRef<Map<string, { ciphertext: string; iv: string; text: string }>>(new Map());
  const decryptedImageUrlCacheRef = useRef<Map<string, { sourceUrl: string; objectUrl: string }>>(new Map());

  const hasSecureCryptoContext = (): boolean => {
    return typeof window !== "undefined" && window.isSecureContext && Boolean(window.crypto?.subtle);
  };

  const clearE2EECaches = () => {
    decryptedTextCacheRef.current.clear();
    for (const cacheEntry of decryptedImageUrlCacheRef.current.values()) {
      URL.revokeObjectURL(cacheEntry.objectUrl);
    }
    decryptedImageUrlCacheRef.current.clear();
    roomPrivateKeyRef.current = null;
    roomPublicJwkRef.current = null;
    roomCipherKeyRef.current = null;
  };

  const updateRoomParticipants = (nextParticipants: string[]) => {
    const normalized = Array.from(new Set(nextParticipants));
    setRoomParticipants((current) => {
      if (current.length === normalized.length && current.every((uid, index) => uid === normalized[index])) {
        return current;
      }
      return normalized;
    });
  };

  const cleanupVideoSession = () => {
    videoRoomUnsubRef.current?.();
    videoRoomUnsubRef.current = null;
    videoCandidatesUnsubRef.current?.();
    videoCandidatesUnsubRef.current = null;
    processedCandidateIdsRef.current.clear();
    pendingRemoteCandidatesRef.current = [];
    processedFallbackCandidateSignaturesRef.current.clear();
    videoOfferSentRef.current = false;
    videoAnswerSentRef.current = false;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localMediaStreamRef.current) {
      localMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      localMediaStreamRef.current = null;
    }

    if (remoteMediaStreamRef.current) {
      remoteMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteMediaStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setHasRemoteVideo(false);
    setLocalVideoEnabled(true);
    setLocalAudioEnabled(true);
    setCameraFacingMode("user");
    setVideoError(null);
  };

  const toggleLocalVideo = () => {
    const localStream = localMediaStreamRef.current;
    if (!localStream) {
      return;
    }

    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) {
      return;
    }

    const shouldEnable = !videoTracks[0].enabled;
    videoTracks.forEach((track) => {
      track.enabled = shouldEnable;
    });
    setLocalVideoEnabled(shouldEnable);
  };

  const toggleLocalAudio = () => {
    const localStream = localMediaStreamRef.current;
    if (!localStream) {
      return;
    }

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    const shouldEnable = !audioTracks[0].enabled;
    audioTracks.forEach((track) => {
      track.enabled = shouldEnable;
    });
    setLocalAudioEnabled(shouldEnable);
  };

  const switchCamera = async () => {
    const localStream = localMediaStreamRef.current;
    if (!localStream) {
      return;
    }

    const targetFacingMode: "user" | "environment" = cameraFacingMode === "user" ? "environment" : "user";

    try {
      const switchedStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: targetFacingMode } },
        audio: false,
      });

      const newVideoTrack = switchedStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        setVideoError("Could not switch camera.");
        return;
      }

      const existingVideoTracks = localStream.getVideoTracks();
      existingVideoTracks.forEach((track) => {
        localStream.removeTrack(track);
        track.stop();
      });

      localStream.addTrack(newVideoTrack);
      newVideoTrack.enabled = localVideoEnabled;

      const peerConnection = peerConnectionRef.current;
      const videoSender = peerConnection?.getSenders().find((sender) => sender.track?.kind === "video");
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        void localVideoRef.current.play().catch(() => {
          // Ignore autoplay restrictions.
        });
      }

      setCameraFacingMode(targetFacingMode);
      setVideoError(null);
    } catch {
      setVideoError("Camera switch is not available on this device/browser.");
    }
  };

  const flushPendingRemoteCandidates = async (peerConnection: RTCPeerConnection) => {
    if (!peerConnection.remoteDescription || pendingRemoteCandidatesRef.current.length === 0) {
      return;
    }

    const pending = [...pendingRemoteCandidatesRef.current];
    pendingRemoteCandidatesRef.current = [];

    for (const candidateInit of pending) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch {
        // Ignore transient addIceCandidate failures during renegotiation.
      }
    }
  };

  const getPreferredLocalMediaStream = async (
    facingMode: "user" | "environment",
  ): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: true,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });
      }
    }
  };

  const deleteStorageFolderRecursively = async (folderRef: StorageReference): Promise<void> => {
    const listing = await listAll(folderRef);

    await Promise.all(
      listing.items.map(async (itemRef) => {
        try {
          await deleteObject(itemRef);
        } catch {
          // Ignore already-deleted files.
        }
      }),
    );

    await Promise.all(
      listing.prefixes.map(async (childFolderRef) => {
        await deleteStorageFolderRecursively(childFolderRef);
      }),
    );
  };

  const deleteRoomStorageFiles = async (roomId: string, uid: string): Promise<void> => {
    try {
      await deleteStorageFolderRecursively(ref(storage, `chatUploads/${roomId}/${uid}`));
    } catch {
      // Ignore if room folder does not exist or listing is blocked.
    }
  };

  const deleteRoomStorageFilesForParticipants = async (roomId: string, participantUids: string[]): Promise<void> => {
    const uniqueParticipantUids = Array.from(new Set(participantUids.filter(Boolean)));

    await Promise.all(
      uniqueParticipantUids.map(async (uid) => {
        await deleteRoomStorageFiles(roomId, uid);
      }),
    );
  };

  const deleteRoomFirestoreData = async (roomId: string): Promise<void> => {
    const messagesCollectionRef = collection(db, "rooms", roomId, "messages");

    while (true) {
      const snapshot = await getDocs(query(messagesCollectionRef, limit(200)));
      if (snapshot.empty) {
        break;
      }

      await Promise.all(
        snapshot.docs.map(async (messageDoc) => {
          try {
            await deleteDoc(messageDoc.ref);
          } catch {
            // Ignore already-deleted message docs.
          }
        }),
      );

      if (snapshot.size < 200) {
        break;
      }
    }

    try {
      await deleteDoc(doc(db, "rooms", roomId));
    } catch {
      // Ignore already-deleted room docs.
    }
  };

  const deleteAllRoomData = async (roomId: string, participantUids: string[]): Promise<void> => {
    await deleteRoomStorageFilesForParticipants(roomId, participantUids);
    await deleteRoomFirestoreData(roomId);
  };

  const getOrCreateRoomKeyPair = async (roomId: string, uid: string): Promise<RoomE2EEKeys> => {
    if (!hasSecureCryptoContext()) {
      throw new Error("Secure context unavailable. Use HTTPS (or localhost) to enable encrypted chat.");
    }

    const storageKey = getRoomE2EEKeyStorageKey(roomId, uid);
    const existingRaw = window.sessionStorage.getItem(storageKey);

    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as RoomE2EEKeys;
        if (existing.publicJwk && existing.privateJwk) {
          return existing;
        }
      } catch {
        window.sessionStorage.removeItem(storageKey);
      }
    }

    const keyPair = await generateE2EEKeyPair();
    const [publicJwk, privateJwk] = await Promise.all([
      exportPublicJwk(keyPair.publicKey),
      exportPrivateJwk(keyPair.privateKey),
    ]);

    const nextKeys: RoomE2EEKeys = {
      publicJwk,
      privateJwk,
    };

    window.sessionStorage.setItem(storageKey, JSON.stringify(nextKeys));
    return nextKeys;
  };

  const jwkSignature = (jwk?: JsonWebKey): string => {
    try {
      return JSON.stringify(jwk ?? null);
    } catch {
      return "";
    }
  };

  const ensureRoomE2EEKey = async (
    roomId: string,
    uid: string,
    roomData: { participants?: string[]; e2eePublicKeys?: Record<string, JsonWebKey> },
  ): Promise<CryptoKey | null> => {
    const keyPair = await getOrCreateRoomKeyPair(roomId, uid);
    const localPublicJwkSignature = jwkSignature(keyPair.publicJwk);
    const activePublicJwkSignature = jwkSignature(roomPublicJwkRef.current ?? undefined);
    roomPublicJwkRef.current = keyPair.publicJwk;

    if (!roomPrivateKeyRef.current || activePublicJwkSignature !== localPublicJwkSignature) {
      roomPrivateKeyRef.current = await importPrivateJwk(keyPair.privateJwk);
    }

    const roomRef = doc(db, "rooms", roomId);
    const existingPublicJwk = roomData.e2eePublicKeys?.[uid];
    const existingPublicJwkSignature = jwkSignature(existingPublicJwk);

    if (!existingPublicJwk || existingPublicJwkSignature !== localPublicJwkSignature) {
      try {
        await updateDoc(roomRef, {
          [`e2eePublicKeys.${uid}`]: keyPair.publicJwk,
          e2eeVersion: "v1",
          e2eeUpdatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore races while publishing key.
      }

      roomCipherKeyRef.current = null;
      return null;
    }

    const peerUid = roomData.participants?.find((participantId) => participantId !== uid);
    if (!peerUid) {
      return null;
    }

    const peerPublicJwk = roomData.e2eePublicKeys?.[peerUid];
    if (!peerPublicJwk) {
      return null;
    }

    const peerPublicKey = await importPublicJwk(peerPublicJwk);
    const hadCipherKey = Boolean(roomCipherKeyRef.current);
    const cipherKey = await deriveRoomKey(roomPrivateKeyRef.current, peerPublicKey, roomId);
    roomCipherKeyRef.current = cipherKey;
    if (!hadCipherKey) {
      setE2eeReadyVersion((current) => current + 1);
    }
    return cipherKey;
  };

  const waitForRoomCipherKey = async (timeoutMs = 12000): Promise<CryptoKey | null> => {
    if (roomCipherKeyRef.current) {
      return roomCipherKeyRef.current;
    }

    const startedAt = Date.now();

    return new Promise((resolve) => {
      const intervalId = window.setInterval(() => {
        if (roomCipherKeyRef.current) {
          window.clearInterval(intervalId);
          resolve(roomCipherKeyRef.current);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(intervalId);
          resolve(null);
        }
      }, 120);
    });
  };

  const clearPendingSendRetry = () => {
    if (pendingSendRetryIntervalRef.current) {
      window.clearInterval(pendingSendRetryIntervalRef.current);
      pendingSendRetryIntervalRef.current = null;
    }
  };

  const schedulePendingSendRetry = (sendFn: () => Promise<void>) => {
    if (pendingSendRetryIntervalRef.current) {
      return;
    }

    const startedAt = Date.now();
    pendingSendRetryIntervalRef.current = window.setInterval(() => {
      if (!activeRoomIdRef.current) {
        clearPendingSendRetry();
        return;
      }

      if (roomCipherKeyRef.current) {
        clearPendingSendRetry();
        void sendFn();
        return;
      }

      if (Date.now() - startedAt > 30000) {
        clearPendingSendRetry();
        setSendError("Secure channel setup timed out. Please reconnect and try again.");
      }
    }, 400);
  };

  const formatFirebaseError = (error: unknown): string => {
    const fallback = "Unknown error";

    if (typeof error === "object" && error !== null) {
      const maybeCode = "code" in error ? String(error.code) : fallback;
      const maybeMessage = "message" in error ? String(error.message) : fallback;
      return `${maybeCode}: ${maybeMessage}`;
    }

    return typeof error === "string" ? error : fallback;
  };

  const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = "";
    const chunk = 0x8000;

    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }

    return btoa(binary);
  };

  const detectImageMimeType = (bytes: Uint8Array): string | null => {
    if (bytes.length >= 12) {
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
      }

      if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      ) {
        return "image/png";
      }

      if (
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61
      ) {
        return "image/gif";
      }

      if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      ) {
        return "image/webp";
      }
    }

    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);

      if (!nextUser) {
        return;
      }

      const authProvider = getAuthProviderType(nextUser);
      void setDoc(
        doc(db, "users", nextUser.uid),
        {
          uid: nextUser.uid,
          email: nextUser.email ?? null,
          displayName: nextUser.displayName ?? null,
          authProvider,
          authProviderIds: nextUser.providerData
            .map((provider) => provider.providerId)
            .filter((providerId): providerId is string => Boolean(providerId)),
          isAnonymous: nextUser.isAnonymous,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(() => {
        // Ignore analytics profile write failures.
      });
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
      if (roomPresenceIntervalRef.current) {
        window.clearInterval(roomPresenceIntervalRef.current);
      }
      if (typingIdleTimeoutRef.current) {
        window.clearTimeout(typingIdleTimeoutRef.current);
      }
      if (imageCleanupIntervalRef.current) {
        window.clearInterval(imageCleanupIntervalRef.current);
      }
      cleanupVideoSession();
      clearPendingSendRetry();

      clearE2EECaches();
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
    if (activeRoomId) {
      return;
    }

    clearPendingSendRetry();
    updateRoomParticipants([]);
    cleanupVideoSession();
    setStrangerProfile(PENDING_STRANGER_PROFILE);

    clearE2EECaches();
  }, [activeRoomId]);

  useEffect(() => {
    if (chatMode !== "video" || !activeRoomId || !user) {
      cleanupVideoSession();
      return;
    }

    const otherUid = roomParticipants.find((participantUid) => participantUid !== user.uid);
    if (!otherUid) {
      return;
    }

    let cancelled = false;
    const roomRef = doc(db, "rooms", activeRoomId);
    const candidatesCollectionRef = collection(db, "rooms", activeRoomId, "webrtcCandidates");
    const isOfferer = user.uid < otherUid;

    const setupVideo = async () => {
      try {
        const localStream = await getPreferredLocalMediaStream(cameraFacingMode);

        if (cancelled) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }

        localMediaStreamRef.current = localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
          void localVideoRef.current.play().catch(() => {
            // Ignore autoplay restrictions.
          });
        }

        setLocalVideoEnabled(true);
        setLocalAudioEnabled(localStream.getAudioTracks().some((track) => track.enabled));

        const currentFacingMode = localStream.getVideoTracks()[0]?.getSettings().facingMode;
        if (currentFacingMode === "environment" || currentFacingMode === "user") {
          setCameraFacingMode(currentFacingMode);
        }

        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            {
              urls: "turn:openrelay.metered.ca:80",
              username: "openrelayproject",
              credential: "openrelayproject",
            },
            {
              urls: "turn:openrelay.metered.ca:443",
              username: "openrelayproject",
              credential: "openrelayproject",
            },
            {
              urls: "turn:openrelay.metered.ca:443?transport=tcp",
              username: "openrelayproject",
              credential: "openrelayproject",
            },
          ],
        });
        peerConnectionRef.current = peerConnection;

        const remoteStream = new MediaStream();
        remoteMediaStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }

        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
          const stream = event.streams[0];
          if (!stream) {
            return;
          }

          stream.getTracks().forEach((track) => {
            const exists = remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id);
            if (!exists) {
              remoteStream.addTrack(track);
            }
          });

          setHasRemoteVideo(remoteStream.getVideoTracks().length > 0);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            void remoteVideoRef.current.play().catch(() => {
              // Ignore autoplay restrictions.
            });
          }
        };

        peerConnection.onicecandidate = (event) => {
          if (!event.candidate) {
            return;
          }

          void addDoc(candidatesCollectionRef, {
            fromUid: user.uid,
            toUid: otherUid,
            candidate: event.candidate.toJSON(),
            createdAt: serverTimestamp(),
          }).catch(() => {
            // Fallback candidate signaling on room doc for restrictive rules.
            void updateDoc(roomRef, {
              [`webrtc.fallbackCandidatesBy.${user.uid}`]: arrayUnion(event.candidate?.toJSON()),
              webrtcUpdatedAt: serverTimestamp(),
            }).catch(() => {
              setVideoError("Video signaling failed while exchanging network candidates.");
            });
          });

          // Also write fallback candidates for reliability when one channel lags.
          void updateDoc(roomRef, {
            [`webrtc.fallbackCandidatesBy.${user.uid}`]: arrayUnion(event.candidate?.toJSON()),
            webrtcUpdatedAt: serverTimestamp(),
          }).catch(() => {
            // Ignore fallback write races.
          });
        };

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === "connected") {
            setVideoError(null);
            return;
          }

          if (peerConnection.connectionState === "disconnected") {
            setVideoError("Connection unstable. Reconnecting video...");

            if (isOfferer) {
              void (async () => {
                try {
                  peerConnection.restartIce();
                  const restartOffer = await peerConnection.createOffer({ iceRestart: true });
                  await peerConnection.setLocalDescription(restartOffer);
                  await updateDoc(roomRef, {
                    [`webrtc.offerBy.${user.uid}`]: {
                      type: restartOffer.type,
                      sdp: restartOffer.sdp,
                    },
                    webrtcUpdatedAt: serverTimestamp(),
                  });
                } catch {
                  // Ignore restart races.
                }
              })();
            }
            return;
          }

          if (peerConnection.connectionState === "failed") {
            setVideoError("Video connection failed. Try reconnecting.");
          }
        };

        videoCandidatesUnsubRef.current?.();
        videoCandidatesUnsubRef.current = onSnapshot(
          query(candidatesCollectionRef, where("toUid", "==", user.uid), limit(200)),
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type !== "added") {
                return;
              }

              if (processedCandidateIdsRef.current.has(change.doc.id)) {
                return;
              }

              processedCandidateIdsRef.current.add(change.doc.id);
              const data = change.doc.data() as {
                candidate?: RTCIceCandidateInit;
              };

              if (data.candidate) {
                if (!peerConnection.remoteDescription) {
                  pendingRemoteCandidatesRef.current.push(data.candidate);
                  return;
                }

                void peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {
                  // Queue again and retry after next remote description update.
                  pendingRemoteCandidatesRef.current.push(data.candidate as RTCIceCandidateInit);
                });
              }
            });
          },
          () => {
            setVideoError("Video signaling read failed for network candidates.");
          },
        );

        videoRoomUnsubRef.current?.();
        videoRoomUnsubRef.current = onSnapshot(
          roomRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              return;
            }

            const roomData = snapshot.data() as {
              webrtc?: {
                offerBy?: Record<string, { type: RTCSdpType; sdp: string }>;
                answerBy?: Record<string, { type: RTCSdpType; sdp: string }>;
                fallbackCandidatesBy?: Record<string, RTCIceCandidateInit[]>;
              };
            };

            const remoteOffer = roomData.webrtc?.offerBy?.[otherUid];
            const remoteAnswer = roomData.webrtc?.answerBy?.[otherUid];
            const fallbackCandidates = roomData.webrtc?.fallbackCandidatesBy?.[otherUid] ?? [];

            fallbackCandidates.forEach((candidateInit) => {
              const signature = JSON.stringify(candidateInit);
              if (processedFallbackCandidateSignaturesRef.current.has(signature)) {
                return;
              }

              processedFallbackCandidateSignaturesRef.current.add(signature);
              if (!peerConnection.remoteDescription) {
                pendingRemoteCandidatesRef.current.push(candidateInit);
                return;
              }

              void peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(() => {
                pendingRemoteCandidatesRef.current.push(candidateInit);
              });
            });

            if (!isOfferer && remoteOffer && !peerConnection.currentRemoteDescription && !videoAnswerSentRef.current) {
              void (async () => {
                try {
                  await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));
                  await flushPendingRemoteCandidates(peerConnection);
                  const createdAnswer = await peerConnection.createAnswer();
                  await peerConnection.setLocalDescription(createdAnswer);
                  videoAnswerSentRef.current = true;
                  await updateDoc(roomRef, {
                    [`webrtc.answerBy.${user.uid}`]: {
                      type: createdAnswer.type,
                      sdp: createdAnswer.sdp,
                    },
                    webrtcUpdatedAt: serverTimestamp(),
                  });
                } catch {
                  setVideoError("Could not establish video answer.");
                }
              })();
            }

            if (isOfferer && remoteAnswer && !peerConnection.currentRemoteDescription) {
              void (async () => {
                try {
                  await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
                  await flushPendingRemoteCandidates(peerConnection);
                } catch {
                  setVideoError("Could not finalize video connection.");
                }
              })();
            }
          },
          () => {
            setVideoError("Video signaling read failed for offer/answer sync.");
          },
        );

        if (isOfferer && !videoOfferSentRef.current) {
          const createdOffer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(createdOffer);
          videoOfferSentRef.current = true;

          try {
            await updateDoc(roomRef, {
              [`webrtc.offerBy.${user.uid}`]: {
                type: createdOffer.type,
                sdp: createdOffer.sdp,
              },
              webrtcUpdatedAt: serverTimestamp(),
            });
          } catch {
            setVideoError("Video signaling failed while sending offer.");
          }
        }
      } catch {
        setVideoError("Camera or microphone permission is required for video mode.");
      }
    };

    void setupVideo();

    return () => {
      cancelled = true;
      cleanupVideoSession();
    };
  }, [activeRoomId, chatMode, roomParticipants, user]);

  useEffect(() => {
    if (!activeRoomId || !user) {
      if (roomPresenceIntervalRef.current) {
        window.clearInterval(roomPresenceIntervalRef.current);
        roomPresenceIntervalRef.current = null;
      }
      return;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    const sendPresence = async () => {
      try {
        await updateDoc(roomRef, {
          [`presenceBy.${user.uid}`]: Date.now(),
          presenceUpdatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore transient presence update failures.
      }
    };

    void sendPresence();
    roomPresenceIntervalRef.current = window.setInterval(() => {
      void sendPresence();
    }, ROOM_PRESENCE_HEARTBEAT_MS);

    return () => {
      if (roomPresenceIntervalRef.current) {
        window.clearInterval(roomPresenceIntervalRef.current);
        roomPresenceIntervalRef.current = null;
      }
    };
  }, [activeRoomId, e2eeReadyVersion, user]);

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
    if (sessionRaw) {
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
        return;
      } catch {
        window.localStorage.removeItem(getChatSessionStorageKey(user.uid));
      }
    }

    const savedMode = window.localStorage.getItem(getChatModeStorageKey(user.uid));
    if (savedMode === "text" || savedMode === "video" || savedMode === "group") {
      setChatMode(savedMode);
      setChatFilters(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !hasAttemptedSessionRestoreRef.current) {
      return;
    }

    const modeKey = getChatModeStorageKey(user.uid);
    if (chatMode) {
      window.localStorage.setItem(modeKey, chatMode);
      return;
    }

    window.localStorage.removeItem(modeKey);
  }, [chatMode, user]);

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
      updateRoomParticipants([]);
      setStrangerIsTyping(false);
      selfTypingRef.current = false;
      return;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    const messagesRef = query(collection(roomRef, "messages"), orderBy("createdAt", "asc"));
    disconnectHandledRoomRef.current = null;

    roomUnsubRef.current?.();
    roomUnsubRef.current = onSnapshot(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setIsConnecting(false);
          setConnectingStatus("Previous chat ended.");
          updateRoomParticipants([]);
          setActiveRoomId(null);
          return;
        }

        setIsConnecting(false);

        const roomData = snapshot.data() as {
          participants?: string[];
          participantProfiles?: Array<{ uid: string; gender: ProfileGender; age: number; countryCode?: string }>;
          typingBy?: Record<string, boolean>;
          presenceBy?: Record<string, number>;
          e2eePublicKeys?: Record<string, JsonWebKey>;
          status?: string;
          endedBy?: string;
        };

        void ensureRoomE2EEKey(activeRoomId, user.uid, {
          participants: roomData.participants,
          e2eePublicKeys: roomData.e2eePublicKeys,
        }).catch(() => {
          // Ignore key negotiation races.
        });

        updateRoomParticipants(Array.isArray(roomData.participants) ? roomData.participants : []);

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
            void deleteAllRoomData(activeRoomId, roomData.participants ?? [user.uid]);
            return;
          }
        }

        const otherParticipant = roomData.participantProfiles?.find((p) => p.uid !== user.uid);
        const otherUid = otherParticipant?.uid;
        const otherPresenceMs = otherUid ? roomData.presenceBy?.[otherUid] : undefined;
        const otherTimedOut =
          typeof otherPresenceMs === "number" && Date.now() - otherPresenceMs > ROOM_PRESENCE_TIMEOUT_MS;

        if (
          otherUid &&
          otherTimedOut &&
          roomData.status !== "ended" &&
          disconnectHandledRoomRef.current !== activeRoomId
        ) {
          disconnectHandledRoomRef.current = activeRoomId;
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

          void deleteAllRoomData(activeRoomId, roomData.participants ?? [user.uid]);

          void updateDoc(roomRef, {
            status: "ended",
            endedBy: user.uid,
            endedAt: serverTimestamp(),
            endedReason: "presence-timeout",
          }).catch(() => {
            // Ignore timeout end race conditions.
          });

          return;
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
        void (async () => {
          const roomKey = roomCipherKeyRef.current;

          const nextMessages: ChatMessage[] = await Promise.all(
            snapshot.docs.map(async (messageDoc) => {
              const data = messageDoc.data() as {
                senderId?: string;
                clientMessageId?: string;
                text?: string;
                textCiphertext?: string;
                textIv?: string;
                imageUrl?: string;
                imageEncrypted?: boolean;
                imageCiphertext?: string;
                imageIv?: string;
                imageMimeType?: string;
                imageViewTimerSeconds?: number | null;
                imageRevealAtMs?: number | null;
                imageExpiresAtMs?: number | null;
                imageDeleted?: boolean;
                createdAt?: { toDate?: () => Date };
              };

              const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();

              let decryptedText = data.text;
              if (data.textCiphertext && data.textIv) {
                const cachedText = decryptedTextCacheRef.current.get(messageDoc.id);
                const isCachedMatch =
                  cachedText?.ciphertext === data.textCiphertext && cachedText?.iv === data.textIv;

                if (isCachedMatch && cachedText) {
                  decryptedText = cachedText.text;
                } else if (roomKey) {
                  try {
                    const nextText = await decryptString(roomKey, {
                      ciphertext: data.textCiphertext,
                      iv: data.textIv,
                    });
                    decryptedText = nextText;
                    decryptedTextCacheRef.current.set(messageDoc.id, {
                      ciphertext: data.textCiphertext,
                      iv: data.textIv,
                      text: nextText,
                    });
                  } catch {
                    decryptedText = "Encrypted message";
                  }
                } else {
                  decryptedText = "Decrypting secure message...";
                }
              }

              let displayImageUrl = data.imageUrl;
              let imageUnavailable = false;
              let imageDecrypting = false;
              if (roomKey && data.imageEncrypted && data.imageUrl && data.imageIv) {
                const cached = decryptedImageUrlCacheRef.current.get(messageDoc.id);
                if (cached && cached.sourceUrl === data.imageUrl) {
                  displayImageUrl = cached.objectUrl;
                } else {
                  try {
                    const encryptedBytes = new Uint8Array(await (await fetch(data.imageUrl)).arrayBuffer());
                    const decryptedBytes = await decryptBytes(roomKey, {
                      ciphertext: bytesToBase64(encryptedBytes),
                      iv: data.imageIv,
                    });
                    const decryptedBuffer = decryptedBytes.buffer.slice(
                      decryptedBytes.byteOffset,
                      decryptedBytes.byteOffset + decryptedBytes.byteLength,
                    ) as ArrayBuffer;
                    const resolvedMimeType =
                      typeof data.imageMimeType === "string" && data.imageMimeType.startsWith("image/")
                        ? data.imageMimeType
                        : detectImageMimeType(decryptedBytes) ?? "image/jpeg";
                    const blob = new Blob([decryptedBuffer], { type: resolvedMimeType });
                    const objectUrl = URL.createObjectURL(blob);

                    if (cached) {
                      URL.revokeObjectURL(cached.objectUrl);
                    }

                    decryptedImageUrlCacheRef.current.set(messageDoc.id, {
                      sourceUrl: data.imageUrl,
                      objectUrl,
                    });
                    displayImageUrl = objectUrl;
                  } catch {
                    displayImageUrl = undefined;
                    imageUnavailable = true;
                  }
                }
              } else if (data.imageEncrypted && data.imageUrl) {
                displayImageUrl = undefined;
                imageDecrypting = true;
              }

              const linkedImage = !displayImageUrl
                ? findEmbeddableImageUrlInText(typeof decryptedText === "string" ? decryptedText : undefined)
                : null;

              const cleanedText =
                typeof decryptedText === "string" && linkedImage
                  ? decryptedText.replace(linkedImage.matchedText, "").replace(/\s{2,}/g, " ").trim()
                  : typeof decryptedText === "string"
                    ? decryptedText
                    : undefined;

              const fallbackText =
                typeof cleanedText === "string" && cleanedText.length > 0
                  ? cleanedText
                  : !displayImageUrl && !linkedImage && !imageUnavailable && !imageDecrypting
                    ? "Message unavailable"
                    : undefined;

              return {
                id: messageDoc.id,
                author: data.senderId === user.uid ? "you" : "stranger",
                clientMessageId: data.clientMessageId,
                text: fallbackText,
                image: displayImageUrl,
                imageMimeType:
                  typeof data.imageMimeType === "string" && data.imageMimeType.startsWith("image/")
                    ? data.imageMimeType
                    : undefined,
                linkImageUrl: linkedImage?.url,
                linkImageMimeType: linkedImage?.mimeType,
                imageUnavailable,
                imageDecrypting,
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
            }),
          );

          const validMessageIds = new Set(nextMessages.map((message) => message.id));
          for (const messageId of Array.from(decryptedTextCacheRef.current.keys())) {
            if (!validMessageIds.has(messageId)) {
              decryptedTextCacheRef.current.delete(messageId);
            }
          }

          for (const [messageId, cacheEntry] of decryptedImageUrlCacheRef.current.entries()) {
            if (!validMessageIds.has(messageId)) {
              URL.revokeObjectURL(cacheEntry.objectUrl);
              decryptedImageUrlCacheRef.current.delete(messageId);
            }
          }

          setMessages(nextMessages);
          setIsConnecting(false);
          setConnectingStatus("Connected");
          setShowNextStrangerPrompt(false);
        })();
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
  }, [activeRoomId, e2eeReadyVersion, user]);

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

    let participantUids: string[] = [user.uid];
    try {
      const roomSnapshot = await getDoc(doc(db, "rooms", activeRoomId));
      if (roomSnapshot.exists()) {
        const roomData = roomSnapshot.data() as { participants?: string[] };
        if (Array.isArray(roomData.participants) && roomData.participants.length > 0) {
          participantUids = roomData.participants;
        }
      }
    } catch {
      // Ignore participant fetch failures and fall back to current user.
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

    await deleteAllRoomData(activeRoomId, participantUids);

    setActiveRoomId(null);
    setMessages([]);
  };

  const tryMatchWithAvailableUser = async (
    filters: ChatFilters,
    mode: ChatMode,
    currentUser: User,
    currentProfile: UserProfile,
  ) => {
    try {
      setConnectingStatus("Checking availability...");

      const waitingUsersRef = collection(db, "waitingUsers");
      const searchingQuery = query(
        waitingUsersRef,
        where("status", "==", "searching"),
        where("mode", "==", mode),
        limit(100),
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

      const staleThresholdMs = Date.now() - 2 * 60 * 1000;
      const compatibleCandidates = searchSnapshot.docs
        .filter((candidateDoc) => candidateDoc.id !== currentUser.uid)
        .map((candidateDoc) => {
          const candidateData = candidateDoc.data();
          if (!isValidWaitingUser(candidateData)) {
            return null;
          }

          return {
            uid: candidateDoc.id,
            data: candidateData,
            lastSeenMs: toTimestampMillis(candidateData.lastSeenAt),
            createdAtMs: toTimestampMillis((candidateDoc.data() as { createdAt?: unknown }).createdAt),
          };
        })
        .filter((candidate): candidate is { uid: string; data: WaitingUser; lastSeenMs: number | null; createdAtMs: number | null } => Boolean(candidate))
        .filter((candidate) => areUsersCompatible(me, candidate.data));

      const activeCompatibleCandidates = compatibleCandidates.filter((candidate) => {
        const activityMs = candidate.lastSeenMs ?? candidate.createdAtMs;
        return typeof activityMs === "number" && activityMs >= staleThresholdMs;
      });

      // Candidates without timestamps can still be fresh due to local/server timestamp sync lag.
      const unknownActivityCandidates = compatibleCandidates.filter(
        (candidate) => candidate.lastSeenMs === null && candidate.createdAtMs === null,
      );

      const candidates =
        activeCompatibleCandidates.length > 0 ? activeCompatibleCandidates : unknownActivityCandidates;

      if (candidates.length === 0) {
        setConnectingStatus("Waiting for a compatible stranger...");
        return;
      }

      const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5);

      for (const candidate of shuffledCandidates) {
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
          return;
        } catch {
          // Candidate became unavailable, try the next one.
        }
      }

      setConnectingStatus("Retrying match...");
    } catch (error) {
      console.error("Match lookup failed", {
        uid: currentUser.uid,
        error: formatFirebaseError(error),
      });
      setConnectingStatus("Matching service is busy. Retrying...");
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
    setStrangerProfile(PENDING_STRANGER_PROFILE);
    setMessages([]);
    setText("");
    clearAttachment();
    setActiveRoomId(null);

    const waitingRef = doc(db, "waitingUsers", user.uid);
    try {
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
    } catch (error) {
      console.error("Failed to enter matchmaking queue", {
        uid: user.uid,
        error: formatFirebaseError(error),
      });
      setConnectingStatus("Could not reach matchmaking right now. Retrying...");
    }

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

    const inferredMimeType = inferImageMimeTypeFromName(file.name);
    const resolvedImageMimeType = file.type.startsWith("image/") ? file.type : inferredMimeType;

    if (!resolvedImageMimeType) {
      setSendError("Only image files are supported.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      setSendError("Image is too large. Please upload an image smaller than 8MB.");
      event.target.value = "";
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSendError(null);
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
    if (!hasSecureCryptoContext()) {
      setSendError("Secure chat needs HTTPS (or localhost). Open this site securely and try again.");
      return;
    }

    if (!user || !activeRoomId || isSendingMessage || (!text.trim() && !selectedImageFile)) {
      return;
    }

    if (imagePreview && !selectedImageFile) {
      setSendError("Image attachment was lost. Please select the image again.");
      return;
    }

    let roomKey = roomCipherKeyRef.current;

    if (!roomKey) {
      try {
        const roomSnapshot = await getDoc(doc(db, "rooms", activeRoomId));
        if (roomSnapshot.exists()) {
          const roomData = roomSnapshot.data() as {
            participants?: string[];
            e2eePublicKeys?: Record<string, JsonWebKey>;
          };
          roomKey = await ensureRoomE2EEKey(activeRoomId, user.uid, {
            participants: roomData.participants,
            e2eePublicKeys: roomData.e2eePublicKeys,
          });
        }
      } catch {
        // Ignore transient negotiation fetch failures.
      }
    }

    if (!roomKey) {
      roomKey = await waitForRoomCipherKey(12000);
    }

    if (!roomKey) {
      setSendError("Secure channel is still negotiating. Message will send automatically when ready.");
      schedulePendingSendRetry(sendMessage);
      return;
    }

    clearPendingSendRetry();
    setSendError(null);
    const outgoingText = text.trim() || null;

    let imageUrl: string | undefined;
    let imagePath: string | null = null;
    let imageIv: string | null = null;
    let imageMimeType: string | null = null;
    let imageEncrypted = false;
    let imageViewTimer: number | null = null;
    let textCiphertext: string | null = null;
    let textIv: string | null = null;
    setIsSendingMessage(true);
    setImageUploadProgress(selectedImageFile ? 0 : null);

    try {
      if (outgoingText) {
        const encryptedText = await encryptString(roomKey, outgoingText);
        textCiphertext = encryptedText.ciphertext;
        textIv = encryptedText.iv;
      }

      if (selectedImageFile) {
        imagePath = `chatUploads/${activeRoomId}/${user.uid}/${Date.now()}-${selectedImageFile.name}`;
        const uploadRef = ref(storage, imagePath);
        const fileBytes = new Uint8Array(await selectedImageFile.arrayBuffer());
        const encryptedImage = await encryptBytes(roomKey, fileBytes);
        const encryptedBytes = payloadBase64ToBytes(encryptedImage.ciphertext);
        const encryptedBuffer = encryptedBytes.buffer.slice(
          encryptedBytes.byteOffset,
          encryptedBytes.byteOffset + encryptedBytes.byteLength,
        ) as ArrayBuffer;
        const encryptedBlob = new Blob([encryptedBuffer], {
          type: "application/octet-stream",
        });

        const resolvedImageMimeType = selectedImageFile.type.startsWith("image/")
          ? selectedImageFile.type
          : inferImageMimeTypeFromName(selectedImageFile.name) ?? "image/jpeg";

        const uploadTask = uploadBytesResumable(uploadRef, encryptedBlob, {
          contentType: "application/octet-stream",
          customMetadata: {
            encrypted: "true",
            originalMimeType: resolvedImageMimeType,
          },
        });

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
        imageIv = encryptedImage.iv;
        imageMimeType = resolvedImageMimeType;
        imageEncrypted = true;
        imageViewTimer = imageTimerSeconds > 0 ? imageTimerSeconds : null;
      }

      const messagePayload: {
        senderId: string;
        text: string | null;
        textCiphertext?: string;
        textIv?: string;
        createdAt: ReturnType<typeof serverTimestamp>;
        imageUrl?: string;
        imagePath?: string;
        imageEncrypted?: boolean;
        imageIv?: string;
        imageMimeType?: string;
        imageViewTimerSeconds?: number;
        imageRevealAtMs?: null;
        imageExpiresAtMs?: null;
        imageDeleted?: boolean;
      } = {
        senderId: user.uid,
        text: null,
        createdAt: serverTimestamp(),
      };

      if (textCiphertext && textIv) {
        messagePayload.textCiphertext = textCiphertext;
        messagePayload.textIv = textIv;
      }

      if (imageUrl && imagePath) {
        messagePayload.imageUrl = imageUrl;
        messagePayload.imagePath = imagePath;
        messagePayload.imageEncrypted = imageEncrypted;
        if (imageIv) {
          messagePayload.imageIv = imageIv;
        }
        if (imageMimeType) {
          messagePayload.imageMimeType = imageMimeType;
        }
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
      const detailedError = formatFirebaseError(error);
      console.error("Message send failed", {
        roomId: activeRoomId,
        uid: user.uid,
        hasImage: Boolean(selectedImageFile),
        error: detailedError,
      });
      setSendError(
        selectedImageFile
          ? `Send failed. Image upload or message write was blocked (${detailedError}).`
          : `Send failed. Message write was blocked (${detailedError}).`,
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
      if (user) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            lastLogoutAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  };

  const isAuthenticated = Boolean(user);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setIsAdmin(false);
      setAdminRoleLoading(false);
      return;
    }

    setAdminRoleLoading(true);
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
          setAdminRoleLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!adminRoleLoading && isAdmin) {
      router.push("/admin");
    }
  }, [adminRoleLoading, isAdmin, router]);

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
            isAdmin={false}
            onGoToAdmin={() => router.push("/admin")}
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
        <main className="screen !content-start gap-5">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
            isAdmin={isAdmin}
            onGoToAdmin={() => router.push("/admin")}
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
          <LandingPageSection />
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
            isAdmin={isAdmin}
            onGoToAdmin={() => router.push("/admin")}
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
            isAdmin={isAdmin}
            onGoToAdmin={() => router.push("/admin")}
          />
          <ModeSelectionView
            onChooseMode={(mode) => {
              setChatMode(mode);
              setChatFilters(null);
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
            isAdmin={isAdmin}
            onGoToAdmin={() => router.push("/admin")}
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
          isAdmin={isAdmin}
          onGoToAdmin={() => router.push("/admin")}
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
          videoError={videoError}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          hasRemoteVideo={hasRemoteVideo}
          localVideoEnabled={localVideoEnabled}
          localAudioEnabled={localAudioEnabled}
          toggleLocalVideo={toggleLocalVideo}
          toggleLocalAudio={toggleLocalAudio}
          switchCamera={switchCamera}
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
