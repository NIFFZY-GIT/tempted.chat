"use client";

import { auth, db, firebaseApp, googleProvider, storage } from "@/lib/firebase";
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
  ModeAndFiltersView,
  ProfileGender,
  ProfileSetupView,
  type ChatMessage,
  type UserProfile,
} from "@/components/chat-ui";
import { LandingPageSection } from "@/components/landing-page";
import { DevelopedBy } from "@/components/developed-by";
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
import { getFunctions, httpsCallable } from "firebase/functions";
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
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { getUserRole } from "@/lib/admin";

declare global {
  interface Window {
    grecaptcha: {
      render: (container: string | HTMLElement, parameters: Record<string, unknown>) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!;

const GROUP_COLORS = ["#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa"];

const STRANGER_LEFT_PROMPT = "Stranger left. Connect to the next stranger?";
const ROOM_PRESENCE_HEARTBEAT_MS = 5000;
const ROOM_PRESENCE_TIMEOUT_MS = 45000;
const NO_SHOW_TIMEOUT_MS = 30_000;
const MATCH_RETRY_INTERVAL_MS = 1200;
const MATCH_HEARTBEAT_INTERVAL_MS = 3000;
const E2EE_WAIT_BEFORE_QUEUE_MS = 1800;
const REALTIME_QUEUE_PING_MS = 2000;
const REALTIME_WS_URL = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "ws://localhost:8787";
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

type RealtimeSignalKind = "offer" | "answer" | "ice";

type RealtimeSignalEvent = {
  roomId: string;
  fromUid: string;
  kind: RealtimeSignalKind;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
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
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingStatus, setConnectingStatus] = useState("Checking availability...");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<string[]>([]);
  const [strangerIsTyping, setStrangerIsTyping] = useState(false);
  const [showNextStrangerPrompt, setShowNextStrangerPrompt] = useState(false);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<Array<{ uid: string; nickname: string; color: string }>>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRoleLoading, setAdminRoleLoading] = useState(false);

  const [e2eeReadyVersion, setE2eeReadyVersion] = useState(0);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<"vip" | "vvip" | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
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
  const retryMatchFailureCountRef = useRef(0);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const roomPresenceIntervalRef = useRef<number | null>(null);
  const typingIdleTimeoutRef = useRef<number | null>(null);
  const imageCleanupIntervalRef = useRef<number | null>(null);
  const pendingSendRetryIntervalRef = useRef<number | null>(null);
  const realtimeQueuePingIntervalRef = useRef<number | null>(null);
  const selfTypingRef = useRef(false);
  const activeRoomIdRef = useRef<string | null>(null);
  const realtimeSocketRef = useRef<WebSocket | null>(null);
  const realtimeConnectedRef = useRef(false);
  const realtimeQueueModeRef = useRef<ChatMode | null>(null);
  const realtimeRoomIdRef = useRef<string | null>(null);
  const realtimePeerUidRef = useRef<string | null>(null);
  const realtimeIsOffererRef = useRef(false);
  const realtimeSignalBufferRef = useRef<RealtimeSignalEvent[]>([]);
  const realtimeSignalHandlerRef = useRef<((event: RealtimeSignalEvent) => void) | null>(null);




    // Camera/mic permission is checked by the preview useEffect below
    // (which starts the actual stream). No separate probe needed — the
    // preview effect sets `videoError` on failure without resetting chatMode,
    // so the user stays on the video layout and sees the error inline.
  const hasAttemptedSessionRestoreRef = useRef(false);
  const [sessionRestoreComplete, setSessionRestoreComplete] = useState(false);
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
  const noShowTimeoutRef = useRef<number | null>(null);
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
    realtimeSignalHandlerRef.current = null;
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
      // Stop old video tracks first — mobile browsers often won't release the
      // camera hardware until the existing track is stopped, which prevents
      // getUserMedia from acquiring the other camera.
      const existingVideoTracks = localStream.getVideoTracks();
      existingVideoTracks.forEach((track) => {
        localStream.removeTrack(track);
        track.stop();
      });

      // Try with `exact` first (reliable on mobile), fall back to `ideal`.
      let switchedStream: MediaStream;
      try {
        switchedStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: targetFacingMode } },
          audio: false,
        });
      } catch {
        switchedStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: targetFacingMode } },
          audio: false,
        });
      }

      const newVideoTrack = switchedStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        setVideoError("Could not switch camera.");
        return;
      }

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

      console.log("[e2ee] published local key, waiting for peer key", { roomId, uid });
      roomCipherKeyRef.current = null;
      return null;
    }

    const peerUid = roomData.participants?.find((participantId) => participantId !== uid);
    if (!peerUid) {
      console.log("[e2ee] waiting for second participant", { roomId, uid });
      return null;
    }

    let peerPublicJwk = roomData.e2eePublicKeys?.[peerUid];

    // If peer key is missing from the snapshot data, try a fresh server read
    // to avoid staying stuck on a stale local cache.
    if (!peerPublicJwk) {
      try {
        const freshSnapshot = await getDoc(doc(db, "rooms", roomId));
        if (freshSnapshot.exists()) {
          const freshData = freshSnapshot.data() as { e2eePublicKeys?: Record<string, JsonWebKey> };
          peerPublicJwk = freshData.e2eePublicKeys?.[peerUid];
        }
      } catch {
        // Ignore transient read failures.
      }
    }

    if (!peerPublicJwk) {
      console.log("[e2ee] peer key not available yet", { roomId, uid, peerUid });
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

  const retryE2EENegotiation = async (): Promise<CryptoKey | null> => {
    const roomId = activeRoomIdRef.current;
    if (!roomId || !user) {
      return null;
    }

    try {
      const roomSnapshot = await getDoc(doc(db, "rooms", roomId));
      if (!roomSnapshot.exists()) {
        return null;
      }

      const roomData = roomSnapshot.data() as {
        participants?: string[];
        e2eePublicKeys?: Record<string, JsonWebKey>;
      };

      return await ensureRoomE2EEKey(roomId, user.uid, {
        participants: roomData.participants,
        e2eePublicKeys: roomData.e2eePublicKeys,
      });
    } catch {
      return null;
    }
  };

  const waitForRoomCipherKey = async (timeoutMs = 12000): Promise<CryptoKey | null> => {
    if (roomCipherKeyRef.current) {
      return roomCipherKeyRef.current;
    }

    const startedAt = Date.now();
    let lastRetryAt = 0;

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
          return;
        }

        // Actively re-attempt E2EE negotiation every 2 seconds
        if (Date.now() - lastRetryAt >= 2000) {
          lastRetryAt = Date.now();
          void retryE2EENegotiation();
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
    let lastRetryAt = 0;
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

      // Actively re-attempt E2EE negotiation every 2 seconds
      if (Date.now() - lastRetryAt >= 1000) {
        lastRetryAt = Date.now();
        void retryE2EENegotiation();
      }

      if (Date.now() - startedAt > 15000) {
        clearPendingSendRetry();
        setSendError("Secure channel setup timed out. Please reconnect and try again.");
      }
    }, 250);
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
      const userData: Record<string, unknown> = {
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
      };

      // Request live GPS location and save it to the user profile
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            void setDoc(
              doc(db, "users", nextUser.uid),
              {
                ...userData,
                location: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  capturedAt: serverTimestamp(),
                },
              },
              { merge: true },
            ).catch(() => {
              // Ignore profile write failures.
            });
          },
          () => {
            // Location denied or unavailable — save profile without location
            void setDoc(doc(db, "users", nextUser.uid), userData, { merge: true }).catch(() => {
              // Ignore profile write failures.
            });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      } else {
        void setDoc(doc(db, "users", nextUser.uid), userData, { merge: true }).catch(() => {
          // Ignore profile write failures.
        });
      }
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
        // Country is always detected fresh from GPS — never restored from cache
      }
    } catch {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
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

    const setUnknown = () => {
      if (cancelled) {
        return;
      }
      setProfileCountry("Unknown");
      setProfileCountryCode("");
    };

    const detectCountryFromCoords = async (latitude: number, longitude: number) => {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      );

      if (!response.ok) {
        throw new Error("Reverse geocode failed");
      }

      const data = (await response.json()) as {
        countryCode?: string;
        countryName?: string;
      };

      const geocodedCode = normalizeCountryCode(data.countryCode);
      if (!geocodedCode) {
        throw new Error("Invalid country code from geocoder");
      }

      applyCountry(geocodedCode, data.countryName);
    };

    const detectCountryFromIP = async () => {
      const response = await fetch(
        "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en",
      );

      if (!response.ok) {
        throw new Error("IP geocode failed");
      }

      const data = (await response.json()) as {
        countryCode?: string;
        countryName?: string;
      };

      const ipCode = normalizeCountryCode(data.countryCode);
      if (!ipCode) {
        throw new Error("Invalid country code from IP geocoder");
      }

      applyCountry(ipCode, data.countryName);
    };

    // Show "Detecting..." while location is being resolved
    setProfileCountry("Detecting...");
    setProfileCountryCode("");

    if (!("geolocation" in navigator)) {
      // No GPS — fall back to IP-based detection
      void detectCountryFromIP().catch(() => setUnknown());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void detectCountryFromCoords(position.coords.latitude, position.coords.longitude).catch(() => {
          // GPS coords obtained but reverse geocode failed — try IP fallback
          void detectCountryFromIP().catch(() => setUnknown());
        });
      },
      () => {
        // GPS denied or unavailable — fall back to IP-based detection
        void detectCountryFromIP().catch(() => setUnknown());
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
    if (!user) {
      realtimeConnectedRef.current = false;
      realtimeQueueModeRef.current = null;
      realtimeRoomIdRef.current = null;
      realtimePeerUidRef.current = null;
      realtimeIsOffererRef.current = false;
      realtimeSignalBufferRef.current = [];
      stopRealtimeQueueHeartbeat();

      if (realtimeSocketRef.current) {
        try {
          realtimeSocketRef.current.close();
        } catch {
          // Ignore close races.
        }
        realtimeSocketRef.current = null;
      }
      return;
    }

    const socket = new WebSocket(REALTIME_WS_URL);
    realtimeSocketRef.current = socket;

    socket.onopen = () => {
      void user.getIdToken(true).then((token) => {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }
        socket.send(JSON.stringify({ event: "auth", payload: { token } }));
      }).catch(() => {
        console.warn("[realtime] failed to fetch auth token for websocket");
      });
    };

    socket.onmessage = (event) => {
      let parsed: { event?: string; payload?: unknown } | null = null;
      try {
        parsed = JSON.parse(String(event.data)) as { event?: string; payload?: unknown };
      } catch {
        return;
      }

      const eventName = parsed?.event;
      const payload = parsed?.payload as Record<string, unknown> | undefined;

      if (eventName === "auth_ok") {
        realtimeConnectedRef.current = true;
        return;
      }

      if (eventName === "match_found") {
        const roomId = typeof payload?.roomId === "string" ? payload.roomId : null;
        const peerUid = typeof payload?.peerUid === "string" ? payload.peerUid : null;
        const isOfferer = Boolean(payload?.isOfferer);
        const mode = payload?.mode as ChatMode | undefined;
        const participantProfiles = Array.isArray(payload?.participantProfiles)
          ? payload?.participantProfiles as Array<{ uid: string; gender: ProfileGender; age: number; countryCode?: string; nickname?: string }>
          : [];
        const participants = Array.isArray(payload?.participants)
          ? payload?.participants as string[]
          : peerUid
            ? [user.uid, peerUid]
            : [user.uid];

        if (!roomId || !peerUid || !mode || activeRoomIdRef.current) {
          return;
        }

        realtimeRoomIdRef.current = roomId;
        realtimePeerUidRef.current = peerUid;
        realtimeIsOffererRef.current = isOfferer;
        realtimeQueueModeRef.current = null;
        stopRealtimeQueueHeartbeat();

        const roomRef = doc(db, "rooms", roomId);
        void setDoc(roomRef, {
          status: "active",
          mode,
          participants,
          participantProfiles,
          presenceBy: { [user.uid]: Date.now() },
          createdAt: serverTimestamp(),
          createdBy: "realtime-ws",
        }, { merge: true }).catch(() => {
          // Ignore room bootstrap races when both peers write.
        });

        const stranger = participantProfiles.find((p) => p.uid !== user.uid);
        if (stranger) {
          setStrangerProfile({
            gender: stranger.gender,
            age: stranger.age,
            countryCode: stranger.countryCode,
          });
        }

        cleanupWaitIntervals();
        setConnectingStatus("Stranger found. Connecting...");
        activeRoomIdRef.current = roomId;
        setActiveRoomId(roomId);
        return;
      }

      if (eventName === "queue_waiting") {
        setConnectingStatus("Looking for an available stranger...");
        return;
      }

      if (eventName === "signal") {
        const roomId = typeof payload?.roomId === "string" ? payload.roomId : null;
        const fromUid = typeof payload?.fromUid === "string" ? payload.fromUid : null;
        const kind = payload?.kind as RealtimeSignalKind | undefined;
        const signalPayload = payload?.payload as RTCSessionDescriptionInit | RTCIceCandidateInit | undefined;

        if (!roomId || !fromUid || !kind || !signalPayload) {
          return;
        }

        const signalEvent: RealtimeSignalEvent = {
          roomId,
          fromUid,
          kind,
          payload: signalPayload,
        };

        const signalHandler = realtimeSignalHandlerRef.current;
        if (signalHandler && activeRoomIdRef.current === roomId) {
          signalHandler(signalEvent);
          return;
        }

        realtimeSignalBufferRef.current.push(signalEvent);
      }
    };

    socket.onerror = () => {
      realtimeConnectedRef.current = false;
    };

    socket.onclose = () => {
      realtimeConnectedRef.current = false;
    };

    return () => {
      if (realtimeSocketRef.current === socket) {
        realtimeSocketRef.current = null;
      }
      realtimeConnectedRef.current = false;
      stopRealtimeQueueHeartbeat();
      try {
        socket.close();
      } catch {
        // Ignore close races.
      }
    };
  }, [user]);

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

  // Start local camera preview as soon as video mode is entered and the user has
  // started searching (Quick Start). Without the connecting/room guard the camera
  // would activate immediately when the saved "video" mode is restored from
  // localStorage, even though the user is still on the mode-selection screen.
  useEffect(() => {
    if (chatMode !== "video") {
      // Stop preview when leaving video mode, but only if no peer connection is active.
      if (!peerConnectionRef.current && localMediaStreamRef.current) {
        localMediaStreamRef.current.getTracks().forEach((track) => track.stop());
        localMediaStreamRef.current = null;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        setLocalVideoEnabled(true);
        setLocalAudioEnabled(true);
        setVideoError(null);
      }
      return;
    }

    // Only start the camera once the user has actually entered the video chat UI
    // (clicked Quick Start and has filters set), not while still on the mode selection menu.
    if (!chatFilters || (!isConnecting && !activeRoomId)) {
      setVideoError(null);
      return;
    }

    // If a stream already exists (e.g. from WebRTC setup), skip.
    if (localMediaStreamRef.current) {
      setVideoError(null);
      return;
    }

    let cancelled = false;
    const startPreview = async () => {
      try {
        // Check Permissions API first
        let permission: PermissionState | null = null;
        try {
          const camPerm = await navigator.permissions.query({ name: "camera" as PermissionName });
          permission = camPerm.state;
        } catch {}
        if (permission === "denied") {
          setVideoError("Camera or microphone permission is blocked. Allow access in your browser settings and reload.");
          return;
        }
        // Try to get the stream (will prompt if needed)
        const localStream = await getPreferredLocalMediaStream(cameraFacingMode);
        if (cancelled) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        localMediaStreamRef.current = localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.muted = true;
          void localVideoRef.current.play().catch(() => {});
        }
        setLocalVideoEnabled(true);
        setLocalAudioEnabled(localStream.getAudioTracks().some((track) => track.enabled));
        const currentFacingMode = localStream.getVideoTracks()[0]?.getSettings().facingMode;
        if (currentFacingMode === "environment" || currentFacingMode === "user") {
          setCameraFacingMode(currentFacingMode);
        }
        setVideoError(null);
      } catch {
        setVideoError("Camera or microphone permission is required for video mode.");
      }
    };
    void startPreview();
    return () => { cancelled = true; };
  }, [chatMode, chatFilters, isConnecting, activeRoomId, cameraFacingMode]);

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
    const isRealtimeRoom = realtimeRoomIdRef.current === activeRoomId && realtimePeerUidRef.current === otherUid;
    const isOfferer = isRealtimeRoom ? realtimeIsOffererRef.current : user.uid < otherUid;

    const setupVideo = async () => {
      try {
        // Reuse preview stream if already started, otherwise request a new one.
        const localStream = localMediaStreamRef.current ?? await getPreferredLocalMediaStream(cameraFacingMode);

        if (cancelled) {
          if (!localMediaStreamRef.current) {
            localStream.getTracks().forEach((track) => track.stop());
          }
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
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
            {
              urls: "turn:a.relay.metered.ca:80",
              username: "e53a8cec5765272ee7307826",
              credential: "uWdKMi+UeI1VNmNG",
            },
            {
              urls: "turn:a.relay.metered.ca:80?transport=tcp",
              username: "e53a8cec5765272ee7307826",
              credential: "uWdKMi+UeI1VNmNG",
            },
            {
              urls: "turn:a.relay.metered.ca:443",
              username: "e53a8cec5765272ee7307826",
              credential: "uWdKMi+UeI1VNmNG",
            },
            {
              urls: "turns:a.relay.metered.ca:443?transport=tcp",
              username: "e53a8cec5765272ee7307826",
              credential: "uWdKMi+UeI1VNmNG",
            },
          ],
          iceCandidatePoolSize: 10,
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

          if (isRealtimeRoom) {
            emitRealtimeSignal(activeRoomId, otherUid, "ice", event.candidate.toJSON());
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

        const attemptIceRestart = () => {
          if (!isOfferer) return;
          void (async () => {
            try {
              peerConnection.restartIce();
              const restartOffer = await peerConnection.createOffer({ iceRestart: true });
              await peerConnection.setLocalDescription(restartOffer);
              videoOfferSentRef.current = true;
              if (isRealtimeRoom) {
                emitRealtimeSignal(activeRoomId, otherUid, "offer", {
                  type: restartOffer.type,
                  sdp: restartOffer.sdp,
                });
              }
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
        };

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === "connected") {
            setVideoError(null);
            return;
          }

          if (peerConnection.connectionState === "disconnected") {
            setVideoError("Connection unstable. Reconnecting video...");
            attemptIceRestart();
            return;
          }

          if (peerConnection.connectionState === "failed") {
            setVideoError("Video connection failed. Retrying...");
            attemptIceRestart();
          }
        };

        peerConnection.oniceconnectionstatechange = () => {
          if (peerConnection.iceConnectionState === "failed") {
            attemptIceRestart();
          }
        };

        const handleRealtimeSignal = (signalEvent: RealtimeSignalEvent) => {
          if (signalEvent.roomId !== activeRoomId || signalEvent.fromUid !== otherUid) {
            return;
          }

          if (signalEvent.kind === "ice") {
            const candidateInit = signalEvent.payload as RTCIceCandidateInit;
            if (!peerConnection.remoteDescription) {
              pendingRemoteCandidatesRef.current.push(candidateInit);
              return;
            }

            void peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(() => {
              pendingRemoteCandidatesRef.current.push(candidateInit);
            });
            return;
          }

          if (signalEvent.kind === "offer" && !isOfferer && !peerConnection.currentRemoteDescription && !videoAnswerSentRef.current) {
            const remoteOffer = signalEvent.payload as RTCSessionDescriptionInit;
            void (async () => {
              try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));
                await flushPendingRemoteCandidates(peerConnection);
                const createdAnswer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(createdAnswer);
                videoAnswerSentRef.current = true;

                if (isRealtimeRoom) {
                  emitRealtimeSignal(activeRoomId, otherUid, "answer", {
                    type: createdAnswer.type,
                    sdp: createdAnswer.sdp,
                  });
                }

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
            return;
          }

          if (signalEvent.kind === "answer" && isOfferer && !peerConnection.currentRemoteDescription) {
            const remoteAnswer = signalEvent.payload as RTCSessionDescriptionInit;
            void (async () => {
              try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
                await flushPendingRemoteCandidates(peerConnection);
              } catch {
                setVideoError("Could not finalize video connection.");
              }
            })();
          }
        };

        realtimeSignalHandlerRef.current = handleRealtimeSignal;

        const bufferedSignals = realtimeSignalBufferRef.current;
        if (bufferedSignals.length > 0) {
          const remainingSignals: RealtimeSignalEvent[] = [];
          bufferedSignals.forEach((signalEvent) => {
            if (signalEvent.roomId === activeRoomId && signalEvent.fromUid === otherUid) {
              handleRealtimeSignal(signalEvent);
            } else {
              remainingSignals.push(signalEvent);
            }
          });
          realtimeSignalBufferRef.current = remainingSignals;
        }

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
                  if (isRealtimeRoom) {
                    emitRealtimeSignal(activeRoomId, otherUid, "answer", {
                      type: createdAnswer.type,
                      sdp: createdAnswer.sdp,
                    });
                  }
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

          if (isRealtimeRoom) {
            emitRealtimeSignal(activeRoomId, otherUid, "offer", {
              type: createdOffer.type,
              sdp: createdOffer.sdp,
            });
          }

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
  }, [activeRoomId, user]);

  useEffect(() => {
    if (!activeRoomId || !user || !chatFilters) {
      if (noShowTimeoutRef.current) {
        window.clearTimeout(noShowTimeoutRef.current);
        noShowTimeoutRef.current = null;
      }
      return;
    }

    const roomId = activeRoomId;

    noShowTimeoutRef.current = window.setTimeout(async () => {
      noShowTimeoutRef.current = null;
      try {
        const roomSnapshot = await getDoc(doc(db, "rooms", roomId));
        if (!roomSnapshot.exists()) {
          return;
        }

        const roomData = roomSnapshot.data() as {
          participants?: string[];
          presenceBy?: Record<string, number>;
          status?: string;
        };

        if (roomData.status === "ended") {
          return;
        }

        const otherUid = roomData.participants?.find((uid) => uid !== user.uid);
        const otherPresence = otherUid ? roomData.presenceBy?.[otherUid] : undefined;

        if (typeof otherPresence === "number") {
          return;
        }

        console.warn("No-show: stranger never joined room", { roomId, otherUid });

        try {
          await updateDoc(doc(db, "rooms", roomId), {
            status: "ended",
            endedBy: user.uid,
            endedAt: serverTimestamp(),
            endedReason: "no-show",
          });
        } catch {
          // Ignore if already ended.
        }

        await deleteAllRoomData(roomId, roomData.participants ?? [user.uid]);

        setActiveRoomId(null);
        setMessages([]);
        setShowNextStrangerPrompt(false);

        void startSearching(chatFilters);
      } catch (error) {
        console.error("No-show check failed", error);
      }
    }, NO_SHOW_TIMEOUT_MS);

    return () => {
      if (noShowTimeoutRef.current) {
        window.clearTimeout(noShowTimeoutRef.current);
        noShowTimeoutRef.current = null;
      }
    };
  }, [activeRoomId, user, chatFilters]);

  useEffect(() => {
    if (!user) {
      hasAttemptedSessionRestoreRef.current = false;
      setSessionRestoreComplete(false);
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
          setSessionRestoreComplete(true);
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
        setSessionRestoreComplete(true);
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
    setSessionRestoreComplete(true);
  }, [user]);

  useEffect(() => {
    if (!user || !sessionRestoreComplete) {
      return;
    }

    const modeKey = getChatModeStorageKey(user.uid);
    if (chatMode) {
      window.localStorage.setItem(modeKey, chatMode);
      return;
    }

    window.localStorage.removeItem(modeKey);
  }, [chatMode, sessionRestoreComplete, user]);

  useEffect(() => {
    if (!user || !sessionRestoreComplete) {
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
  }, [activeRoomId, chatFilters, chatMode, sessionRestoreComplete, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleBeforeUnload = () => {
      try {
        const payload = JSON.stringify({
          uid: user.uid,
        });
        navigator.sendBeacon?.("/api/cleanup-waiting", payload);
      } catch {
        // Best-effort cleanup.
      }

      try {
        void deleteDoc(doc(db, "waitingUsers", user.uid));
      } catch {
        // Best-effort cleanup.
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !activeRoomId) {
      return;
    }

    if (realtimeQueueModeRef.current) {
      void sendRealtimeEvent("queue_leave", { mode: realtimeQueueModeRef.current });
      realtimeQueueModeRef.current = null;
    }
    stopRealtimeQueueHeartbeat();

    cleanupWaitIntervals();
    void deleteDoc(doc(db, "waitingUsers", user.uid)).catch(() => {
      // Ignore if queue entry already removed.
    });
  }, [activeRoomId, user]);

  useEffect(() => {
    if (!activeRoomId || !user) {
      roomUnsubRef.current?.();
      roomUnsubRef.current = null;
      updateRoomParticipants([]);
      setStrangerIsTyping(false);
      selfTypingRef.current = false;
      return;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
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
          participantProfiles?: Array<{ uid: string; gender: ProfileGender; age: number; countryCode?: string; nickname?: string }>;
          typingBy?: Record<string, boolean>;
          presenceBy?: Record<string, number>;
          e2eePublicKeys?: Record<string, JsonWebKey>;
          status?: string;
          endedBy?: string;
          mode?: string;
        };

        // Skip E2EE for group mode (ECDH is 2-party only)
        if (roomData.mode !== "group") {
          void ensureRoomE2EEKey(activeRoomId, user.uid, {
            participants: roomData.participants,
            e2eePublicKeys: roomData.e2eePublicKeys,
          }).catch((error) => {
            console.warn("[e2ee] negotiation retry failed", {
              roomId: activeRoomId,
              uid: user.uid,
              error: formatFirebaseError(error),
            });
          });
        }

        updateRoomParticipants(Array.isArray(roomData.participants) ? roomData.participants : []);

        // Populate group participants
        if (roomData.mode === "group" && roomData.participantProfiles) {
          setGroupParticipants(
            roomData.participantProfiles.map((p, i) => ({
              uid: p.uid,
              nickname: p.nickname || `User${p.uid.slice(0, 4)}`,
              color: GROUP_COLORS[i % GROUP_COLORS.length],
            })),
          );
        }

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

    return () => {
      roomUnsubRef.current?.();
      roomUnsubRef.current = null;
    };
  }, [activeRoomId, user]);

  useEffect(() => {
    if (!activeRoomId || !user) {
      roomMessagesUnsubRef.current?.();
      roomMessagesUnsubRef.current = null;
      return;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    const messagesRef = query(collection(roomRef, "messages"), orderBy("createdAt", "asc"));

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
                senderNickname?: string;
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
                replyToId?: string;
                replyToText?: string;
                replyToAuthor?: string;
                reactions?: Record<string, string[]>;
                deletedForEveryone?: boolean;
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

              const senderParticipant = chatMode === "group" && data.senderId
                ? groupParticipants.find((p) => p.uid === data.senderId)
                : undefined;

              return {
                id: messageDoc.id,
                author: data.senderId === user.uid ? "you" as const : "stranger" as const,
                senderId: data.senderId,
                senderNickname: senderParticipant?.nickname ?? data.senderNickname,
                senderColor: senderParticipant?.color,
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
                replyToId: data.replyToId,
                replyToText: data.replyToText,
                replyToAuthor: data.replyToAuthor
                  ? data.replyToAuthor === user.uid
                    ? "you" as const
                    : "stranger" as const
                  : undefined,
                reactions: data.reactions,
                deletedForEveryone: Boolean(data.deletedForEveryone),
                createdAtMs: createdAtDate.getTime(),
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

          // Deduplicate: remove optimistic (pending) messages whose clientMessageId
          // now appears in the real Firestore snapshot.
          const realClientIds = new Set(
            nextMessages.filter((m) => m.clientMessageId).map((m) => m.clientMessageId),
          );

          setMessages((prev) => {
            // Keep only non-pending messages from prev (shouldn't be any after first snapshot),
            // then append all nextMessages — but first strip pending ones that are now confirmed.
            const survivingPending = prev.filter(
              (m) => m.isPending && m.clientMessageId && !realClientIds.has(m.clientMessageId),
            );
            return [...nextMessages, ...survivingPending];
          });
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

    if (noShowTimeoutRef.current) {
      window.clearTimeout(noShowTimeoutRef.current);
      noShowTimeoutRef.current = null;
    }

    if (waitingUnsubRef.current) {
      waitingUnsubRef.current();
      waitingUnsubRef.current = null;
    }

    if (realtimeQueuePingIntervalRef.current) {
      window.clearInterval(realtimeQueuePingIntervalRef.current);
      realtimeQueuePingIntervalRef.current = null;
    }
  };

  const sendRealtimeEvent = useCallback((event: string, payload?: unknown): boolean => {
    const socket = realtimeSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !realtimeConnectedRef.current) {
      return false;
    }

    socket.send(JSON.stringify({ event, payload }));
    return true;
  }, []);

  const startRealtimeQueueHeartbeat = useCallback(() => {
    if (realtimeQueuePingIntervalRef.current) {
      window.clearInterval(realtimeQueuePingIntervalRef.current);
    }

    realtimeQueuePingIntervalRef.current = window.setInterval(() => {
      if (!activeRoomIdRef.current && realtimeQueueModeRef.current) {
        void sendRealtimeEvent("queue_ping", { mode: realtimeQueueModeRef.current });
      }
    }, REALTIME_QUEUE_PING_MS);
  }, [sendRealtimeEvent]);

  const stopRealtimeQueueHeartbeat = useCallback(() => {
    if (realtimeQueuePingIntervalRef.current) {
      window.clearInterval(realtimeQueuePingIntervalRef.current);
      realtimeQueuePingIntervalRef.current = null;
    }
  }, []);

  const emitRealtimeSignal = useCallback((roomId: string, toUid: string, kind: RealtimeSignalKind, payload: RTCSessionDescriptionInit | RTCIceCandidateInit) => {
    void sendRealtimeEvent("signal", {
      roomId,
      toUid,
      kind,
      payload,
    });
  }, [sendRealtimeEvent]);

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

  const startSearching = async (filters: ChatFilters, modeOverride?: ChatMode, nickname?: string) => {
    const effectiveMode = modeOverride ?? chatMode;
    if (!user || !profile || !effectiveMode) {
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
    if (effectiveMode === "group") {
      setGroupParticipants([]);
    }

    realtimeRoomIdRef.current = null;
    realtimePeerUidRef.current = null;
    realtimeIsOffererRef.current = false;

    if (realtimeQueueModeRef.current) {
      void sendRealtimeEvent("queue_leave", { mode: realtimeQueueModeRef.current });
      realtimeQueueModeRef.current = null;
    }

    const wsQueued = sendRealtimeEvent("queue_join", {
      mode: effectiveMode,
      filters,
      profile: {
        gender: profile.gender,
        age: profile.age,
        countryCode: filters.hideCountry ? null : (profile.countryCode ?? null),
      },
      nickname: nickname || myNickname || `User${user.uid.slice(0, 4)}`,
    });

    if (wsQueued) {
      realtimeQueueModeRef.current = effectiveMode;
      startRealtimeQueueHeartbeat();
      setConnectingStatus("Looking for an available stranger...");
      return;
    }

    const waitingRef = doc(db, "waitingUsers", user.uid);
    try {
      await setDoc(waitingRef, {
        uid: user.uid,
        status: "searching",
        mode: effectiveMode,
        filters,
        profile: {
          gender: profile.gender,
          age: profile.age,
          countryCode: filters.hideCountry ? null : (profile.countryCode ?? null),
        },
        ...(effectiveMode === "group" && { nickname: nickname || myNickname || `User${user.uid.slice(0, 4)}` }),
        createdAt: serverTimestamp(),
        lastSeenAt: Date.now(),
      });

      console.log("[matchmaking] queue entry written for", user.uid, "mode:", effectiveMode, "filters:", filters);

      // Listen for when the server (or another client's trigger) matches us
      waitingUnsubRef.current?.();
      waitingUnsubRef.current = onSnapshot(waitingRef, (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }
        const data = snapshot.data() as { status?: string; roomId?: string };
        if (data.status === "matched" && data.roomId && !activeRoomIdRef.current) {
          console.log("[matchmaking] matched by server, room:", data.roomId);
          setConnectingStatus("Stranger found. Connecting...");
          activeRoomIdRef.current = data.roomId;
          setActiveRoomId(data.roomId);
        }
      });
    } catch (error) {
      console.error("Failed to enter matchmaking queue", {
        uid: user.uid,
        error: formatFirebaseError(error),
      });
      setConnectingStatus("Could not reach matchmaking right now. Retrying...");
    }

    // Periodically call the server-side retryMatch as a fallback in case
    // the initial Firestore trigger didn't find a match (e.g. this user
    // was the first one in the queue).
    const functions = getFunctions(firebaseApp, "us-central1");
    const retryMatchFn = httpsCallable(functions, "retryMatch");
    retryMatchFailureCountRef.current = 0;

    const invokeRetryMatch = () => {
      void retryMatchFn().then((result) => {
        retryMatchFailureCountRef.current = 0;
        const data = result.data as { matched?: boolean } | null;
        if (data?.matched) {
          console.log("[matchmaking] server retryMatch succeeded");
        }
      }).catch((error) => {
        retryMatchFailureCountRef.current += 1;
        console.warn("[matchmaking] retryMatch call failed", {
          attempts: retryMatchFailureCountRef.current,
          error: formatFirebaseError(error),
        });
      });
    };

    // Immediate first attempt so users don't wait for the first interval tick.
    invokeRetryMatch();

    retryMatchIntervalRef.current = window.setInterval(() => {
      if (activeRoomIdRef.current) {
        return;
      }
      invokeRetryMatch();
    }, MATCH_RETRY_INTERVAL_MS);

    heartbeatIntervalRef.current = window.setInterval(() => {
      void (async () => {
        try {
          await updateDoc(waitingRef, { lastSeenAt: Date.now() });
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
    }, MATCH_HEARTBEAT_INTERVAL_MS);
  };

  const stopSearching = async () => {
    if (!user) {
      return;
    }

    cleanupWaitIntervals();

    if (realtimeQueueModeRef.current) {
      void sendRealtimeEvent("queue_leave", { mode: realtimeQueueModeRef.current });
      realtimeQueueModeRef.current = null;
    }

    stopRealtimeQueueHeartbeat();

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

  const onReplyToMessage = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (msg) setReplyingTo(msg);
  };

  const clearReply = () => setReplyingTo(null);

  const onDeleteMessage = async (messageId: string) => {
    if (!user || !activeRoomId) return;
    const msgRef = doc(db, "rooms", activeRoomId, "messages", messageId);
    try {
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;
      const data = msgSnap.data() as { senderId?: string; createdAt?: { toDate?: () => Date } };
      // Only allow deleting own messages
      if (data.senderId !== user.uid) return;
      // Only allow within 30 seconds
      const createdAt = data.createdAt?.toDate?.();
      if (createdAt && Date.now() - createdAt.getTime() > 30000) return;
      await updateDoc(msgRef, {
        deletedForEveryone: true,
        text: null,
        textCiphertext: deleteField(),
        textIv: deleteField(),
        imageUrl: deleteField(),
        imagePath: deleteField(),
        imageIv: deleteField(),
      });
    } catch {
      // Silently fail
    }
  };

  const onReactToMessage = async (messageId: string, emoji: string) => {
    if (!user || !activeRoomId) return;
    const msgRef = doc(db, "rooms", activeRoomId, "messages", messageId);
    try {
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;
      const data = msgSnap.data() as { reactions?: Record<string, string[]> };
      const current = data.reactions ?? {};
      const senders = current[emoji] ?? [];
      if (senders.includes(user.uid)) {
        // Remove reaction
        const updated = senders.filter((id: string) => id !== user.uid);
        if (updated.length === 0) {
          const { [emoji]: _, ...rest } = current;
          await updateDoc(msgRef, { reactions: rest });
        } else {
          await updateDoc(msgRef, { [`reactions.${emoji}`]: updated });
        }
      } else {
        // Add reaction
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(user.uid) });
      }
    } catch {
      // Silently fail — reaction is non-critical
    }
  };

  const sendMessage = async () => {
    if (!hasSecureCryptoContext()) {
      setSendError("Secure chat needs HTTPS (or localhost). Open this site securely and try again.");
      return;
    }

    if (!user || !activeRoomId || (!text.trim() && !selectedImageFile)) {
      return;
    }

    // If already sending an image upload, block duplicate sends
    if (isSendingMessage && selectedImageFile) {
      return;
    }

    if (imagePreview && !selectedImageFile) {
      setSendError("Image attachment was lost. Please select the image again.");
      return;
    }

    const isGroupMode = chatMode === "group";
    let roomKey = roomCipherKeyRef.current;

    if (!isGroupMode) {
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
        roomKey = await waitForRoomCipherKey(E2EE_WAIT_BEFORE_QUEUE_MS);
      }

      if (!roomKey) {
        setSendError("Waiting for stranger secure key exchange. Message will send automatically once ready.");
        schedulePendingSendRetry(sendMessage);
        return;
      }
    }

    clearPendingSendRetry();
    setSendError(null);
    const outgoingText = text.trim() || null;
    const hasImage = Boolean(selectedImageFile);
    const clientMsgId = `${user.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const currentReply = replyingTo;
    setReplyingTo(null);

    // ─── Optimistic UI for text-only messages ───
    if (outgoingText && !hasImage) {
      const now = new Date();
      const optimisticMsg: ChatMessage = {
        id: clientMsgId,
        clientMessageId: clientMsgId,
        author: "you",
        text: outgoingText,
        isPending: true,
        ...(currentReply && {
          replyToId: currentReply.id,
          replyToText: currentReply.text || (currentReply.image ? "Photo" : "Message"),
          replyToAuthor: currentReply.author,
        }),
        sentAt: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setText("");
    }

    // For image sends, block further sends and show progress
    if (hasImage) {
      setIsSendingMessage(true);
      setImageUploadProgress(0);
    }

    let imageUrl: string | undefined;
    let imagePath: string | null = null;
    let imageIv: string | null = null;
    let imageMimeType: string | null = null;
    let imageEncrypted = false;
    let imageViewTimer: number | null = null;
    let textCiphertext: string | null = null;
    let textIv: string | null = null;

    try {
      if (outgoingText && roomKey) {
        const encryptedText = await encryptString(roomKey, outgoingText);
        textCiphertext = encryptedText.ciphertext;
        textIv = encryptedText.iv;
      }

      if (selectedImageFile) {
        imagePath = `chatUploads/${activeRoomId}/${user.uid}/${Date.now()}-${selectedImageFile.name}`;
        const uploadRef = ref(storage, imagePath);

        const resolvedImageMimeType = selectedImageFile.type.startsWith("image/")
          ? selectedImageFile.type
          : inferImageMimeTypeFromName(selectedImageFile.name) ?? "image/jpeg";

        let uploadBlob: Blob;
        let uploadContentType: string;

        if (roomKey) {
          const fileBytes = new Uint8Array(await selectedImageFile.arrayBuffer());
          const encryptedImage = await encryptBytes(roomKey, fileBytes);
          const encryptedBytes = payloadBase64ToBytes(encryptedImage.ciphertext);
          const encryptedBuffer = encryptedBytes.buffer.slice(
            encryptedBytes.byteOffset,
            encryptedBytes.byteOffset + encryptedBytes.byteLength,
          ) as ArrayBuffer;
          uploadBlob = new Blob([encryptedBuffer], { type: "application/octet-stream" });
          uploadContentType = "application/octet-stream";
          imageIv = encryptedImage.iv;
          imageEncrypted = true;
        } else {
          uploadBlob = selectedImageFile;
          uploadContentType = resolvedImageMimeType;
          imageEncrypted = false;
        }

        const uploadTask = uploadBytesResumable(uploadRef, uploadBlob, {
          contentType: uploadContentType,
          customMetadata: {
            encrypted: String(imageEncrypted),
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
        imageMimeType = resolvedImageMimeType;
        imageViewTimer = imageTimerSeconds > 0 ? imageTimerSeconds : null;
      }

      const messagePayload: {
        senderId: string;
        senderNickname?: string;
        clientMessageId: string;
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
        replyToId?: string;
        replyToText?: string;
        replyToAuthor?: string;
      } = {
        senderId: user.uid,
        clientMessageId: clientMsgId,
        text: isGroupMode ? (outgoingText ?? null) : null,
        createdAt: serverTimestamp(),
      };

      if (isGroupMode && myNickname) {
        messagePayload.senderNickname = myNickname;
      }

      if (currentReply) {
        messagePayload.replyToId = currentReply.id;
        messagePayload.replyToText = currentReply.text || (currentReply.image ? "Photo" : "Message");
        messagePayload.replyToAuthor = currentReply.author === "you" ? user.uid : "stranger";
      }

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
      // Text already cleared for text-only (optimistic); clear for image sends too
      if (hasImage) {
        setText("");
      }
      clearAttachment();
    } catch (error) {
      const detailedError = formatFirebaseError(error);
      console.error("Message send failed", {
        roomId: activeRoomId,
        uid: user.uid,
        hasImage: Boolean(selectedImageFile),
        error: detailedError,
      });
      // Remove optimistic message on failure
      if (!hasImage && clientMsgId) {
        setMessages((prev) => prev.filter((m) => m.id !== clientMsgId));
      }
      setSendError(
        selectedImageFile
          ? `Send failed. Image upload or message write was blocked (${detailedError}).`
          : `Send failed. Message write was blocked (${detailedError}).`,
      );
    } finally {
      if (hasImage) {
        setIsSendingMessage(false);
        setImageUploadProgress(null);
      }
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

  const recaptchaWidgetIdRef = useRef<number | null>(null);
  const recaptchaTokenRef = useRef<string | null>(null);

  const renderRecaptcha = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Reset previous widget so a fresh one renders into the new DOM node
    recaptchaWidgetIdRef.current = null;
    recaptchaTokenRef.current = null;
    container.innerHTML = "";

    const doRender = () => {
      // Guard: container might have been removed by React
      if (!document.getElementById(containerId)) return;
      try {
        recaptchaWidgetIdRef.current = window.grecaptcha.render(containerId, {
          sitekey: RECAPTCHA_SITE_KEY,
          theme: "dark",
          callback: (token: string) => { recaptchaTokenRef.current = token; },
          "expired-callback": () => { recaptchaTokenRef.current = null; },
          "error-callback": () => { recaptchaTokenRef.current = null; },
        });
      } catch {
        // Already rendered or container gone
      }
    };

    if (window.grecaptcha && typeof window.grecaptcha.render === "function") {
      doRender();
    } else {
      // Script not loaded yet — wait for it
      const interval = window.setInterval(() => {
        if (window.grecaptcha && typeof window.grecaptcha.render === "function") {
          window.clearInterval(interval);
          doRender();
        }
      }, 300);
      // Stop trying after 15s
      window.setTimeout(() => window.clearInterval(interval), 15000);
    }
  };

  const loginAnonymously = async () => {
    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);

      const token = recaptchaTokenRef.current;
      if (!token) {
        setAuthError("Please complete the CAPTCHA first.");
        setAuthBusy(false);
        return;
      }

      const functions = getFunctions(firebaseApp, "us-central1");
      const verifyRecaptcha = httpsCallable<{ token: string }, { success: boolean }>(functions, "verifyRecaptcha");
      await verifyRecaptcha({ token });

      await signInAnonymously(auth);
    } catch (error) {
      // Reset captcha so user can retry
      recaptchaTokenRef.current = null;
      if (window.grecaptcha && recaptchaWidgetIdRef.current !== null) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
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
      const authCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";

      const message =
        authCode === "auth/unauthorized-domain"
          ? "Google sign-in is not enabled for this domain yet. Add this domain in Firebase Console > Authentication > Settings > Authorized domains, then retry."
          : error instanceof Error
            ? error.message
            : "Google login failed. Try again.";
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

  // Fetch subscription status when user is available.
  const checkSubscription = useCallback(async (uid: string) => {
    setSubscriptionLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch(`/api/subscription?uid=${encodeURIComponent(uid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptionExpiresAt(data.active ? data.expiresAt : null);
        setSubscriptionTier(data.active ? (data.tier ?? null) : null);
      }
    } catch {
      // Ignore — treat as no subscription.
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setSubscriptionExpiresAt(null);
      setSubscriptionTier(null);
      return;
    }
    void checkSubscription(user.uid);
  }, [user, checkSubscription]);

  // Re-check subscription when returning from Stripe checkout.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      // Remove query param and re-check after a short delay for webhook processing.
      window.history.replaceState({}, "", "/");
      const timer = setTimeout(() => void checkSubscription(user.uid), 2000);
      return () => clearTimeout(timer);
    }
    if (params.get("payment") === "cancelled") {
      window.history.replaceState({}, "", "/");
    }
  }, [user, checkSubscription]);

  const hasActiveSubscription = isAdmin || (subscriptionExpiresAt !== null && subscriptionExpiresAt > Date.now());
  const effectiveSubscriptionTier: "vip" | "vvip" | null = isAdmin ? "vvip" : subscriptionTier;

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
          <DevelopedBy />
        </main>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <main className="screen !h-auto !min-h-[100dvh] !content-start !overflow-y-auto gap-5">
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
            renderRecaptcha={renderRecaptcha}
            loginWithGoogle={loginWithGoogle}
            loginWithEmail={loginWithEmail}
            resetPassword={resetPassword}
          />
          <LandingPageSection />
          <DevelopedBy />
          
        </main>
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
            backLabel="Sign Out"
          />
          <DevelopedBy />
        </main>
      </>
    );
  }

  if (!chatMode || !chatFilters) {
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
          <ModeAndFiltersView
            onStart={(mode, filters, nickname) => {
              setChatMode(mode);
              setChatFilters(filters);
              if (nickname) setMyNickname(nickname);
              void startSearching(filters, mode, nickname);
            }}
            onBack={logout}
            hasActiveSubscription={hasActiveSubscription}
            subscriptionTier={effectiveSubscriptionTier}
            onShowPaywall={() => router.push("/plans")}
          />
          <DevelopedBy />
        </main>
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
          onReplyToMessage={onReplyToMessage}
          onReactToMessage={onReactToMessage}
          replyingTo={replyingTo}
          clearReply={clearReply}
          currentUserId={user?.uid ?? ""}
          onDeleteMessage={onDeleteMessage}
          onRevealTimedImage={onRevealTimedImage}
          fileInputRef={fileInputRef}
          onSelectImage={onSelectImage}
          clearAttachment={clearAttachment}
          imagePreview={imagePreview}
          selectedFileName={selectedFileName}
          imageTimerSeconds={imageTimerSeconds}
          setImageTimerSeconds={setImageTimerSeconds}
          groupParticipants={groupParticipants}
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
          subscriptionTier={effectiveSubscriptionTier}
          hasActiveSubscription={hasActiveSubscription}
          onShowPaywall={() => router.push("/plans")}
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
        <DevelopedBy disableLink />
      </main>
    </>
  );
}
