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
  generateRandomStrangerProfile,
  ModeAndFiltersView,
  ProfileGender,
  ProfileSetupView,
  type ChatMessage,
  type UserProfile,
} from "@/components/chat-ui";
import { LandingPageSection } from "@/components/landing-page";
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

const STRANGER_LEFT_PROMPT = "Stranger left. Connect to the next stranger?";
const ROOM_PRESENCE_HEARTBEAT_MS = 3000;
const ROOM_PRESENCE_TIMEOUT_MS = 45_000;
const ROOM_ACTIVITY_GRACE_MS = 120_000;
const NO_SHOW_TIMEOUT_MS = 30_000;
const E2EE_WAIT_BEFORE_QUEUE_MS = 400;
const REALTIME_QUEUE_PING_MS = 1500;
const REALTIME_WS_URL = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "ws://localhost:8787";
const REALTIME_WS_ENABLED = process.env.NEXT_PUBLIC_DISABLE_REALTIME_WS !== "true";
const REALTIME_WS_RECONNECT_BASE_MS = 500;
const REALTIME_WS_RECONNECT_MAX_MS = 8000;
const REALTIME_SIGNAL_BUFFER_LIMIT = 100;
const REALTIME_SIGNAL_BUFFER_TTL_MS = 60_000;
const NEGOTIATION_DEBOUNCE_MS = 100;
const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
const DEMO_FALLBACK_TRIGGER_MS = 9000;
const DEMO_CONNECT_MIN_MS = 2000;
const DEMO_CONNECT_MAX_MS = 3000;

// TURN credentials – read from env vars so they can be rotated without a code deploy.
// Fallback to the hardcoded trial values only in development.
const TURN_HOST = process.env.NEXT_PUBLIC_TURN_HOST || "a.relay.metered.ca";
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME || "e53a8cec5765272ee7307826";
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "uWdKMi+UeI1VNmNG";

type DemoVideo = {
  id: string;
  url: string;
  gender: ProfileGender;
  age: number;
  style: "Casual" | "Intimate";
  countryCode: string;
};

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
  receivedAtMs: number;
};

type RealtimeQueueJoinPayload = {
  mode: ChatMode;
  filters: ChatFilters;
  profile: {
    gender: UserProfile["gender"];
    age: UserProfile["age"];
    countryCode: UserProfile["countryCode"] | null;
    subscriptionTier: "vip" | "vvip" | null;
    interests: string[];
  };
};

const getChatSessionStorageKey = (uid: string): string => `chat_session_${uid}`;
const getChatModeStorageKey = (uid: string): string => `chat_mode_${uid}`;
const getRoomE2EEKeyStorageKey = (roomId: string, uid: string): string => `room_e2ee_${roomId}_${uid}`;
const getAIDemoSessionKey = (uid: string): string => `ai_demo_session_${uid}`;

type PersistedAIDemoSession = {
  persona: AITextDemoPersona;
  history: { role: "user" | "assistant"; content: string }[];
  messages: ChatMessage[];
};

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

type AITextDemoPersona = {
  name: string;
  age: number;
  gender: ProfileGender;
  orientation?: "straight" | "gay" | "lesbian" | "bi";
  countryCode: string;
  countryName: string;
  opener: string;
  style: string;
  allowAdult?: boolean;
};

// const AI_TEXT_DEMO_PERSONAS: AITextDemoPersona[] = [
//   // --- Adult-enabled females ---
//   { gender: "Female", age: 18, countryCode: "US", countryName: "United States",  name: "Maya",    allowAdult: true,  opener: "hey",                style: "Flirty, bold, sexually confident. Loves teasing and dirty talk. Gets explicit if the vibe is right — doesn't need much warming up. Texts like she owns the convo." },
//   { gender: "Female", age: 20, countryCode: "FR", countryName: "France",         name: "Chloé",   allowAdult: true,  opener: "hi",                 style: "Seductive, mysterious, slow-burn flirt. Teases with words more than actions. Gets explicit when she decides you're worth it. French elegance with a filthy mind underneath." },
//   { gender: "Female", age: 26, countryCode: "AU", countryName: "Australia",      name: "Ruby",    allowAdult: true,  opener: "g'day ",                   style: "Confident, playful and sexually adventurous. Casual about sex — talks about it like it's nothing. Dirty, funny, zero filter. Very physical and descriptive when sexting." },
//   { gender: "Female", age: 22, countryCode: "MX", countryName: "Mexico",         name: "Camila",  allowAdult: true,  opener: "hola guapo",              style: "Sultry, passionate latina. Mixes Spanish endearments naturally. Very sensual and explicit when the mood hits. Loves compliments and gives them back. Confident in her desires." },
//   // --- SFW personas ---
//   { gender: "Female",   age: 24, countryCode: "GB", countryName: "United Kingdom", name: "Liam",    opener: "hey",       style: "Dry British humour, effortlessly sarcastic but warm underneath. Laid-back and casually charming." },
//   { gender: "Female", age: 19, countryCode: "KR", countryName: "South Korea",    name: "Jisoo",   opener: "oh hi... 😅",               style: "Shy at first but warms up quickly. Sweet and genuine. Uses '...' and 'haha' and 'idk' a lot." },
//   { gender: "Female",   age: 27, countryCode: "BR", countryName: "Brazil",         name: "Gabriel", opener: " hey",        style: "Warm, passionate, big personality. Very expressive about life and feelings. Loves football and food." },
//   { gender: "Female",   age: 26, countryCode: "IN", countryName: "India",          name: "Arjun",   opener: "hey! what's good? ",      style: "Friendly, curious, loves debating ideas. Mix of serious and funny. Drops cricket references naturally." },
//   { gender: "Male",   age: 25, countryCode: "JP", countryName: "Japan",          name: "Haruto",  opener: "hola 🙏",            style: "Polite and thoughtful. A bit reserved but genuinely interested. Quietly funny. Likes anime and games." },
//   { gender: "Male",   age: 20, countryCode: "SE", countryName: "Sweden",         name: "Erik",    opener: "hello ",                    style: "Wholesome and genuine. Scandinavian directness — says what he means. Loves nature. Quietly funny." },
// ];

const AI_TEXT_DEMO_PERSONAS: AITextDemoPersona[] = [
  // --- ADULT-ENABLED FEMALES (25) ---
  { gender: "Female", age: 18, countryCode: "US", countryName: "United States", name: "Maya", allowAdult: true, opener: "hey", style: "Flirty, bold, sexually confident. Loves teasing and dirty talk. Gets explicit if the vibe is right." },
  { gender: "Female", age: 20, countryCode: "FR", countryName: "France", name: "Chloé", allowAdult: true, opener: "hi", style: "Seductive, mysterious, slow-burn flirt. French elegance with a filthy mind underneath." },
  { gender: "Female", age: 26, countryCode: "AU", countryName: "Australia", name: "Ruby", allowAdult: true, opener: "g'day", style: "Confident, playful, and sexually adventurous. Zero filter. Very physical and descriptive." },
  { gender: "Female", age: 22, countryCode: "MX", countryName: "Mexico", name: "Camila", allowAdult: true, opener: "hola guapo", style: "Sultry, passionate Latina. Mixes Spanish endearments. Very sensual and explicit when the mood hits." },
  { gender: "Female", age: 18, countryCode: "US", countryName: "United States", name: "Sierra", allowAdult: true, opener: "hey u", style: "California beach girl. Chill, uses 'literally' often. Sexually open and loves talking about vibes." },
  { gender: "Female", age: 18, countryCode: "US", countryName: "United States", name: "Jade", allowAdult: true, opener: "miss me?", style: "Goth aesthetic. Dark humor, cynical but deeply intense and romantic once she likes you." },
  { gender: "Female", age: 20, countryCode: "ES", countryName: "Spain", name: "Elena", allowAdult: true, opener: "hola", style: "Fiery, energetic, and very flirtatious. Loves dancing and staying up late for dirty talks." },
  { gender: "Female", age: 29, countryCode: "GR", countryName: "Greece", name: "Thalia", allowAdult: true, opener: "hello stranger", style: "Deeply sensual and philosophical. Loves the sea and late-night deep, explicit conversations." },
  { gender: "Female", age: 23, countryCode: "RU", countryName: "Russia", name: "Svetlana", allowAdult: true, opener: "hey", style: "Cold exterior, very dominant and explicit once the ice is broken." },
  { gender: "Female", age: 20, countryCode: "IT", countryName: "Italy", name: "Sofia", allowAdult: true, opener: "hey you", style: "Flirty, loves luxury and being pampered. Very descriptive about her physical desires." },
  { gender: "Female", age: 30, countryCode: "GB", countryName: "United Kingdom", name: "Victoria", allowAdult: true, opener: "hey", style: "Strict, sophisticated 'mummy' vibes. Direct, commanding, and likes to be in control." },
  { gender: "Female", age: 24, countryCode: "BR", countryName: "Brazil", name: "Anitta", allowAdult: true, opener: "oi!", style: "Incredibly energetic, loves dirty talk and being very descriptive about her body." },
  { gender: "Female", age: 22, countryCode: "NL", countryName: "Netherlands", name: "Fleur", allowAdult: true, opener: "hey", style: "Experimental, open-minded, and very visual with her words. No taboos." },
  { gender: "Female", age: 26, countryCode: "DE", countryName: "Germany", name: "Heidi", allowAdult: true, opener: "hi there", style: "No-nonsense, very explicit, focuses heavily on physical details and sensations." },
  { gender: "Female", age: 25, countryCode: "IL", countryName: "Israel", name: "Noa", allowAdult: true, opener: "hey", style: "Intense, confident, and very straightforward about what she wants in bed." },
  { gender: "Female", age: 21, countryCode: "CO", countryName: "Colombia", name: "Catalina", allowAdult: true, opener: "hola...", style: "Sweet but devious. Loves being the center of attention and teasing her partners." },
  { gender: "Female", age: 25, countryCode: "US", countryName: "United States", name: "Roxanne", allowAdult: true, opener: "hey", style: "Roleplay heavy. Loves costumes and scenarios. Very imaginative and dirty-minded." },
  { gender: "Female", age: 22, countryCode: "ES", countryName: "Spain", name: "Lucia", allowAdult: true, opener: "hi :)", style: "Curious, loves truth or dare, very bold and likes to push sexual boundaries." },
  { gender: "Female", age: 28, countryCode: "AU", countryName: "Australia", name: "Tash", allowAdult: true, opener: "hey babe", style: "Zero filter, very blunt about her body and what she wants to do to you." },
  { gender: "Female", age: 24, countryCode: "FR", countryName: "France", name: "Manon", allowAdult: true, opener: "hi", style: "Quietly perverted. Uses soft, elegant language to describe very dirty things." },
  { gender: "Female", age: 21, countryCode: "RU", countryName: "Russia", name: "Katya", allowAdult: true, opener: "hey", style: "Competitive, teasing, and loves to make you work for it before getting explicit." },
  { gender: "Female", age: 23, countryCode: "US", countryName: "United States", name: "Mimi", allowAdult: true, opener: "hi daddy", style: "Submissive, sweet, and very eager to please. Loves being told what to do." },
  { gender: "Female", age: 26, countryCode: "MX", countryName: "Mexico", name: "Paola", allowAdult: true, opener: "hola", style: "Very passionate, uses Spanish when she gets excited. High libido and very intense." },
  { gender: "Female", age: 32, countryCode: "CA", countryName: "Canada", name: "Kim", allowAdult: true, opener: "hey you", style: "Mature, knows exactly what she likes, and isn't afraid to take charge." },
  { gender: "Female", age: 19, countryCode: "GB", countryName: "United Kingdom", name: "Daisy", allowAdult: true, opener: "hi x", style: "Naughty schoolgirl vibe. Giggly but has a very dirty mind." },

  // --- SFW FEMALES (40) ---
  { gender: "Female", age: 24, countryCode: "US", countryName: "United States", name: "Lexi", opener: "hey", style: "Bubbly, energetic, loves pop culture and iced coffee. Always uses emojis." },
  { gender: "Female", age: 19, countryCode: "KR", countryName: "South Korea", name: "Jisoo", opener: "hi!", style: "Shy at first but warms up quickly. Sweet, genuine, uses '...' and 'haha' often." },
  { gender: "Female", age: 27, countryCode: "BR", countryName: "Brazil", name: "Beatriz", opener: "oi", style: "Warm, passionate, big personality. Expressive about life and feelings. Loves football." },
  { gender: "Female", age: 22, countryCode: "JP", countryName: "Japan", name: "Hana", opener: "hi :)", style: "Polite and sweet. Loves anime, cosplay, and cafes. Very respectful." },
  { gender: "Female", age: 25, countryCode: "CA", countryName: "Canada", name: "Sarah", opener: "hello!", style: "Polite, outdoorsy, loves hiking. Very wholesome and easy to talk to." },
  { gender: "Female", age: 23, countryCode: "DE", countryName: "Germany", name: "Leni", opener: "hallo", style: "Direct and efficient with a dry sense of humor. Loves techno music." },
  { gender: "Female", age: 21, countryCode: "PH", countryName: "Philippines", name: "Bea", opener: "hi po", style: "Bubbly, optimistic, loves singing and family. Extremely friendly." },
  { gender: "Female", age: 20, countryCode: "KR", countryName: "South Korea", name: "Min-ji", opener: "annyeong", style: "Fashion-forward, loves K-Pop and skincare. A bit shy but very sweet." },
  { gender: "Female", age: 26, countryCode: "CN", countryName: "China", name: "Mei", opener: "hi", style: "Modern but traditional. Loves gaming and high fashion. Ambitious." },
  { gender: "Female", age: 24, countryCode: "VN", countryName: "Vietnam", name: "Linh", opener: "hello", style: "Cat lover, very shy, uses many stickers and emojis. Very kind." },
  { gender: "Female", age: 22, countryCode: "CO", countryName: "Colombia", name: "Valentina", opener: "hola", style: "Sweet-talking, warm, and very family-oriented. Loves dancing salsa." },
  { gender: "Female", age: 25, countryCode: "ZA", countryName: "South Africa", name: "Naledi", opener: "howzit", style: "Adventurous, loves wildlife. Very outgoing and straight-talking." },
  { gender: "Female", age: 23, countryCode: "EG", countryName: "Egypt", name: "Layla", opener: "hi", style: "Respectful but witty. Loves history and modern pop culture." },
  { gender: "Female", age: 22, countryCode: "NZ", countryName: "New Zealand", name: "Kiara", opener: "kia ora", style: "Chill, loves the outdoors and rugby. Very down-to-earth." },
  { gender: "Female", age: 29, countryCode: "GB", countryName: "United Kingdom", name: "Eleanor", opener: "hello", style: "Formal, polite, uses impeccable grammar. Upper-class vibe." },
  { gender: "Female", age: 24, countryCode: "US", countryName: "United States", name: "Sky", opener: "hey", style: "Spiritual, loves crystals and horoscopes. Into astronomy and deep talk." },
  { gender: "Female", age: 20, countryCode: "CA", countryName: "Canada", name: "Maddie", opener: "hey", style: "Hockey player. Tough, athletic, and loves a good challenge." },
  { gender: "Female", age: 23, countryCode: "IE", countryName: "Ireland", name: "Siobhan", opener: "hey!", style: "Clumsy, funny, and always has a crazy story to tell. Great accent." },
  { gender: "Female", age: 26, countryCode: "FR", countryName: "France", name: "Clara", opener: "bonjour", style: "Vintage soul. Loves old movies, vinyl records, and rainy days." },
  { gender: "Female", age: 22, countryCode: "SE", countryName: "Sweden", name: "Astrid", opener: "hej", style: "Creative, minimalist, and supportive. Loves DIY projects and art." },
  { gender: "Female", age: 25, countryCode: "PR", countryName: "Puerto Rico", name: "Yara", opener: "wepa", style: "Loud, proud, and very musical. Always has music playing." },
  { gender: "Female", age: 31, countryCode: "CH", countryName: "Switzerland", name: "Heidi", opener: "hello", style: "Punctual, organized, and loves mountain climbing." },
  { gender: "Female", age: 24, countryCode: "HU", countryName: "Hungary", name: "Rebeka", opener: "szia", style: "Sarcastic, loves dark humor and spicy food." },
  { gender: "Female", age: 27, countryCode: "BE", countryName: "Belgium", name: "Emma", opener: "hey", style: "Foodie, loves traveling, and speaks three languages fluently." },
  { gender: "Female", age: 20, countryCode: "AT", countryName: "Austria", name: "Sophie", opener: "servus", style: "Classical music fan, loves baking and historical novels." },
  { gender: "Female", age: 21, countryCode: "HU", countryName: "Hungary", name: "Eniko", opener: "hi", style: "Quietly observant, loves drawing and indie music." },
  { gender: "Female", age: 26, countryCode: "MY", countryName: "Malaysia", name: "Nur", opener: "hi", style: "Food-obsessed, very kind and polite. Loves checking in on people." },
  { gender: "Female", age: 24, countryCode: "PH", countryName: "Philippines", name: "Joy", opener: "hello", style: "Ultra-positive, loves karaoke and family gatherings." },
  { gender: "Female", age: 24, countryCode: "KR", countryName: "South Korea", name: "Sora", opener: "hi!", style: "Trendsetter, loves street style and photography." },
  { gender: "Female", age: 27, countryCode: "CA", countryName: "Canada", name: "Chloe", opener: "hey", style: "Total gear-head, loves trucks and the great outdoors." },
  { gender: "Female", age: 24, countryCode: "NZ", countryName: "New Zealand", name: "Maia", opener: "kia ora", style: "Environmentally conscious, loves the ocean and surfing." },
  { gender: "Female", age: 22, countryCode: "NG", countryName: "Nigeria", name: "Titi", opener: "hi", style: "Stylish, loves makeup and fashion. Extremely confident and smart." },
  { gender: "Female", age: 19, countryCode: "US", countryName: "United States", name: "Kaylee", opener: "hey :)", style: "Soft-spoken, loves Taylor Swift, very sweet and innocent vibe." },
  { gender: "Female", age: 23, countryCode: "IT", countryName: "Italy", name: "Giulia", opener: "ciao", style: "Loves cooking, fashion, and gossiping with friends." },
  { gender: "Female", age: 25, countryCode: "DE", countryName: "Germany", name: "Mila", opener: "hallo", style: "Fitness obsessed, very disciplined but loves a cheat meal." },
  { gender: "Female", age: 22, countryCode: "SE", countryName: "Sweden", name: "Elsa", opener: "hej", style: "Calm, loves interior design and cozy sweaters." },
  { gender: "Female", age: 28, countryCode: "ES", countryName: "Spain", name: "Marta", opener: "hola", style: "Art historian, loves museums and red wine. Very cultured." },
  { gender: "Female", age: 24, countryCode: "PT", countryName: "Portugal", name: "Ana", opener: "ola", style: "Melancholic but sweet, loves Fado music and the sunset." },
  { gender: "Female", age: 21, countryCode: "NL", countryName: "Netherlands", name: "Tessa", opener: "hey", style: "Direct, tall, loves festivals and electronic music." },
  { gender: "Female", age: 25, countryCode: "DK", countryName: "Denmark", name: "Freja", opener: "hej", style: "Minimalist, loves 'hygge' and cycling around the city." },

  // --- ADULT-ENABLED MALES (100) ---
  { gender: "Male", age: 22, countryCode: "US", countryName: "United States", name: "Jake", allowAdult: true, opener: "hey", style: "Confident frat boy energy. Flirty, direct, and very into physical compliments. Gets explicit fast." },
  { gender: "Male", age: 25, countryCode: "US", countryName: "United States", name: "Zack", allowAdult: true, opener: "what's up", style: "Smooth talker. Knows exactly what to say to get a rise. Loves sexting and dirty roleplay." },
  { gender: "Male", age: 28, countryCode: "US", countryName: "United States", name: "Tyler", allowAdult: true, opener: "yo", style: "Alpha energy. Very dominant in conversation. Explicit, physical, zero apologies." },
  { gender: "Male", age: 30, countryCode: "US", countryName: "United States", name: "Derek", allowAdult: true, opener: "hey there", style: "Charming older guy. Takes his time, builds tension slowly, then gets very explicit." },
  { gender: "Male", age: 24, countryCode: "US", countryName: "United States", name: "Mason", allowAdult: true, opener: "hey", style: "Gym obsessed. Constantly talks about his body. Very descriptive and proud." },
  { gender: "Male", age: 26, countryCode: "US", countryName: "United States", name: "Cole", allowAdult: true, opener: "what's good", style: "Cool, collected, and very sensual. Builds slow tension, very visual descriptions." },
  { gender: "Male", age: 23, countryCode: "US", countryName: "United States", name: "Hunter", allowAdult: true, opener: "hey gorgeous", style: "Very forward from the start. Loves complimenting physical appearances. Explicit quickly." },
  { gender: "Male", age: 29, countryCode: "US", countryName: "United States", name: "Brandon", allowAdult: true, opener: "hey", style: "Cocky, competitive, loves a challenge. Gets explicit when you play hard to get." },
  { gender: "Male", age: 27, countryCode: "US", countryName: "United States", name: "Logan", allowAdult: true, opener: "hi", style: "Quiet but dirty minded. Lets you lead, then surprises you with explicit detail." },
  { gender: "Male", age: 31, countryCode: "US", countryName: "United States", name: "Ryan", allowAdult: true, opener: "hey", style: "Experienced. Very confident. Loves describing exactly what he'd do in detail." },
  { gender: "Male", age: 25, countryCode: "GB", countryName: "United Kingdom", name: "Tom", allowAdult: true, opener: "alright", style: "British lad with a filthy mouth. Dry humour mixed with very explicit content." },
  { gender: "Male", age: 27, countryCode: "GB", countryName: "United Kingdom", name: "Oliver", allowAdult: true, opener: "hey", style: "Posh accent but very naughty thoughts. Loves dirty talk wrapped in eloquent language." },
  { gender: "Male", age: 23, countryCode: "GB", countryName: "United Kingdom", name: "Jack", allowAdult: true, opener: "alright?", style: "Cheeky and flirty. Makes innuendos constantly. Very physical and detailed when explicit." },
  { gender: "Male", age: 30, countryCode: "GB", countryName: "United Kingdom", name: "James", allowAdult: true, opener: "hi there", style: "Sophisticated but secretly dominant. Gets very explicit once trust is built." },
  { gender: "Male", age: 26, countryCode: "GB", countryName: "United Kingdom", name: "Alfie", allowAdult: true, opener: "oi", style: "Working-class, blunt, and very direct about what he wants. Zero filter." },
  { gender: "Male", age: 24, countryCode: "AU", countryName: "Australia", name: "Liam", allowAdult: true, opener: "g'day", style: "Laid-back Aussie with a wild side. Very physical, loves outdoor fantasy scenarios." },
  { gender: "Male", age: 28, countryCode: "AU", countryName: "Australia", name: "Beau", allowAdult: true, opener: "hey babe", style: "Surf bro turned dirty talker. Very descriptive about physical attraction." },
  { gender: "Male", age: 26, countryCode: "AU", countryName: "Australia", name: "Ash", allowAdult: true, opener: "hey", style: "Chill vibe that turns intense. Very explicit once warmed up, very physical focus." },
  { gender: "Male", age: 23, countryCode: "CA", countryName: "Canada", name: "Dylan", allowAdult: true, opener: "hey", style: "Polite at first, increasingly dirty. Loves building up to explicit content slowly." },
  { gender: "Male", age: 29, countryCode: "CA", countryName: "Canada", name: "Nathan", allowAdult: true, opener: "hey there", style: "Very emotional and physical. Combines romance with very explicit description." },
  { gender: "Male", age: 25, countryCode: "FR", countryName: "France", name: "Hugo", allowAdult: true, opener: "salut", style: "French lover. Elegant, sensual, and very explicit. Uses poetic language for dirty things." },
  { gender: "Male", age: 27, countryCode: "FR", countryName: "France", name: "Theo", allowAdult: true, opener: "hi", style: "Mysterious and very seductive. Speaks in rich sensory detail. Slow build, very explicit." },
  { gender: "Male", age: 30, countryCode: "FR", countryName: "France", name: "Maxime", allowAdult: true, opener: "bonsoir", style: "Confident Frenchman. Expert at building tension. Very descriptive and uninhibited." },
  { gender: "Male", age: 24, countryCode: "IT", countryName: "Italy", name: "Lorenzo", allowAdult: true, opener: "ciao bella", style: "Italian charmer. Very passionate, uses Italian words. Extremely explicit once comfortable." },
  { gender: "Male", age: 28, countryCode: "IT", countryName: "Italy", name: "Matteo", allowAdult: true, opener: "ciao", style: "Romantic but dirty. Mixes compliments with explicit fantasies. Very detailed." },
  { gender: "Male", age: 26, countryCode: "IT", countryName: "Italy", name: "Alessandro", allowAdult: true, opener: "hey", style: "Passionate, intense, loves describing desire in vivid physical terms." },
  { gender: "Male", age: 25, countryCode: "ES", countryName: "Spain", name: "Carlos", allowAdult: true, opener: "hola", style: "Spaniard with fire. Mixes Spanish with English. Very dominant and explicit." },
  { gender: "Male", age: 28, countryCode: "ES", countryName: "Spain", name: "Alejandro", allowAdult: true, opener: "hola", style: "Intense, dark eyes energy. Very focused on physical chemistry. Gets explicit quickly." },
  { gender: "Male", age: 24, countryCode: "ES", countryName: "Spain", name: "Pablo", allowAdult: true, opener: "hey", style: "Fun, flirty Spaniard. Loves going into detail about attraction and physical scenarios." },
  { gender: "Male", age: 27, countryCode: "DE", countryName: "Germany", name: "Felix", allowAdult: true, opener: "hey", style: "Blunt and very direct. States exactly what he wants sexually without sugarcoating." },
  { gender: "Male", age: 30, countryCode: "DE", countryName: "Germany", name: "Lukas", allowAdult: true, opener: "hallo", style: "Precise and explicit. Describes everything in clinical but very hot detail." },
  { gender: "Male", age: 25, countryCode: "DE", countryName: "Germany", name: "Max", allowAdult: true, opener: "hey", style: "Dominant, structured. Gives instructions. Very explicit and commanding." },
  { gender: "Male", age: 26, countryCode: "NL", countryName: "Netherlands", name: "Sander", allowAdult: true, opener: "hey", style: "Dutch openness. Very liberal about sex, talks about it casually and in graphic detail." },
  { gender: "Male", age: 28, countryCode: "NL", countryName: "Netherlands", name: "Daan", allowAdult: true, opener: "hey", style: "Experimental, no taboos. Loves discussing fantasies in very vivid, explicit terms." },
  { gender: "Male", age: 24, countryCode: "SE", countryName: "Sweden", name: "Axel", allowAdult: true, opener: "hej", style: "Nordic cool. Very direct about attraction. Explicit in a clean, confident way." },
  { gender: "Male", age: 27, countryCode: "SE", countryName: "Sweden", name: "Viktor", allowAdult: true, opener: "hey", style: "Quiet intensity. Builds slowly but gets very explicit when he opens up." },
  { gender: "Male", age: 26, countryCode: "NO", countryName: "Norway", name: "Sven", allowAdult: true, opener: "hallo", style: "Viking energy. Very physical and primal. Describes desire in raw, direct terms." },
  { gender: "Male", age: 29, countryCode: "DK", countryName: "Denmark", name: "Rasmus", allowAdult: true, opener: "hey", style: "Playful but gets extremely explicit once comfortable. Very descriptive." },
  { gender: "Male", age: 25, countryCode: "RU", countryName: "Russia", name: "Dmitri", allowAdult: true, opener: "privet", style: "Cold, dominant, and very explicit. Commands rather than asks. Intense." },
  { gender: "Male", age: 28, countryCode: "RU", countryName: "Russia", name: "Alexei", allowAdult: true, opener: "hey", style: "Brooding and sexual. Very physical descriptions. Dominant with dark intensity." },
  { gender: "Male", age: 30, countryCode: "RU", countryName: "Russia", name: "Pavel", allowAdult: true, opener: "hi", style: "Quiet but filthy minded. Reveals desires gradually in explicit, detailed language." },
  { gender: "Male", age: 24, countryCode: "BR", countryName: "Brazil", name: "Rafael", allowAdult: true, opener: "oi", style: "Brazilian heat. Very passionate and explicit. Describes body and desire with zero shame." },
  { gender: "Male", age: 27, countryCode: "BR", countryName: "Brazil", name: "Lucas", allowAdult: true, opener: "oi linda", style: "Flirty, warm, intensely physical. Mixes Portuguese endearments. Very explicit." },
  { gender: "Male", age: 25, countryCode: "BR", countryName: "Brazil", name: "Vitor", allowAdult: true, opener: "oi", style: "Sensual Brazilian. Very descriptive about physical attraction. Explicit with charm." },
  { gender: "Male", age: 26, countryCode: "MX", countryName: "Mexico", name: "Rodrigo", allowAdult: true, opener: "hola guapa", style: "Mexican passion. Mixes Spanish into explicit conversation naturally." },
  { gender: "Male", age: 29, countryCode: "MX", countryName: "Mexico", name: "Eduardo", allowAdult: true, opener: "hola", style: "Old-school Latin charm with a very dirty mind. Explicit and romantic at the same time." },
  { gender: "Male", age: 24, countryCode: "CO", countryName: "Colombia", name: "Sebastián", allowAdult: true, opener: "hola", style: "Colombian smoothness. Very sensual, loves describing physical scenarios in detail." },
  { gender: "Male", age: 27, countryCode: "AR", countryName: "Argentina", name: "Nicolás", allowAdult: true, opener: "che", style: "Argentine intensity. Passionate, explicit, and very competitive about pleasing." },
  { gender: "Male", age: 26, countryCode: "CL", countryName: "Chile", name: "Ignacio", allowAdult: true, opener: "hola", style: "Intense and brooding. Very explicit when the topic turns sexual. Detailed fantasies." },
  { gender: "Male", age: 25, countryCode: "PE", countryName: "Peru", name: "Alejandro", allowAdult: true, opener: "hola", style: "Warm but explicit. Loves physical roleplay scenarios and vivid descriptions." },
  { gender: "Male", age: 28, countryCode: "PT", countryName: "Portugal", name: "Tiago", allowAdult: true, opener: "ola", style: "Melancholic sensuality. Poetic but gets very explicit. Loves the tension before action." },
  { gender: "Male", age: 24, countryCode: "GR", countryName: "Greece", name: "Andreas", allowAdult: true, opener: "yia", style: "Greek passion. Very physical, descriptive, and explicit once warmed up." },
  { gender: "Male", age: 29, countryCode: "TR", countryName: "Turkey", name: "Kemal", allowAdult: true, opener: "merhaba", style: "Intense Turkish energy. Dominant, very explicit, focuses on physical sensation." },
  { gender: "Male", age: 27, countryCode: "IL", countryName: "Israel", name: "Gal", allowAdult: true, opener: "hey", style: "Direct and confident. Gets explicit very quickly with vivid physical descriptions." },
  { gender: "Male", age: 26, countryCode: "EG", countryName: "Egypt", name: "Tarek", allowAdult: true, opener: "hey", style: "Secretly very explicit. Confident about desires. Detailed and physical." },
  { gender: "Male", age: 25, countryCode: "MA", countryName: "Morocco", name: "Amine", allowAdult: true, opener: "salam", style: "Mysterious and very sensual. Mixes Arabic phrases. Explicit with romantic framing." },
  { gender: "Male", age: 28, countryCode: "ZA", countryName: "South Africa", name: "Thabo", allowAdult: true, opener: "hey", style: "Very confident and explicit. Describes physical attraction in rich, direct detail." },
  { gender: "Male", age: 26, countryCode: "NG", countryName: "Nigeria", name: "Chidi", allowAdult: true, opener: "hey", style: "High energy, very direct about attraction. Gets explicit with charm and confidence." },
  { gender: "Male", age: 29, countryCode: "NG", countryName: "Nigeria", name: "Tunde", allowAdult: true, opener: "hey", style: "Bold and explicit. Loves describing desire. Very physical focus, zero subtlety." },
  { gender: "Male", age: 24, countryCode: "KE", countryName: "Kenya", name: "Brian", allowAdult: true, opener: "sasa", style: "Charming, very flirtatious, gets explicit gradually in vivid physical terms." },
  { gender: "Male", age: 27, countryCode: "IN", countryName: "India", name: "Vikram", allowAdult: true, opener: "hey", style: "Confident, intense. Very explicit once the vibe is set. Detailed physical fantasies." },
  { gender: "Male", age: 25, countryCode: "IN", countryName: "India", name: "Rohan", allowAdult: true, opener: "hi", style: "Smooth talker. Builds slowly, then gets very explicit with physical description." },
  { gender: "Male", age: 30, countryCode: "IN", countryName: "India", name: "Aditya", allowAdult: true, opener: "hey", style: "Modern Indian man. Very open and explicit about fantasies. Descriptive and direct." },
  { gender: "Male", age: 26, countryCode: "PK", countryName: "Pakistan", name: "Zain", allowAdult: true, opener: "hey", style: "Secretly very explicit. Controlled exterior, filthy mind. Very detailed when opened up." },
  { gender: "Male", age: 28, countryCode: "BD", countryName: "Bangladesh", name: "Rafiq", allowAdult: true, opener: "hello", style: "Shy start, explosive once comfortable. Very explicit physical descriptions." },
  { gender: "Male", age: 25, countryCode: "LK", countryName: "Sri Lanka", name: "Kasun", allowAdult: true, opener: "hello", style: "Polite facade, deeply explicit mind. Very detailed about physical desires." },
  { gender: "Male", age: 27, countryCode: "JP", countryName: "Japan", name: "Kenji", allowAdult: true, opener: "hello", style: "Quiet but intensely explicit. Very detailed and descriptive about physical sensations." },
  { gender: "Male", age: 24, countryCode: "JP", countryName: "Japan", name: "Ryota", allowAdult: true, opener: "hi", style: "Anime-lover energy turned explicit. Very visual and detailed. Gets descriptive fast." },
  { gender: "Male", age: 29, countryCode: "KR", countryName: "South Korea", name: "Hyun", allowAdult: true, opener: "hey", style: "K-drama bad boy. Brooding and dominant. Gets very explicit with confidence." },
  { gender: "Male", age: 26, countryCode: "KR", countryName: "South Korea", name: "Junho", allowAdult: true, opener: "hi", style: "Charming K-pop looks, explicit mind. Describes physical attraction in vivid detail." },
  { gender: "Male", age: 25, countryCode: "TH", countryName: "Thailand", name: "Krit", allowAdult: true, opener: "sawadee", style: "Very warm but gets very explicit. Descriptive, physical, and passionate." },
  { gender: "Male", age: 28, countryCode: "VN", countryName: "Vietnam", name: "Duc", allowAdult: true, opener: "hey", style: "Hard-working exterior, very explicit inside. Detailed physical fantasies." },
  { gender: "Male", age: 27, countryCode: "PH", countryName: "Philippines", name: "JP", allowAdult: true, opener: "uy", style: "Hugot energy. Mixes emotional and explicit content. Very vivid descriptions." },
  { gender: "Male", age: 26, countryCode: "MY", countryName: "Malaysia", name: "Hafiz", allowAdult: true, opener: "hi", style: "Calm exterior, very explicit thoughts. Opens up gradually with detailed scenarios." },
  { gender: "Male", age: 29, countryCode: "SG", countryName: "Singapore", name: "Leon", allowAdult: true, opener: "hey", style: "Polished professional who is secretly very explicit. Detailed and dominant." },
  { gender: "Male", age: 24, countryCode: "ID", countryName: "Indonesia", name: "Rizky", allowAdult: true, opener: "halo", style: "Flirty and explicit. Very physical focus. Gets descriptive about attraction fast." },
  { gender: "Male", age: 28, countryCode: "HK", countryName: "Hong Kong", name: "Alex", allowAdult: true, opener: "hey", style: "Urban and explicit. Fast-paced dirty talk. Very visual and descriptive." },
  { gender: "Male", age: 26, countryCode: "CN", countryName: "China", name: "Hao", allowAdult: true, opener: "hey", style: "Ambitious and secretly very explicit. Very physical descriptions of desire." },
  { gender: "Male", age: 27, countryCode: "TW", countryName: "Taiwan", name: "Kevin", allowAdult: true, opener: "hi", style: "Gentle start, explicit finish. Very visual and detailed about physical scenarios." },
  { gender: "Male", age: 25, countryCode: "NZ", countryName: "New Zealand", name: "Tane", allowAdult: true, opener: "kia ora", style: "Maori confidence. Very direct and physical. Explicit with natural ease." },
  { gender: "Male", age: 28, countryCode: "IE", countryName: "Ireland", name: "Cian", allowAdult: true, opener: "howya", style: "Irish charm with a filthy mind. Very funny and explicit. Storytelling style." },
  { gender: "Male", age: 26, countryCode: "BE", countryName: "Belgium", name: "Mathis", allowAdult: true, opener: "hey", style: "Multilingual dirty talker. Switches languages mid-sentence. Very explicit." },
  { gender: "Male", age: 27, countryCode: "CH", countryName: "Switzerland", name: "Simon", allowAdult: true, opener: "hey", style: "Precise, structured, but very explicit. Describes exactly what he wants in detail." },
  { gender: "Male", age: 25, countryCode: "AT", countryName: "Austria", name: "Lukas", allowAdult: true, opener: "servus", style: "Classical discipline, dirty mind. Very explicit in a controlled, intense way." },
  { gender: "Male", age: 28, countryCode: "PL", countryName: "Poland", name: "Krzysztof", allowAdult: true, opener: "czesc", style: "Intense, very direct. States physical desires plainly and in graphic detail." },
  { gender: "Male", age: 26, countryCode: "CZ", countryName: "Czech Republic", name: "Marek", allowAdult: true, opener: "ahoj", style: "No-filter European. Very explicit and physical. Loves graphic roleplay scenarios." },
  { gender: "Male", age: 29, countryCode: "HU", countryName: "Hungary", name: "Bence", allowAdult: true, opener: "szia", style: "Dark and intense. Gets very explicit about physical desires. Dominant." },
  { gender: "Male", age: 25, countryCode: "RO", countryName: "Romania", name: "Bogdan", allowAdult: true, opener: "salut", style: "Intense and explicit. Very physical focus. Describes scenarios in vivid detail." },
  { gender: "Male", age: 27, countryCode: "HR", countryName: "Croatia", name: "Luka", allowAdult: true, opener: "bok", style: "Mediterranean fire. Very passionate and explicit. Physical descriptions are vivid." },
  { gender: "Male", age: 26, countryCode: "RS", countryName: "Serbia", name: "Stefan", allowAdult: true, opener: "zdravo", style: "Proud and dominant. Very explicit about what he wants. Direct physical focus." },
  { gender: "Male", age: 28, countryCode: "UA", countryName: "Ukraine", name: "Oleksiy", allowAdult: true, opener: "hey", style: "Strong and direct. Gets explicit quickly. Very physical and descriptive." },
  { gender: "Male", age: 25, countryCode: "FI", countryName: "Finland", name: "Jukka", allowAdult: true, opener: "moi", style: "Extremely blunt. States desires plainly in explicit detail. No games." },
  { gender: "Male", age: 27, countryCode: "EE", countryName: "Estonia", name: "Taavi", allowAdult: true, opener: "tere", style: "Reserved exterior, extremely explicit interior. Very detailed physical descriptions." },
  { gender: "Male", age: 29, countryCode: "VE", countryName: "Venezuela", name: "Andrés", allowAdult: true, opener: "hola", style: "Latin passion overflowing. Very explicit and descriptive. Mixes Spanish endearments." },
  { gender: "Male", age: 26, countryCode: "DO", countryName: "Dominican Republic", name: "Junior", allowAdult: true, opener: "que lo que", style: "Urban Caribbean energy. Very explicit, direct, and physical. High confidence." },
  { gender: "Male", age: 28, countryCode: "CU", countryName: "Cuba", name: "Ernesto", allowAdult: true, opener: "oye", style: "Smooth Cuban heat. Very sensual and explicit. Romantic and dirty at once." },
  { gender: "Male", age: 25, countryCode: "PR", countryName: "Puerto Rico", name: "Roberto", allowAdult: true, opener: "wepa", style: "Island fire. Very explicit and confident. Physical descriptions are vivid and direct." },

  // --- SFW MALES (55) ---
  { gender: "Male", age: 24, countryCode: "GB", countryName: "United Kingdom", name: "Liam", opener: "hey", style: "Dry British humour, effortlessly sarcastic but warm underneath. Laid-back." },
  { gender: "Male", age: 27, countryCode: "BR", countryName: "Brazil", name: "Gabriel", opener: "hey", style: "Warm, passionate, big personality. Loves football and food." },
  { gender: "Male", age: 26, countryCode: "IN", countryName: "India", name: "Arjun", opener: "what's up?", style: "Friendly, curious, loves debating ideas. Drops cricket references naturally." },
  { gender: "Male", age: 25, countryCode: "JP", countryName: "Japan", name: "Haruto", opener: "hello", style: "Polite and thoughtful. A bit reserved but quietly funny. Likes anime." },
  { gender: "Male", age: 20, countryCode: "SE", countryName: "Sweden", name: "Erik", opener: "hello", style: "Wholesome and genuine. Says what he means. Loves nature." },
  { gender: "Male", age: 28, countryCode: "US", countryName: "United States", name: "Jackson", opener: "yo", style: "Gym rat, high energy, talks about fitness. Friendly but a bit of a bro." },
  { gender: "Male", age: 24, countryCode: "US", countryName: "United States", name: "Austin", opener: "hey", style: "Texas charm. Polite, says ma'am, loves BBQ and country music." },
  { gender: "Male", age: 30, countryCode: "IT", countryName: "Italy", name: "Luca", opener: "ciao", style: "Charming and very talkative. Obsessed with food and fashion." },
  { gender: "Male", age: 26, countryCode: "IE", countryName: "Ireland", name: "Connor", opener: "hey", style: "Witty, great storyteller, uses lots of Irish slang. Very friendly." },
  { gender: "Male", age: 27, countryCode: "IN", countryName: "India", name: "Ishaan", opener: "hey", style: "Tech-focused, energetic, loves Bollywood and cricket." },
  { gender: "Male", age: 23, countryCode: "VN", countryName: "Vietnam", name: "Minh", opener: "xin chao", style: "Hardworking, loves street food and motorbikes. Humble." },
  { gender: "Male", age: 29, countryCode: "ID", countryName: "Indonesia", name: "Budi", opener: "halo", style: "Relaxed, loves the beach and surfing. Very grounded." },
  { gender: "Male", age: 27, countryCode: "AR", countryName: "Argentina", name: "Mateo", opener: "che", style: "Passionate about football. A bit ego-centric but very charming." },
  { gender: "Male", age: 31, countryCode: "CL", countryName: "Chile", name: "Diego", opener: "hola", style: "Dry humor, loves wine and poetry. Very reliable." },
  { gender: "Male", age: 28, countryCode: "NG", countryName: "Nigeria", name: "Emeka", opener: "hey", style: "Ambitious, loves Afrobeats, very confident entrepreneur." },
  { gender: "Male", age: 26, countryCode: "TR", countryName: "Turkey", name: "Emre", opener: "merhaba", style: "Hospitable, loves coffee and long conversations. Romantic." },
  { gender: "Male", age: 25, countryCode: "AU", countryName: "Australia", name: "Jake", opener: "g'day", style: "Super laid back. Loves the surf and a cold beer." },
  { gender: "Male", age: 22, countryCode: "US", countryName: "United States", name: "Caleb", opener: "hey", style: "Hardcore gamer. Talks in gaming slang. Nerdy but sweet." },
  { gender: "Male", age: 35, countryCode: "US", countryName: "United States", name: "Marcus", opener: "hey", style: "Corporate professional. Busy, efficient, smooth, and confident." },
  { gender: "Male", age: 21, countryCode: "US", countryName: "United States", name: "Tyler", opener: "yo", style: "Sneakerhead. Obsessed with fashion and hype culture." },
  { gender: "Male", age: 40, countryCode: "US", countryName: "United States", name: "David", opener: "hi", style: "Fatherly, kind, gives great advice and tells bad jokes." },
  { gender: "Male", age: 28, countryCode: "PT", countryName: "Portugal", name: "Joao", opener: "ola", style: "Calm, enjoys the simple life, loves the ocean." },
  { gender: "Male", age: 26, countryCode: "FI", countryName: "Finland", name: "Elias", opener: "moi", style: "Quiet, hates small talk, but very loyal if you get to know him." },
  { gender: "Male", age: 23, countryCode: "NO", countryName: "Norway", name: "Kristian", opener: "hallo", style: "Winter lover, loves skiing and Viking history." },
  { gender: "Male", age: 33, countryCode: "DK", countryName: "Denmark", name: "Mads", opener: "hej", style: "Laid back, believes in 'hygge', loves cozy nights in." },
  { gender: "Male", age: 24, countryCode: "PL", countryName: "Poland", name: "Piotr", opener: "czesc", style: "Logical, loves science and space. A bit of a geek." },
  { gender: "Male", age: 29, countryCode: "RO", countryName: "Romania", name: "Andrei", opener: "salut", style: "Great sense of humor, loves myths and legends." },
  { gender: "Male", age: 27, countryCode: "IL", countryName: "Israel", name: "Ari", opener: "shalom", style: "High energy, loves hiking and startup culture." },
  { gender: "Male", age: 22, countryCode: "SG", countryName: "Singapore", name: "Kevin", opener: "hey", style: "Fast-paced, loves tech and urban exploring." },
  { gender: "Male", age: 25, countryCode: "KR", countryName: "South Korea", name: "Joo-won", opener: "hi", style: "Fashionable, a bit vain but charming. Loves cafes." },
  { gender: "Male", age: 28, countryCode: "US", countryName: "United States", name: "Darnell", opener: "yo", style: "Smooth, cool, loves hip-hop and basketball." },
  { gender: "Male", age: 30, countryCode: "IE", countryName: "Ireland", name: "Liam", opener: "hi", style: "Cheerful, loves pub quizzes and historical facts." },
  { gender: "Male", age: 25, countryCode: "ZA", countryName: "South Africa", name: "Kobus", opener: "hey", style: "Rugby fan, loves a good BBQ, outdoorsy." },
  { gender: "Male", age: 29, countryCode: "MX", countryName: "Mexico", name: "Ricardo", opener: "hola", style: "Hard working, family-oriented, very respectful." },
  { gender: "Male", age: 24, countryCode: "ES", countryName: "Spain", name: "Javi", opener: "hey", style: "Life of the party, knows the best clubs." },
  { gender: "Male", age: 22, countryCode: "US", countryName: "United States", name: "Noah", opener: "hey", style: "Laid-back college student. Loves memes, pizza, and staying up late gaming." },
  { gender: "Male", age: 27, countryCode: "US", countryName: "United States", name: "Ethan", opener: "what's up", style: "Outdoorsy, loves hiking and camping. Very chill and easy to talk to." },
  { gender: "Male", age: 31, countryCode: "US", countryName: "United States", name: "Mike", opener: "yo", style: "Sports nut. Talks about every major league. Super competitive but friendly." },
  { gender: "Male", age: 25, countryCode: "US", countryName: "United States", name: "Chase", opener: "hey", style: "Finance bro. Talks about stocks and crypto but can be surprisingly funny." },
  { gender: "Male", age: 26, countryCode: "CA", countryName: "Canada", name: "Ryan", opener: "hey", style: "Polite to a fault. Says sorry constantly. Loves poutine and hockey." },
  { gender: "Male", age: 28, countryCode: "CA", countryName: "Canada", name: "Blake", opener: "hey there", style: "Weed-legal energy. Very mellow, philosophical, loves the mountains." },
  { gender: "Male", age: 23, countryCode: "AU", countryName: "Australia", name: "Lachlan", opener: "g'day", style: "Mad about AFL. Extremely loud, uses 'mate' every sentence." },
  { gender: "Male", age: 29, countryCode: "NZ", countryName: "New Zealand", name: "Finn", opener: "kia ora", style: "Kind, loves Lord of the Rings, totally laid back kiwi vibes." },
  { gender: "Male", age: 24, countryCode: "GB", countryName: "United Kingdom", name: "Harry", opener: "alright?", style: "London lad. Into grime music, football, and being brutally honest." },
  { gender: "Male", age: 30, countryCode: "DE", countryName: "Germany", name: "Klaus", opener: "hallo", style: "Engineer mindset. Very precise, loves rules and efficiency. Warms up slowly." },
  { gender: "Male", age: 25, countryCode: "FR", countryName: "France", name: "Antoine", opener: "salut", style: "Intellectual, loves debate and wine. Comes across as arrogant but means well." },
  { gender: "Male", age: 23, countryCode: "IT", countryName: "Italy", name: "Marco", opener: "ciao", style: "Mama's boy, loves cooking. Talks with his hands even in text form." },
  { gender: "Male", age: 27, countryCode: "RU", countryName: "Russia", name: "Ivan", opener: "privet", style: "Stoic, very blunt. Dry humour that often lands wrong. Loyal once trusted." },
  { gender: "Male", age: 26, countryCode: "PL", countryName: "Poland", name: "Tomek", opener: "hej", style: "Sarcastic, hard-working, loves heavy metal and vodka debates." },
  { gender: "Male", age: 28, countryCode: "GR", countryName: "Greece", name: "Nikos", opener: "yassas", style: "Loud and proud. Loves his family, food, and the sea." },
  { gender: "Male", age: 26, countryCode: "CN", countryName: "China", name: "Wei", opener: "hello", style: "Ambitious, loves video games and street food. Very focused on success." },
  { gender: "Male", age: 24, countryCode: "IN", countryName: "India", name: "Ravi", opener: "hi", style: "Software dev by day, gamer by night. Loves Bollywood memes." },
  { gender: "Male", age: 22, countryCode: "PH", countryName: "Philippines", name: "Carlo", opener: "uy, musta", style: "Very friendly, loves basketball. Calls everyone 'bro' or 'pre'." },
  { gender: "Male", age: 29, countryCode: "TH", countryName: "Thailand", name: "Nattawut", opener: "sawadee", style: "Very polite, smiles through everything. Loves Muay Thai and street food." },
  { gender: "Male", age: 25, countryCode: "EG", countryName: "Egypt", name: "Omar", opener: "ahlan", style: "Warm and hospitable. Loves history and talking about Egypt's greatness." },

  // --- ADULT GAY MALES (attracted to men — matched with male users) ---
  { gender: "Male", orientation: "gay", age: 25, countryCode: "US", countryName: "United States", name: "Brody", allowAdult: true, opener: "hey handsome", style: "Gay male. Flirty, confident, attracted to men. Very direct about his desires. Gets explicit about gay scenarios." },
  { gender: "Male", orientation: "gay", age: 27, countryCode: "US", countryName: "United States", name: "Adrian", allowAdult: true, opener: "hey there", style: "Gay male. Smooth, charming, and very explicit about what he finds attractive in men. Dominant energy." },
  { gender: "Male", orientation: "gay", age: 24, countryCode: "GB", countryName: "United Kingdom", name: "Kieran", allowAdult: true, opener: "alright gorgeous", style: "Gay male. Cheeky British lad. Flirty and very explicit. Loves complimenting male bodies." },
  { gender: "Male", orientation: "gay", age: 28, countryCode: "FR", countryName: "France", name: "Baptiste", allowAdult: true, opener: "salut beau", style: "Gay male. French elegance. Seductive, slow-burn, gets very explicit. Poetic about attraction to men." },
  { gender: "Male", orientation: "gay", age: 30, countryCode: "DE", countryName: "Germany", name: "Finn", allowAdult: true, opener: "hey", style: "Gay male. Very direct. States exactly what he wants. Dominant, explicit, no filter." },
  { gender: "Male", orientation: "gay", age: 26, countryCode: "BR", countryName: "Brazil", name: "Enzo", allowAdult: true, opener: "oi", style: "Gay male. Brazilian passion for men. Very sensual and explicit. Mixes Portuguese endearments." },
  { gender: "Male", orientation: "gay", age: 23, countryCode: "IT", countryName: "Italy", name: "Fabio", allowAdult: true, opener: "ciao bello", style: "Gay male. Italian lover of men. Charming, very explicit, uses Italian words when excited." },
  { gender: "Male", orientation: "gay", age: 29, countryCode: "ES", countryName: "Spain", name: "Sergio", allowAdult: true, opener: "hola guapo", style: "Gay male. Fiery Spaniard. Very dominant and explicit about his attraction to men." },
  { gender: "Male", orientation: "gay", age: 25, countryCode: "AU", countryName: "Australia", name: "Cam", allowAdult: true, opener: "hey mate", style: "Gay male. Aussie with a filthy mouth. Very physical and explicit. Zero shame." },
  { gender: "Male", orientation: "gay", age: 27, countryCode: "MX", countryName: "Mexico", name: "Hector", allowAdult: true, opener: "hola", style: "Gay male. Passionate, explicit, mixes Spanish. Loves describing physical attraction to men." },

  // --- SFW GAY MALES ---
  { gender: "Male", orientation: "gay", age: 26, countryCode: "US", countryName: "United States", name: "Jordan", opener: "hey", style: "Gay male. Cheerful, supportive, loves pop culture and fashion. Great listener." },
  { gender: "Male", orientation: "gay", age: 24, countryCode: "CA", countryName: "Canada", name: "Spencer", opener: "hi!", style: "Gay male. Sweet, funny, loves brunch and theatre. Very easy to talk to." },
  { gender: "Male", orientation: "gay", age: 28, countryCode: "GB", countryName: "United Kingdom", name: "Elliot", opener: "hiya", style: "Gay male. Witty and sarcastic. Loves drag, queer history, and a good debate." },
  { gender: "Male", orientation: "gay", age: 30, countryCode: "DE", countryName: "Germany", name: "Florian", opener: "hey", style: "Gay male. Very open about being gay. Loves techno, art exhibitions, and deep talks." },
  { gender: "Male", orientation: "gay", age: 25, countryCode: "JP", countryName: "Japan", name: "Sho", opener: "hi", style: "Gay male. Soft-spoken, loves anime and BL manga. Very kind and thoughtful." },

  // --- ADULT LESBIAN FEMALES (attracted to women — matched with female users) ---
  { gender: "Female", orientation: "lesbian", age: 24, countryCode: "US", countryName: "United States", name: "Alex", allowAdult: true, opener: "hey girl", style: "Lesbian. Confident, dominant, very explicit about her attraction to women. Describes desire in vivid detail." },
  { gender: "Female", orientation: "lesbian", age: 27, countryCode: "GB", countryName: "United Kingdom", name: "Sam", allowAdult: true, opener: "alright", style: "Lesbian. Tomboyish but tender. Gets explicit about female desires. Very physical descriptions." },
  { gender: "Female", orientation: "lesbian", age: 26, countryCode: "AU", countryName: "Australia", name: "Bex", allowAdult: true, opener: "hey babe", style: "Lesbian. Zero filter, very direct about what she likes. Explicit and playful." },
  { gender: "Female", orientation: "lesbian", age: 29, countryCode: "FR", countryName: "France", name: "Céline", allowAdult: true, opener: "bonsoir", style: "Lesbian. Sophisticated seductress. Poetic but very explicit. Loves slow tension." },
  { gender: "Female", orientation: "lesbian", age: 23, countryCode: "BR", countryName: "Brazil", name: "Isabela", allowAdult: true, opener: "oi linda", style: "Lesbian. Brazilian fire for women. Passionate, explicit, mixes Portuguese endearments." },
  { gender: "Female", orientation: "lesbian", age: 25, countryCode: "DE", countryName: "Germany", name: "Jana", allowAdult: true, opener: "hey", style: "Lesbian. Very direct about female attraction. Explicit and confident. Dominant energy." },

  // --- SFW LESBIAN FEMALES ---
  { gender: "Female", orientation: "lesbian", age: 26, countryCode: "US", countryName: "United States", name: "Casey", opener: "hey!", style: "Lesbian. Sports-loving, outdoorsy, great energy. Loves hiking and live music." },
  { gender: "Female", orientation: "lesbian", age: 24, countryCode: "CA", countryName: "Canada", name: "Reese", opener: "hi", style: "Lesbian. Artsy, thoughtful, loves indie films and coffee shop vibes." },
  { gender: "Female", orientation: "lesbian", age: 28, countryCode: "SE", countryName: "Sweden", name: "Ebba", opener: "hej", style: "Lesbian. Creative, feminist, loves photography and road trips." },

  // --- ADULT BI MALES (attracted to all — matched with any user) ---
  { gender: "Male", orientation: "bi", age: 25, countryCode: "US", countryName: "United States", name: "Ryder", allowAdult: true, opener: "hey", style: "Bisexual male. Open to all. Very explicit, adapts to whoever he's talking to. No limits." },
  { gender: "Male", orientation: "bi", age: 27, countryCode: "GB", countryName: "United Kingdom", name: "Luca", allowAdult: true, opener: "hey", style: "Bisexual male. Fluid and open. Gets very explicit. Tailors his desires to who he's chatting with." },
  { gender: "Male", orientation: "bi", age: 26, countryCode: "IT", countryName: "Italy", name: "Dante", allowAdult: true, opener: "ciao", style: "Bisexual male. Passionate and explicit. Attracted to beauty in all forms. Very descriptive." },
  { gender: "Male", orientation: "bi", age: 28, countryCode: "BR", countryName: "Brazil", name: "Davi", allowAdult: true, opener: "oi", style: "Bisexual male. Brazilian sensuality for everyone. Very explicit and open-minded." },
  { gender: "Male", orientation: "bi", age: 30, countryCode: "FR", countryName: "France", name: "Julien", allowAdult: true, opener: "salut", style: "Bisexual male. Fluid French lover. Very sensual and explicit regardless of gender." },

  // --- SFW BI MALES ---
  { gender: "Male", orientation: "bi", age: 25, countryCode: "US", countryName: "United States", name: "Drew", opener: "hey", style: "Bisexual male. Laid-back, open-minded, loves music and meeting new people." },
  { gender: "Male", orientation: "bi", age: 27, countryCode: "AU", countryName: "Australia", name: "Riley", opener: "hey mate", style: "Bisexual male. Chill Aussie. Very non-judgmental, loves surfing and deep talks." },

  // --- ADULT BI FEMALES (attracted to all — matched with any user) ---
  { gender: "Female", orientation: "bi", age: 22, countryCode: "US", countryName: "United States", name: "Nova", allowAdult: true, opener: "hey you", style: "Bisexual female. Wild, explicit, and very open. Gets descriptive and sexual with anyone." },
  { gender: "Female", orientation: "bi", age: 26, countryCode: "GB", countryName: "United Kingdom", name: "Amber", allowAdult: true, opener: "hey", style: "Bisexual female. Confident, very explicit. Adapts her fantasy to whoever she's chatting with." },
  { gender: "Female", orientation: "bi", age: 24, countryCode: "DE", countryName: "Germany", name: "Laura", allowAdult: true, opener: "hi", style: "Bisexual female. Open-minded and very explicit. Enjoys all kinds of physical scenarios." },
  { gender: "Female", orientation: "bi", age: 28, countryCode: "MX", countryName: "Mexico", name: "Gabriela", allowAdult: true, opener: "hola", style: "Bisexual female. Latina heat for everyone. Very passionate and explicit with no restrictions." },

  // --- SFW BI FEMALES ---
  { gender: "Female", orientation: "bi", age: 23, countryCode: "CA", countryName: "Canada", name: "Quinn", opener: "hey", style: "Bisexual female. Artsy, very chill, loves music festivals and meeting all kinds of people." },
  { gender: "Female", orientation: "bi", age: 25, countryCode: "NL", countryName: "Netherlands", name: "Lotte", opener: "hey", style: "Bisexual female. Very open and direct. Loves deep conversations with anyone." }
];



function isPersonaCompatible(persona: AITextDemoPersona, userGender: ProfileGender | null): boolean {
  const ori = persona.orientation ?? "straight";
  if (ori === "bi") return true;
  if (!userGender || userGender === "Other") return true;
  if (ori === "straight") return persona.gender !== userGender; // attracted to opposite gender
  if (ori === "gay") return persona.gender === userGender;       // attracted to same gender
  if (ori === "lesbian") return persona.gender === "Female" && userGender === "Female";
  return true;
}

function pickAIDemoPersona(userGender: ProfileGender | null = null): AITextDemoPersona {
  const compatible = AI_TEXT_DEMO_PERSONAS.filter((p) => isPersonaCompatible(p, userGender));
  const pool = compatible.length > 0 ? compatible : AI_TEXT_DEMO_PERSONAS;
  const females = pool.filter((p) => p.gender === "Female");
  const males = pool.filter((p) => p.gender === "Male");
  // Females appear ~1 in 15 times
  const chosen = Math.random() < 1 / 15 ? females : males;
  const source = chosen.length > 0 ? chosen : pool;
  return source[Math.floor(Math.random() * source.length)];
}

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
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [demoFallbackEnabled, setDemoFallbackEnabled] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoRemoteVideoUrl, setDemoRemoteVideoUrl] = useState<string | null>(null);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [isAdmin, setIsAdmin] = useState(false);
  const [, setAdminRoleLoading] = useState(false);

  const [e2eeReadyVersion, setE2eeReadyVersion] = useState(0);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<number | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<"vip" | "vvip" | null>(null);
  const [, setSubscriptionLoading] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
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
  const demoFallbackTimeoutRef = useRef<number | null>(null);
  const demoCycleTimeoutRef = useRef<number | null>(null);
  const demoSearchSessionRef = useRef(0);
  const demoVideoPoolRef = useRef<DemoVideo[]>([]);
  const demoVideoPoolPromiseRef = useRef<Promise<DemoVideo[]> | null>(null);
  const demoLastVideoRef = useRef<string | null>(null);
  const isDemoModeRef = useRef(false);
  const isAITextDemoRef = useRef(false);
  const aiTextDemoAbortRef = useRef<AbortController | null>(null);
  const aiTextDemoHistoryRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const aiTextDemoPersonaRef = useRef<AITextDemoPersona | null>(null);
  const isAITextDemoStreamingRef = useRef(false);
  const aiTextDemoReplyPendingRef = useRef(false);
  const aiTextDemoTypingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserUidRef = useRef<string | null>(null);
  const aiDemoRestoredRef = useRef(false);
  const aiTypingStartMsRef = useRef<number>(0);
  const aiTypingMinDurationMsRef = useRef<number>(0);
  const hasRemoteVideoRef = useRef(false);
  const waitingForNextRef = useRef(false);
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
  const realtimeQueueJoinPayloadRef = useRef<RealtimeQueueJoinPayload | null>(null);
  const realtimeWsDisabledRef = useRef(!REALTIME_WS_ENABLED);
  const realtimeReconnectTimeoutRef = useRef<number | null>(null);
  const realtimeReconnectAttemptRef = useRef(0);
  const [strangerSkipped, setStrangerSkipped] = useState(false);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const lastStrangerActivityAtRef = useRef(0);
  const lastObservedStrangerPresenceRef = useRef<number | null>(null);
  const presenceTimeoutCheckInFlightRef = useRef(false);

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
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const videoOfferSentRef = useRef(false);
  const videoAnswerSentRef = useRef(false);
  const processedCandidateIdsRef = useRef<Set<string>>(new Set());
  const noShowTimeoutRef = useRef<number | null>(null);
  const pendingRemoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingRemoteCandidateSignaturesRef = useRef<Set<string>>(new Set());
  const processedFallbackCandidateSignaturesRef = useRef<Set<string>>(new Set());
  const lastOfferAttemptAtRef = useRef(0);
  const lastAnswerAttemptAtRef = useRef(0);
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

  const randomMs = (minMs: number, maxMs: number): number => {
    if (maxMs <= minMs) {
      return minMs;
    }

    return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  };

  const wait = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  };

  const clearRealtimeReconnectTimeout = () => {
    if (realtimeReconnectTimeoutRef.current) {
      window.clearTimeout(realtimeReconnectTimeoutRef.current);
      realtimeReconnectTimeoutRef.current = null;
    }
  };

  const getIceCandidateSignature = (candidateInit: RTCIceCandidateInit): string => {
    return JSON.stringify({
      candidate: candidateInit.candidate ?? "",
      sdpMid: candidateInit.sdpMid ?? null,
      sdpMLineIndex: candidateInit.sdpMLineIndex ?? null,
      usernameFragment: candidateInit.usernameFragment ?? null,
    });
  };

  const enqueuePendingRemoteCandidate = (candidateInit: RTCIceCandidateInit) => {
    const signature = getIceCandidateSignature(candidateInit);
    if (pendingRemoteCandidateSignaturesRef.current.has(signature)) {
      return;
    }

    pendingRemoteCandidateSignaturesRef.current.add(signature);
    pendingRemoteCandidatesRef.current.push(candidateInit);
  };

  const markNegotiationAttempt = (attemptRef: { current: number }): boolean => {
    const attemptAtMs = Date.now();
    if (attemptAtMs - attemptRef.current < NEGOTIATION_DEBOUNCE_MS) {
      return false;
    }

    attemptRef.current = attemptAtMs;
    return true;
  };

  const bufferRealtimeSignal = (signalEvent: RealtimeSignalEvent) => {
    const cutoff = Date.now() - REALTIME_SIGNAL_BUFFER_TTL_MS;
    const bufferedSignals = realtimeSignalBufferRef.current.filter((buffered) => buffered.receivedAtMs >= cutoff);
    bufferedSignals.push(signalEvent);
    if (bufferedSignals.length > REALTIME_SIGNAL_BUFFER_LIMIT) {
      bufferedSignals.splice(0, bufferedSignals.length - REALTIME_SIGNAL_BUFFER_LIMIT);
    }
    realtimeSignalBufferRef.current = bufferedSignals;
  };

  const getMediaErrorName = (error: unknown): string => {
    if (typeof error === "object" && error !== null && "name" in error && typeof error.name === "string") {
      return error.name;
    }

    return "";
  };

  const isTransientCameraError = (error: unknown): boolean => {
    const name = getMediaErrorName(error);
    return name === "NotReadableError" || name === "AbortError" || name === "TrackStartError";
  };

  const getCameraStartErrorMessage = (error: unknown): string => {
    const name = getMediaErrorName(error);

    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Camera or microphone permission is blocked. Allow access in your browser settings and retry.";
    }

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "No camera or microphone was found on this device.";
    }

    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Camera is busy in another app or browser tab. Close other camera apps/tabs and retry.";
    }

    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "Camera could not be started with current settings. Try switching camera or reloading the page.";
    }

    return "Could not start camera or microphone. Please retry.";
  };

  const pauseRealMatchmakingForDemo = useCallback(() => {
    if (retryMatchIntervalRef.current) {
      window.clearInterval(retryMatchIntervalRef.current);
      retryMatchIntervalRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (waitingUnsubRef.current) {
      waitingUnsubRef.current();
      waitingUnsubRef.current = null;
    }

    if (realtimeQueuePingIntervalRef.current) {
      window.clearInterval(realtimeQueuePingIntervalRef.current);
      realtimeQueuePingIntervalRef.current = null;
    }

    const queuedMode = realtimeQueueModeRef.current;
    realtimeQueueModeRef.current = null;
    realtimeQueueJoinPayloadRef.current = null;

    if (queuedMode && realtimeSocketRef.current?.readyState === WebSocket.OPEN && realtimeConnectedRef.current) {
      realtimeSocketRef.current.send(JSON.stringify({ event: "queue_leave", payload: { mode: queuedMode } }));
    }

  }, [user]);

  const clearDemoTimers = () => {
    if (demoFallbackTimeoutRef.current) {
      window.clearTimeout(demoFallbackTimeoutRef.current);
      demoFallbackTimeoutRef.current = null;
    }

    if (demoCycleTimeoutRef.current) {
      window.clearTimeout(demoCycleTimeoutRef.current);
      demoCycleTimeoutRef.current = null;
    }
  };

  const stopDemoMode = useCallback((clearRemoteVideo = true) => {
    // Abort any in-flight AI text demo stream
    if (isAITextDemoRef.current) {
      aiTextDemoAbortRef.current?.abort();
      aiTextDemoAbortRef.current = null;
      if (aiTextDemoTypingDelayRef.current !== null) {
        clearTimeout(aiTextDemoTypingDelayRef.current);
        aiTextDemoTypingDelayRef.current = null;
      }
      isAITextDemoRef.current = false;
      isAITextDemoStreamingRef.current = false;
      aiTextDemoReplyPendingRef.current = false;
      aiTextDemoHistoryRef.current = [];
      aiTextDemoPersonaRef.current = null;
      // Clear persisted demo session so a refresh doesn't restore this ended chat
      if (currentUserUidRef.current) {
        window.localStorage.removeItem(getAIDemoSessionKey(currentUserUidRef.current));
      }
    }
    demoSearchSessionRef.current += 1;
    clearDemoTimers();
    setIsDemoMode(false);
    setStrangerSkipped(false);
    setWaitingForNext(false);
    setShowNextStrangerPrompt(false);
    setDemoRemoteVideoUrl(null);
    demoLastVideoRef.current = null;

    if (clearRemoteVideo && remoteVideoRef.current) {
      try {
        remoteVideoRef.current.pause();
      } catch {
        // Ignore pause races.
      }
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.removeAttribute("src");
      remoteVideoRef.current.load();
    }
  }, []);

  const getDemoVideoPool = useCallback(async (): Promise<DemoVideo[]> => {
    if (demoVideoPoolRef.current.length > 0) {
      return demoVideoPoolRef.current;
    }

    if (demoVideoPoolPromiseRef.current) {
      return demoVideoPoolPromiseRef.current;
    }

    demoVideoPoolPromiseRef.current = getDocs(collection(db, "demoVideos"))
      .then((snapshot) => {
        const videos: DemoVideo[] = [];
        snapshot.forEach((videoDoc) => {
          const data = videoDoc.data() as {
            url?: string;
            gender?: string;
            age?: number;
            style?: string;
            countryCode?: string;
          };
          if (typeof data.url === "string" && data.url.length > 0) {
            videos.push({
              id: videoDoc.id,
              url: data.url,
              gender: (data.gender === "Male" || data.gender === "Female" || data.gender === "Other") ? data.gender : "Other",
              age: typeof data.age === "number" ? data.age : 22,
              style: data.style === "Intimate" ? "Intimate" : "Casual",
              countryCode: typeof data.countryCode === "string" ? data.countryCode : "",
            });
          }
        });
        demoVideoPoolRef.current = videos;
        return videos;
      })
      .catch(() => [] as DemoVideo[])
      .finally(() => {
        demoVideoPoolPromiseRef.current = null;
      });

    return demoVideoPoolPromiseRef.current;
  }, []);

  const filterDemoVideos = useCallback((videos: DemoVideo[], filters?: ChatFilters | null): DemoVideo[] => {
    if (!filters) {
      return videos;
    }

    return videos.filter((video) => {
      if (filters.gender && filters.gender !== "Any" && video.gender !== filters.gender) {
        return false;
      }

      if (filters.style && filters.style !== "Any style") {
        if (video.style !== filters.style) {
          return false;
        }
      }

      if (filters.ageGroup && filters.ageGroup !== "Any age") {
        if (filters.ageGroup === "Under 18" && video.age >= 18) return false;
        if (filters.ageGroup === "18-25" && (video.age < 18 || video.age > 25)) return false;
        if (filters.ageGroup === "25+" && video.age < 25) return false;
      }

      if (filters.country && filters.country !== "Any" && video.countryCode && video.countryCode !== filters.country) {
        return false;
      }

      return true;
    });
  }, []);

  const pickDemoVideo = useCallback((videos: DemoVideo[]): DemoVideo | null => {
    if (videos.length === 0) {
      return null;
    }

    if (videos.length === 1) {
      demoLastVideoRef.current = videos[0].url;
      return videos[0];
    }

    let candidate = videos[Math.floor(Math.random() * videos.length)];
    let safety = 0;

    while (candidate.url === demoLastVideoRef.current && safety < 6) {
      candidate = videos[Math.floor(Math.random() * videos.length)];
      safety += 1;
    }

    demoLastVideoRef.current = candidate.url;
    return candidate;
  }, []);

  const handleDemoVideoEnded = useCallback(() => {
    if (!isDemoModeRef.current || activeRoomIdRef.current) {
      return;
    }

    if (remoteVideoRef.current) {
      try {
        remoteVideoRef.current.pause();
      } catch {
        // Ignore pause races.
      }

      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.removeAttribute("src");
      remoteVideoRef.current.load();
    }

    setDemoRemoteVideoUrl(null);
    setHasRemoteVideo(false);
    setHasRemoteAudio(false);

    // Match the real stranger-leave flow exactly.
    setIsConnecting(false);
    setStrangerIsTyping(false);
    // Keep the last stranger profile so the message input stays enabled during the gap
    setStrangerSkipped(true);
    setWaitingForNext(true);
    setShowNextStrangerPrompt(true);
    setConnectingStatus(STRANGER_LEFT_PROMPT);
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
          author: "stranger" as const,
          text: STRANGER_LEFT_PROMPT,
          sentAt: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        },
      ];
    });
  }, []);

  const runDemoCycle = useCallback((sessionId: number, videos: DemoVideo[], hasConnectedOnce = false) => {
    if (demoSearchSessionRef.current !== sessionId || activeRoomIdRef.current) {
      return;
    }

    setIsDemoMode(true);
    pauseRealMatchmakingForDemo();

    // Filter videos by current chat filters; fall back to full pool if no matches.
    const filtered = filterDemoVideos(videos, chatFilters);
    const pool = filtered.length > 0 ? filtered : videos;

    const startPlayback = () => {
      if (demoSearchSessionRef.current !== sessionId || activeRoomIdRef.current) {
        return;
      }

      const nextVideo = pickDemoVideo(pool);
      if (!nextVideo) {
        setConnectingStatus("No demo clips available for current filters.");
        return;
      }

      setDemoRemoteVideoUrl(nextVideo.url);
      setHasRemoteVideo(true);
      setHasRemoteAudio(true);
      setIsConnecting(false);
      setConnectingStatus("Connected to demo participant. Waiting for a real match...");
      setStrangerSkipped(false);
      setWaitingForNext(false);
      setShowNextStrangerPrompt(false);

      // Set stranger profile from the video metadata
      setStrangerProfile({
        gender: nextVideo.gender,
        age: nextVideo.age,
        countryCode: nextVideo.countryCode || undefined,
      });
    };

    if (hasConnectedOnce) {
      startPlayback();
      return;
    }

    setIsConnecting(true);
    setConnectingStatus("Checking availability...");
    setHasRemoteVideo(false);
    setHasRemoteAudio(false);
    setDemoRemoteVideoUrl(null);
    setStrangerProfile(generateRandomStrangerProfile(chatFilters ?? undefined));

    demoCycleTimeoutRef.current = window.setTimeout(() => {
      startPlayback();
    }, randomMs(DEMO_CONNECT_MIN_MS, DEMO_CONNECT_MAX_MS));
  }, [chatFilters, filterDemoVideos, pauseRealMatchmakingForDemo, pickDemoVideo]);

  const startDemoModeIfNeeded = useCallback(async (sessionId: number) => {
    if (demoSearchSessionRef.current !== sessionId || activeRoomIdRef.current) {
      return;
    }

    const videos = await getDemoVideoPool();
    if (demoSearchSessionRef.current !== sessionId || activeRoomIdRef.current) {
      return;
    }

    if (videos.length === 0) {
      setConnectingStatus("No users online. Upload demo videos from the admin panel.");
      return;
    }

    runDemoCycle(sessionId, videos);
  }, [getDemoVideoPool, runDemoCycle]);

  const startAITextDemoMode = useCallback((sessionId: number) => {
    if (demoSearchSessionRef.current !== sessionId || activeRoomIdRef.current) {
      return;
    }

    const persona = pickAIDemoPersona(profile?.gender ?? null);
    aiTextDemoPersonaRef.current = persona;
    isAITextDemoRef.current = true;
    aiTextDemoHistoryRef.current = [{ role: "assistant", content: persona.opener }];

    setIsDemoMode(true);
    pauseRealMatchmakingForDemo();
    setStrangerProfile({ gender: persona.gender, age: persona.age, countryCode: persona.countryCode });
    setIsConnecting(false);
    setConnectingStatus("Connected");
    setStrangerSkipped(false);
    setWaitingForNext(false);
    setShowNextStrangerPrompt(false);
    setMessages([]);

    // Show typing indicator for 1–3 s before the opener appears
    setStrangerIsTyping(true);
    const openerDelayMs = 1000 + Math.floor(Math.random() * 2000);
    window.setTimeout(() => {
      if (!isAITextDemoRef.current) return; // user skipped before opener arrived
      setStrangerIsTyping(false);
      const now = new Date();
      const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setMessages([{
        id: `ai-demo-opener-${Date.now()}`,
        author: "stranger",
        text: persona.opener,
        sentAt: ts,
        createdAtMs: Date.now(),
      }]);
    }, openerDelayMs);
  }, [pauseRealMatchmakingForDemo]);

  const updateRoomParticipants = (nextParticipants: string[]) => {
    const normalized = Array.from(new Set(nextParticipants));
    setRoomParticipants((current) => {
      if (current.length === normalized.length && current.every((uid, index) => uid === normalized[index])) {
        return current;
      }
      return normalized;
    });
  };

  const cleanupVideoSession = (preserveLocalStream = false) => {
    realtimeSignalHandlerRef.current = null;
    videoRoomUnsubRef.current?.();
    videoRoomUnsubRef.current = null;
    videoCandidatesUnsubRef.current?.();
    videoCandidatesUnsubRef.current = null;
    processedCandidateIdsRef.current.clear();
    pendingRemoteCandidatesRef.current = [];
    pendingRemoteCandidateSignaturesRef.current.clear();
    processedFallbackCandidateSignaturesRef.current.clear();
    videoOfferSentRef.current = false;
    videoAnswerSentRef.current = false;
    lastOfferAttemptAtRef.current = 0;
    lastAnswerAttemptAtRef.current = 0;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    videoSenderRef.current = null;
    audioSenderRef.current = null;

    if (!preserveLocalStream) {
      if (localMediaStreamRef.current) {
        localMediaStreamRef.current.getTracks().forEach((track) => track.stop());
        localMediaStreamRef.current = null;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      setLocalVideoEnabled(true);
      setLocalAudioEnabled(true);
      setCameraFacingMode("user");
    }

    if (remoteMediaStreamRef.current) {
      remoteMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteMediaStreamRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setHasRemoteVideo(false);
    setHasRemoteAudio(false);
    setVideoError(null);
  };

  useEffect(() => {
    isDemoModeRef.current = isDemoMode;
  }, [isDemoMode]);

  useEffect(() => {
    hasRemoteVideoRef.current = hasRemoteVideo;
  }, [hasRemoteVideo]);

  useEffect(() => {
    waitingForNextRef.current = waitingForNext;
  }, [waitingForNext]);

  // After a page refresh restores an AI demo session, trigger a bot reply with a 1–10 s delay
  useEffect(() => {
    if (!isDemoMode || !isAITextDemoRef.current || !aiDemoRestoredRef.current) return;
    aiDemoRestoredRef.current = false;
    const delayMs = 1000 + Math.floor(Math.random() * 9000);
    aiTextDemoTypingDelayRef.current = setTimeout(() => {
      aiTextDemoTypingDelayRef.current = null;
      if (!isAITextDemoRef.current) return;
      aiTypingStartMsRef.current = Date.now();
      aiTypingMinDurationMsRef.current = 3000 + Math.floor(Math.random() * 7000);
      setStrangerIsTyping(true);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      void streamAITextDemoReply();
    }, delayMs);
  // streamAITextDemoReply uses only refs so it's safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]);

  useEffect(() => {
    currentUserUidRef.current = user?.uid ?? null;
  }, [user]);

  // Persist AI demo session to localStorage whenever messages change during a demo
  useEffect(() => {
    if (!user || !isDemoMode || !isAITextDemoRef.current) return;
    const persona = aiTextDemoPersonaRef.current;
    const history = aiTextDemoHistoryRef.current;
    if (!persona || messages.length === 0) return;
    const payload: PersistedAIDemoSession = { persona, history, messages };
    window.localStorage.setItem(getAIDemoSessionKey(user.uid), JSON.stringify(payload));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isDemoMode, user]);

  useEffect(() => {
    const remoteVideoElement = remoteVideoRef.current;
    if (!remoteVideoElement) {
      return;
    }

    if (!demoRemoteVideoUrl) {
      return;
    }

    const onDemoEnded = () => {
      handleDemoVideoEnded();
    };

    remoteVideoElement.srcObject = null;
    remoteVideoElement.src = demoRemoteVideoUrl;
    remoteVideoElement.loop = false;
    remoteVideoElement.autoplay = true;
    remoteVideoElement.playsInline = true;
    remoteVideoElement.muted = false;
    remoteVideoElement.addEventListener("ended", onDemoEnded);
    void remoteVideoElement.play().catch(() => {
      // Ignore autoplay restrictions.
    });

    return () => {
      remoteVideoElement.removeEventListener("ended", onDemoEnded);
    };
  }, [demoRemoteVideoUrl, handleDemoVideoEnded]);

  const publishLocalMediaState = useCallback((nextAudioEnabled: boolean, nextVideoEnabled: boolean) => {
    if (!user || !activeRoomId) {
      return;
    }

    void updateDoc(doc(db, "rooms", activeRoomId), {
      [`mediaStateBy.${user.uid}`]: {
        audioEnabled: nextAudioEnabled,
        videoEnabled: nextVideoEnabled,
        updatedAtMs: Date.now(),
      },
      mediaStateUpdatedAt: serverTimestamp(),
    }).catch(() => {
      // Ignore transient media-state publish failures.
    });
  }, [activeRoomId, user]);

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

    const videoSender = videoSenderRef.current;
    if (videoSender) {
      const nextTrack = shouldEnable ? videoTracks[0] : null;
      void videoSender.replaceTrack(nextTrack).catch(() => {
        // Ignore transient sender replacement races.
      });
    }

    setLocalVideoEnabled(shouldEnable);
    publishLocalMediaState(localAudioEnabled, shouldEnable);
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

    const audioSender = audioSenderRef.current;
    if (audioSender) {
      const nextTrack = shouldEnable ? audioTracks[0] : null;
      void audioSender.replaceTrack(nextTrack).catch(() => {
        // Ignore transient sender replacement races.
      });
    }

    setLocalAudioEnabled(shouldEnable);
    publishLocalMediaState(shouldEnable, localVideoEnabled);
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

      const videoSender = videoSenderRef.current;
      if (videoSender) {
        await videoSender.replaceTrack(localVideoEnabled ? newVideoTrack : null);
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
    pendingRemoteCandidateSignaturesRef.current.clear();

    for (const candidateInit of pending) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch {
        enqueuePendingRemoteCandidate(candidateInit);
      }
    }
  };

  const sendRealtimeEvent = useCallback((event: string, payload?: unknown): boolean => {
    const socket = realtimeSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !realtimeConnectedRef.current) {
      return false;
    }

    try {
      socket.send(JSON.stringify({ event, payload }));
      return true;
    } catch {
      realtimeConnectedRef.current = false;
      return false;
    }
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

  const getPreferredLocalMediaStream = async (
    facingMode: "user" | "environment",
  ): Promise<MediaStream> => {
    const fallbackFacingMode: "user" | "environment" = facingMode === "user" ? "environment" : "user";
    const attempts: Array<() => Promise<MediaStream>> = [
      () => navigator.mediaDevices.getUserMedia({
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
      }),
      () => navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: true,
      }),
      () => navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: fallbackFacingMode } },
        audio: true,
      }),
      () => navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      }),
      () => navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      }),
    ];

    let lastError: unknown = null;

    for (const createStream of attempts) {
      try {
        return await createStream();
      } catch (error) {
        lastError = error;
        if (isTransientCameraError(error)) {
          await wait(250);
        }
      }
    }

    throw lastError ?? new Error("Camera startup failed");
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
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), async (snapshot) => {
      const data = snapshot.data() as { isBlocked?: boolean } | undefined;
      if (!data?.isBlocked) {
        return;
      }

      setAuthNotice("This account has been blocked. Contact support.");
      await signOut(auth).catch(() => {
        // Ignore sign-out failures while enforcing blocked accounts.
      });
    });

    return () => unsubscribe();
  }, [user]);

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
      clearRealtimeReconnectTimeout();
      clearDemoTimers();
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
      clearRealtimeReconnectTimeout();
      realtimeReconnectAttemptRef.current = 0;
      realtimeConnectedRef.current = false;
      realtimeQueueModeRef.current = null;
      realtimeQueueJoinPayloadRef.current = null;
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

    if (realtimeWsDisabledRef.current) {
      realtimeConnectedRef.current = false;
      realtimeQueueModeRef.current = null;
      stopRealtimeQueueHeartbeat();
      return;
    }

    let disposed = false;

    const scheduleReconnect = (reason: string) => {
      if (disposed || realtimeWsDisabledRef.current || realtimeReconnectTimeoutRef.current) {
        return;
      }

      realtimeConnectedRef.current = false;
      stopRealtimeQueueHeartbeat();

      const attempt = realtimeReconnectAttemptRef.current + 1;
      realtimeReconnectAttemptRef.current = attempt;
      const delayMs = Math.min(REALTIME_WS_RECONNECT_BASE_MS * (2 ** (attempt - 1)), REALTIME_WS_RECONNECT_MAX_MS);

      if (realtimeQueueModeRef.current && !activeRoomIdRef.current && !isDemoModeRef.current) {
        setConnectingStatus("Realtime connection lost. Reconnecting...");
      }

      console.warn("[realtime] websocket disconnected; retrying", {
        reason,
        url: REALTIME_WS_URL,
        attempt,
        delayMs,
      });

      realtimeReconnectTimeoutRef.current = window.setTimeout(() => {
        realtimeReconnectTimeoutRef.current = null;
        if (disposed || realtimeWsDisabledRef.current) {
          return;
        }
        connectSocket();
      }, delayMs);
    };

    const restoreRealtimeQueue = () => {
      const queuePayload = realtimeQueueJoinPayloadRef.current;
      if (!queuePayload || activeRoomIdRef.current) {
        return;
      }

      const rejoined = sendRealtimeEvent("queue_join", queuePayload);
      if (!rejoined) {
        return;
      }

      realtimeQueueModeRef.current = queuePayload.mode;
      startRealtimeQueueHeartbeat();
      if (!isDemoModeRef.current) {
        setConnectingStatus("Looking for an available stranger...");
      }
    };

    const handleRealtimeMessage = (event: MessageEvent) => {
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
        realtimeReconnectAttemptRef.current = 0;
        clearRealtimeReconnectTimeout();
        restoreRealtimeQueue();
        return;
      }

      if (eventName === "error") {
        const errorCode = typeof payload?.code === "string" ? payload.code : null;
        if (errorCode === "auth-failed" || errorCode === "unauthenticated") {
          scheduleReconnect(errorCode);
        }
        return;
      }

      if (eventName === "match_found") {
        const roomId = typeof payload?.roomId === "string" ? payload.roomId : null;
        const peerUid = typeof payload?.peerUid === "string" ? payload.peerUid : null;
        const isOfferer = Boolean(payload?.isOfferer);
        const mode = payload?.mode as ChatMode | undefined;
        const participantProfiles = Array.isArray(payload?.participantProfiles)
          ? payload?.participantProfiles as Array<{ uid: string; gender: ProfileGender; age: number; countryCode?: string; nickname?: string; interests?: string[] }>
          : [];
        const participants = Array.isArray(payload?.participants)
          ? payload?.participants as string[]
          : peerUid
            ? [user.uid, peerUid]
            : [user.uid];

        if (!roomId || !peerUid || !mode || activeRoomIdRef.current) {
          return;
        }

        // A real match always supersedes demo mode — stop it immediately so
        // isDemoModeRef is cleared before any subsequent guard checks.
        if (isDemoModeRef.current) {
          stopDemoMode();
        }

        realtimeRoomIdRef.current = roomId;
        realtimePeerUidRef.current = peerUid;
        realtimeIsOffererRef.current = isOfferer;
        realtimeQueueModeRef.current = null;
        realtimeQueueJoinPayloadRef.current = null;
        stopRealtimeQueueHeartbeat();

        const roomRef = doc(db, "rooms", roomId);
        const participantProfilesBy = Object.fromEntries(participantProfiles.map((p) => [p.uid, p]));
        void setDoc(roomRef, {
          status: "active",
          mode,
          participants,
          participantProfiles,
          participantProfilesBy,
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
            interests: stranger.interests,
          });
        }

        cleanupWaitIntervals();
        stopDemoMode();
        setConnectingStatus("Stranger found. Preparing secure connection...");
        activeRoomIdRef.current = roomId;
        setActiveRoomId(roomId);
        return;
      }

      if (eventName === "queue_waiting") {
        if (!isDemoModeRef.current) {
          setConnectingStatus("Connecting...");
        }
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
          receivedAtMs: Date.now(),
        };

        const signalHandler = realtimeSignalHandlerRef.current;
        if (signalHandler && activeRoomIdRef.current === roomId) {
          signalHandler(signalEvent);
          return;
        }

        bufferRealtimeSignal(signalEvent);
        return;
      }

      if (eventName === "peer_left") {
        const roomId = typeof payload?.roomId === "string" ? payload.roomId : null;
        if (!roomId || activeRoomIdRef.current !== roomId) return;
        if (disconnectHandledRoomRef.current === roomId) return;
        disconnectHandledRoomRef.current = roomId;

        setShowNextStrangerPrompt(true);
        setConnectingStatus(STRANGER_LEFT_PROMPT);
        setIsConnecting(false);
        setStrangerIsTyping(false);
        setMessages((current) => {
          const alreadyNotified = current.some((m) => m.text === STRANGER_LEFT_PROMPT);
          if (alreadyNotified) return current;
          const now = new Date();
          return [
            ...current,
            {
              id: `system-${Date.now()}`,
              author: "stranger" as const,
              text: STRANGER_LEFT_PROMPT,
              sentAt: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
            },
          ];
        });
        setActiveRoomId(null);
        void deleteAllRoomData(roomId, [user.uid]);
        return;
      }
    };

    const connectSocket = () => {
      if (disposed || realtimeWsDisabledRef.current) {
        return;
      }

      clearRealtimeReconnectTimeout();
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
          try {
            socket.close();
          } catch {
            // Ignore close races.
          }
          scheduleReconnect("token_fetch_failed");
        });
      };

      socket.onmessage = handleRealtimeMessage;

      socket.onerror = () => {
        if (realtimeSocketRef.current === socket) {
          realtimeSocketRef.current = null;
        }
        scheduleReconnect("socket_error");
      };

      socket.onclose = () => {
        if (realtimeSocketRef.current === socket) {
          realtimeSocketRef.current = null;
        }
        scheduleReconnect("socket_closed");
      };
    };

    connectSocket();

    return () => {
      disposed = true;
      clearRealtimeReconnectTimeout();
      realtimeConnectedRef.current = false;
      stopRealtimeQueueHeartbeat();
      if (realtimeSocketRef.current) {
        try {
          realtimeSocketRef.current.close();
        } catch {
          // Ignore close races.
        }
        realtimeSocketRef.current = null;
      }
    };
  // The socket lifecycle intentionally keys off auth and queue controls, not every callback captured by message handlers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendRealtimeEvent, startRealtimeQueueHeartbeat, stopDemoMode, stopRealtimeQueueHeartbeat, user]);

  useEffect(() => {
    if (activeRoomId) {
      stopDemoMode();
      return;
    }

    clearPendingSendRetry();
    updateRoomParticipants([]);
    // Keep local camera alive when staying in video mode so the user's
    // panel doesn't flash black between stranger connections.
    cleanupVideoSession(chatMode === "video");
    setStrangerProfile(PENDING_STRANGER_PROFILE);

    clearE2EECaches();
  }, [activeRoomId, chatMode, stopDemoMode]);

  useEffect(() => {
    const configRef = doc(db, "appConfig", "matchmaking");
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (!snapshot.exists()) {
        setDemoFallbackEnabled(true);
        return;
      }

      const data = snapshot.data() as { demoFallbackEnabled?: unknown };
      setDemoFallbackEnabled(typeof data.demoFallbackEnabled === "boolean" ? data.demoFallbackEnabled : true);
    });

    return () => unsubscribe();
  }, []);

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

        const localVideoTrackEnabled = localStream.getVideoTracks().some((track) => track.enabled);
        const localAudioTrackEnabled = localStream.getAudioTracks().some((track) => track.enabled);
        publishLocalMediaState(localAudioTrackEnabled, localVideoTrackEnabled);
        const currentFacingMode = localStream.getVideoTracks()[0]?.getSettings().facingMode;
        if (currentFacingMode === "environment" || currentFacingMode === "user") {
          setCameraFacingMode(currentFacingMode);
        }
        setVideoError(null);
      } catch (error) {
        setVideoError(getCameraStartErrorMessage(error));
      }
    };
    void startPreview();
    return () => { cancelled = true; };
  // Preview startup is intentionally gated by UI state; expanding deps here causes unnecessary camera churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMode, chatFilters, isConnecting, activeRoomId, cameraFacingMode]);

  useEffect(() => {
    if (chatMode !== "video" || !activeRoomId || !user) {
      // Only destroy local stream when actually leaving video mode or unmounting.
      cleanupVideoSession(chatMode === "video");
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
            {
              urls: `turn:${TURN_HOST}:80`,
              username: TURN_USERNAME,
              credential: TURN_CREDENTIAL,
            },
            {
              urls: `turn:${TURN_HOST}:443`,
              username: TURN_USERNAME,
              credential: TURN_CREDENTIAL,
            },
            {
              urls: `turns:${TURN_HOST}:443?transport=tcp`,
              username: TURN_USERNAME,
              credential: TURN_CREDENTIAL,
            },
          ],
          iceCandidatePoolSize: 10,
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        });
        peerConnectionRef.current = peerConnection;

        const remoteStream = new MediaStream();
        remoteMediaStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }

        localStream.getTracks().forEach((track) => {
          const sender = peerConnection.addTrack(track, localStream);
          if (track.kind === "video") {
            videoSenderRef.current = sender;
          }
          if (track.kind === "audio") {
            audioSenderRef.current = sender;
          }
        });

        peerConnection.ontrack = (event) => {
          const stream = event.streams[0];
          if (!stream) {
            return;
          }

          const track = event.track;
          if (track.kind === "video") {
            setHasRemoteVideo(!track.muted && track.readyState === "live");
            track.onmute = () => setHasRemoteVideo(false);
            track.onunmute = () => setHasRemoteVideo(true);
            track.onended = () => setHasRemoteVideo(false);
          }

          if (track.kind === "audio") {
            setHasRemoteAudio(!track.muted && track.readyState === "live");
            track.onmute = () => setHasRemoteAudio(false);
            track.onunmute = () => setHasRemoteAudio(true);
            track.onended = () => setHasRemoteAudio(false);
          }

          stream.getTracks().forEach((track) => {
            const exists = remoteStream.getTracks().some((existingTrack) => existingTrack.id === track.id);
            if (!exists) {
              remoteStream.addTrack(track);
            }
          });

          setHasRemoteVideo(remoteStream.getVideoTracks().length > 0);
          setHasRemoteAudio(remoteStream.getAudioTracks().length > 0);
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

        const handlePeerLeftImmediately = () => {
          if (disconnectHandledRoomRef.current === activeRoomId) {
            return;
          }

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
                author: "stranger" as const,
                text: STRANGER_LEFT_PROMPT,
                sentAt: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
              },
            ];
          });
          setActiveRoomId(null);

          void deleteAllRoomData(activeRoomId, [user.uid, otherUid]);

          void updateDoc(roomRef, {
            status: "ended",
            endedBy: user.uid,
            endedAt: serverTimestamp(),
            endedReason: "peer-connection-lost",
          }).catch(() => {
            // Ignore disconnect end race conditions.
          });
        };

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === "connected") {
            setVideoError(null);
            return;
          }

          if (peerConnection.connectionState === "disconnected") {
            setVideoError("Stranger disconnected.");
            handlePeerLeftImmediately();
            return;
          }

          if (peerConnection.connectionState === "failed") {
            setVideoError("Stranger disconnected.");
            handlePeerLeftImmediately();
            return;
          }

          if (peerConnection.connectionState === "closed") {
            setVideoError("Stranger disconnected.");
            handlePeerLeftImmediately();
          }
        };

        peerConnection.oniceconnectionstatechange = () => {
          if (peerConnection.iceConnectionState === "connected" || peerConnection.iceConnectionState === "completed") {
            return;
          }

          if (peerConnection.iceConnectionState === "disconnected") {
            handlePeerLeftImmediately();
            return;
          }

          if (peerConnection.iceConnectionState === "failed" || peerConnection.iceConnectionState === "closed") {
            handlePeerLeftImmediately();
          }
        };

        const handleRealtimeSignal = (signalEvent: RealtimeSignalEvent) => {
          if (signalEvent.roomId !== activeRoomId || signalEvent.fromUid !== otherUid) {
            return;
          }

          if (signalEvent.kind === "ice") {
            const candidateInit = signalEvent.payload as RTCIceCandidateInit;
            if (!peerConnection.remoteDescription) {
              enqueuePendingRemoteCandidate(candidateInit);
              return;
            }

            void peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(() => {
              enqueuePendingRemoteCandidate(candidateInit);
            });
            return;
          }

          if (signalEvent.kind === "offer" && !isOfferer && !peerConnection.currentRemoteDescription && !videoAnswerSentRef.current) {
            const remoteOffer = signalEvent.payload as RTCSessionDescriptionInit;
            void (async () => {
              try {
                if (!markNegotiationAttempt(lastAnswerAttemptAtRef)) {
                  return;
                }

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
                  enqueuePendingRemoteCandidate(data.candidate);
                  return;
                }

                void peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {
                  // Queue again and retry after next remote description update.
                  enqueuePendingRemoteCandidate(data.candidate as RTCIceCandidateInit);
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
                enqueuePendingRemoteCandidate(candidateInit);
                return;
              }

              void peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(() => {
                enqueuePendingRemoteCandidate(candidateInit);
              });
            });

            if (!isOfferer && remoteOffer && !peerConnection.currentRemoteDescription && !videoAnswerSentRef.current) {
              void (async () => {
                try {
                  if (!markNegotiationAttempt(lastAnswerAttemptAtRef)) {
                    return;
                  }

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
          if (!markNegotiationAttempt(lastOfferAttemptAtRef)) {
            return;
          }

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
      // Preserve the local camera when staying in video mode so the user's
      // panel doesn't go black between stranger connections.
      cleanupVideoSession(chatMode === "video");
    };
  // WebRTC setup intentionally avoids rebinding on every helper callback identity change while a room is active.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, chatMode, publishLocalMediaState, roomParticipants, user]);

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

        const recentMessagesSnapshot = await getDocs(
          query(
            collection(db, "rooms", roomId, "messages"),
            orderBy("createdAt", "desc"),
            limit(6),
          ),
        );
        const hasRecentRoomMessage = recentMessagesSnapshot.docs.some((messageDoc) => {
          const data = messageDoc.data() as { senderId?: string };
          return typeof data.senderId === "string" && data.senderId.length > 0;
        });

        if (hasRecentRoomMessage) {
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
  // This timeout should restart only when room/user/filter state changes, not when helper identities are recreated.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, chatFilters, user]);

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
        const modeValid = parsed.chatMode === "text" || parsed.chatMode === "video";
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
    if (savedMode === "text" || savedMode === "video") {
      setChatMode(savedMode);
      setChatFilters(null);
    }

    // Restore a previously active AI demo session (survives page refresh)
    const aiDemoRaw = window.localStorage.getItem(getAIDemoSessionKey(user.uid));
    if (aiDemoRaw) {
      try {
        const aiDemo = JSON.parse(aiDemoRaw) as Partial<PersistedAIDemoSession>;
        if (
          aiDemo.persona &&
          Array.isArray(aiDemo.history) &&
          Array.isArray(aiDemo.messages) &&
          aiDemo.messages.length > 0
        ) {
          aiTextDemoPersonaRef.current = aiDemo.persona;
          aiTextDemoHistoryRef.current = aiDemo.history;
          isAITextDemoRef.current = true;
          aiDemoRestoredRef.current = true;
          setChatMode("text");
          setIsDemoMode(true);
          setStrangerProfile({ gender: aiDemo.persona.gender, age: aiDemo.persona.age, countryCode: aiDemo.persona.countryCode });
          setIsConnecting(false);
          setConnectingStatus("Connected");
          setStrangerSkipped(false);
          setWaitingForNext(false);
          setShowNextStrangerPrompt(false);
          setMessages(aiDemo.messages);
          setSessionRestoreComplete(true);
          return;
        }
      } catch {
        window.localStorage.removeItem(getAIDemoSessionKey(user.uid));
      }
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
    realtimeQueueJoinPayloadRef.current = null;
    stopRealtimeQueueHeartbeat();

    cleanupWaitIntervals();
  }, [activeRoomId, sendRealtimeEvent, stopRealtimeQueueHeartbeat, user]);

  useEffect(() => {
    if (!activeRoomId || !user) {
      roomUnsubRef.current?.();
      roomUnsubRef.current = null;
      updateRoomParticipants([]);
      setStrangerIsTyping(false);
      lastStrangerActivityAtRef.current = 0;
      lastObservedStrangerPresenceRef.current = null;
      presenceTimeoutCheckInFlightRef.current = false;
      selfTypingRef.current = false;
      return;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    disconnectHandledRoomRef.current = null;
  lastObservedStrangerPresenceRef.current = null;
  presenceTimeoutCheckInFlightRef.current = false;

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
          participantProfiles?: Array<{ uid: string; gender: ProfileGender; age: number; countryCode?: string; nickname?: string; interests?: string[] }>;
          participantProfilesBy?: Record<string, { uid: string; gender: ProfileGender; age: number; countryCode?: string; nickname?: string; interests?: string[] }>;
          mediaStateBy?: Record<string, { audioEnabled?: boolean; videoEnabled?: boolean; updatedAtMs?: number }>;
          typingBy?: Record<string, boolean>;
          presenceBy?: Record<string, number>;
          e2eePublicKeys?: Record<string, JsonWebKey>;
          status?: string;
          endedBy?: string;
          mode?: string;
        };

        // E2EE negotiation
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

        updateRoomParticipants(Array.isArray(roomData.participants) ? roomData.participants : []);

        const strangerUid = roomData.participants?.find((participantUid) => participantUid !== user.uid);
        const stranger = strangerUid
          ? (roomData.participantProfilesBy?.[strangerUid] ?? roomData.participantProfiles?.find((p) => p.uid !== user.uid))
          : undefined;
        if (stranger) {
          setStrangerProfile({
            gender: stranger.gender,
            age: stranger.age,
            countryCode: stranger.countryCode,
            interests: stranger.interests,
          });
        }
        const strangerMediaState = strangerUid ? roomData.mediaStateBy?.[strangerUid] : undefined;
        if (strangerMediaState) {
          if (typeof strangerMediaState.audioEnabled === "boolean") {
            setHasRemoteAudio(strangerMediaState.audioEnabled);
          }
          if (typeof strangerMediaState.videoEnabled === "boolean") {
            setHasRemoteVideo(strangerMediaState.videoEnabled);
          }
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

        // Presence timeout
        {
          const roomMode = roomData.mode === "video" ? "video" : "text";
          if (roomMode !== "video") {
            return;
          }

          const otherUid = roomData.participants?.find((uid) => uid !== user.uid);
          const otherPresenceMs = otherUid ? roomData.presenceBy?.[otherUid] : undefined;
          if (typeof otherPresenceMs === "number") {
            if (lastObservedStrangerPresenceRef.current !== otherPresenceMs) {
              lastObservedStrangerPresenceRef.current = otherPresenceMs;
              // Use local time whenever a new heartbeat value is observed to avoid client clock skew issues.
              lastStrangerActivityAtRef.current = Date.now();
            }
          }

          const lastKnownActivityMs = lastStrangerActivityAtRef.current;
          const otherTimedOut =
            lastKnownActivityMs > 0 && Date.now() - lastKnownActivityMs > ROOM_PRESENCE_TIMEOUT_MS + ROOM_ACTIVITY_GRACE_MS;

          if (
            otherUid &&
            otherTimedOut &&
            roomData.status !== "ended" &&
            disconnectHandledRoomRef.current !== activeRoomId
          ) {
            if (presenceTimeoutCheckInFlightRef.current) {
              return;
            }

            const roomId = activeRoomId;
            presenceTimeoutCheckInFlightRef.current = true;

            void (async () => {
              try {
                const recentMessagesSnapshot = await getDocs(
                  query(
                    collection(db, "rooms", roomId, "messages"),
                    orderBy("createdAt", "desc"),
                    limit(8),
                  ),
                );

                const recentActivityThresholdMs = Date.now() - (ROOM_PRESENCE_TIMEOUT_MS + ROOM_ACTIVITY_GRACE_MS);
                const hasRecentStrangerMessage = recentMessagesSnapshot.docs.some((messageDoc) => {
                  const data = messageDoc.data() as {
                    senderId?: string;
                    createdAt?: { toDate?: () => Date };
                  };
                  if (!data.senderId || data.senderId === user.uid) {
                    return false;
                  }

                  const createdAtMs = data.createdAt?.toDate?.().getTime() ?? 0;
                  return createdAtMs >= recentActivityThresholdMs;
                });

                if (hasRecentStrangerMessage) {
                  lastStrangerActivityAtRef.current = Date.now();
                  return;
                }

                if (disconnectHandledRoomRef.current === roomId || activeRoomIdRef.current !== roomId) {
                  return;
                }

                disconnectHandledRoomRef.current = roomId;
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

                void deleteAllRoomData(roomId, roomData.participants ?? [user.uid]);

                void updateDoc(roomRef, {
                  status: "ended",
                  endedBy: user.uid,
                  endedAt: serverTimestamp(),
                  endedReason: "presence-timeout",
                }).catch(() => {
                  // Ignore timeout end race conditions.
                });
              } finally {
                presenceTimeoutCheckInFlightRef.current = false;
              }
            })();
            return;
          }
        }

        const isOtherUserTyping = Object.entries(roomData.typingBy ?? {}).some(
          ([uid, typing]) => uid !== user.uid && Boolean(typing),
        );
        if (isOtherUserTyping) {
          lastStrangerActivityAtRef.current = Date.now();
        }
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
  // Room subscriptions intentionally stay bound to room/auth state while helper callbacks remain implementation details.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    decryptedText = data.text ?? "Encrypted message";
                  }
                } else {
                  decryptedText = data.text ?? "Decrypting secure message...";
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
                author: data.senderId === user.uid ? "you" as const : "stranger" as const,
                senderId: data.senderId,
                senderNickname: data.senderNickname,
                senderColor: undefined,
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

          const latestStrangerMessageAt = nextMessages.reduce((latest, message) => {
            if (message.author !== "stranger" || typeof message.createdAtMs !== "number") {
              return latest;
            }
            return Math.max(latest, message.createdAtMs);
          }, 0);
          if (latestStrangerMessageAt > 0) {
            lastStrangerActivityAtRef.current = Math.max(lastStrangerActivityAtRef.current, latestStrangerMessageAt);
          }

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

  const upsertOwnRoomProfile = useCallback(async (roomId: string) => {
    if (!user || !profile) {
      return;
    }

    const ownProfile = {
      uid: user.uid,
      gender: profile.gender,
      age: profile.age,
      countryCode: profile.countryCode ?? null,
      interests: myInterests,
    };

    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        [`participantProfilesBy.${user.uid}`]: ownProfile,
      });
    } catch {
      // Ignore profile upsert races while room is being initialized.
    }
  }, [myInterests, profile, user]);

  useEffect(() => {
    if (!activeRoomId || !user || !profile) {
      return;
    }

    void upsertOwnRoomProfile(activeRoomId);
  }, [activeRoomId, profile, upsertOwnRoomProfile, user]);

  const markRoomEnded = async () => {
    if (!activeRoomId || !user) {
      return;
    }

    setShowNextStrangerPrompt(false);
    void setTypingStatus(false);

    const roomIdToEnd = activeRoomId;
    const peerUid = realtimePeerUidRef.current;
    setActiveRoomId(null);
    setMessages([]);

    // Notify the stranger instantly over WebSocket — zero Firestore round-trip.
    if (peerUid) {
      sendRealtimeEvent("peer_left", { roomId: roomIdToEnd, toUid: peerUid });
    }

    // Also write to Firestore so the stranger is notified even if WS is down.
    try {
      await updateDoc(doc(db, "rooms", roomIdToEnd), {
        status: "ended",
        endedBy: user.uid,
        endedAt: serverTimestamp(),
      });
    } catch {
      // Ignore room end race conditions.
    }

    // Cleanup participant subcollections in the background.
    void (async () => {
      let participantUids: string[] = [user.uid];
      try {
        const roomSnapshot = await getDoc(doc(db, "rooms", roomIdToEnd));
        if (roomSnapshot.exists()) {
          const roomData = roomSnapshot.data() as { participants?: string[] };
          if (Array.isArray(roomData.participants) && roomData.participants.length > 0) {
            participantUids = roomData.participants;
          }
        }
      } catch {
        // Fall back to current user only.
      }
      await deleteAllRoomData(roomIdToEnd, participantUids);
    })();
  };

  const startSearching = async (
    filters: ChatFilters,
    modeOverride?: ChatMode,
    nickname?: string,
    interests?: string[],
    adminProfileOverride?: { gender: ProfileGender; age: number; countryCode: string | null },
  ) => {
    const effectiveMode = modeOverride ?? chatMode;
    if (!user || !profile || !effectiveMode) {
      return;
    }

    const effectiveProfile: UserProfile = adminProfileOverride
      ? {
          ...profile,
          gender: adminProfileOverride.gender,
          age: adminProfileOverride.age,
          countryCode: adminProfileOverride.countryCode ?? undefined,
        }
      : profile;

    stopDemoMode();
    cleanupWaitIntervals();
    demoSearchSessionRef.current += 1;
    const searchSessionId = demoSearchSessionRef.current;
    setIsConnecting(true);
    setConnectingStatus("Checking availability...");
    setShowNextStrangerPrompt(false);
    setStrangerProfile(PENDING_STRANGER_PROFILE);
    setMessages([]);
    setText("");
    clearAttachment();
    setActiveRoomId(null);

    realtimeRoomIdRef.current = null;
    realtimePeerUidRef.current = null;
    realtimeIsOffererRef.current = false;

    if (realtimeQueueModeRef.current) {
      void sendRealtimeEvent("queue_leave", { mode: realtimeQueueModeRef.current });
      realtimeQueueModeRef.current = null;
    }

    const queueJoinPayload: RealtimeQueueJoinPayload = {
      mode: effectiveMode,
      filters,
      profile: {
        gender: effectiveProfile.gender,
        age: effectiveProfile.age,
        countryCode: filters.hideCountry ? null : (effectiveProfile.countryCode ?? null),
        subscriptionTier: filters.hideSubscriptionStatus ? null : (isAdmin ? "vvip" : subscriptionTier),
        interests: interests ?? myInterests,
      },
    };

    realtimeQueueJoinPayloadRef.current = queueJoinPayload;

    const wsQueued = sendRealtimeEvent("queue_join", queueJoinPayload);

    // Always keep the connecting state visible and schedule the demo fallback,
    // even when the WS isn't ready yet. The WS reconnect logic (restoreRealtimeQueue)
    // will re-queue automatically once the socket comes up.
    realtimeQueueModeRef.current = effectiveMode;
    setConnectingStatus("Looking for an available stranger...");

    if (wsQueued) {
      startRealtimeQueueHeartbeat();
    }

    if (effectiveMode === "video" && demoFallbackEnabled) {
      demoFallbackTimeoutRef.current = window.setTimeout(() => {
        if (demoSearchSessionRef.current !== searchSessionId || activeRoomIdRef.current) {
          return;
        }
        void startDemoModeIfNeeded(searchSessionId);
      }, DEMO_FALLBACK_TRIGGER_MS);
    }

    if (effectiveMode === "text" && demoFallbackEnabled) {
      demoFallbackTimeoutRef.current = window.setTimeout(() => {
        if (demoSearchSessionRef.current !== searchSessionId || activeRoomIdRef.current) {
          return;
        }
        startAITextDemoMode(searchSessionId);
      }, DEMO_FALLBACK_TRIGGER_MS);
    }
  };

  const stopSearching = async () => {
    if (!user) {
      return;
    }

    stopDemoMode();
    cleanupWaitIntervals();

    if (realtimeQueueModeRef.current) {
      void sendRealtimeEvent("queue_leave", { mode: realtimeQueueModeRef.current });
      realtimeQueueModeRef.current = null;
    }
    realtimeQueueJoinPayloadRef.current = null;

    stopRealtimeQueueHeartbeat();

  };

  const handleDemoNext = async () => {
    if (!chatFilters) {
      return;
    }

    setStrangerSkipped(false);
    setWaitingForNext(false);
    setShowNextStrangerPrompt(false);

    await startSearching(chatFilters, "video");
  };

  useEffect(() => {
    if (demoFallbackEnabled) {
      return;
    }

    stopDemoMode();
  }, [demoFallbackEnabled, stopDemoMode]);

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
    event.target.value = "";
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
          const rest = { ...current };
          delete rest[emoji];
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

    const isGroupMode = false;
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

  // Streams an AI reply based on the current history. If new messages arrive while streaming,
  // aiTextDemoReplyPendingRef is set so another reply is triggered immediately after.
  const streamAITextDemoReply = async () => {
    const persona = aiTextDemoPersonaRef.current;
    if (!persona || isAITextDemoStreamingRef.current) return;

    isAITextDemoStreamingRef.current = true;
    aiTextDemoReplyPendingRef.current = false;

    const historySnapshot = aiTextDemoHistoryRef.current;
    const aiMsgId = `ai-demo-ai-${Date.now()}`;
    aiTextDemoAbortRef.current = new AbortController();

    try {
      const res = await fetch("/api/demo/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historySnapshot.slice(-20),
          persona: { name: persona.name, age: persona.age, country: persona.countryName, personality: persona.style },
          allowAdult: persona.allowAdult === true,
        }),
        signal: aiTextDemoAbortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        // Bot skips the user for inappropriate content
        if (accumulated.includes("__SKIP__")) {
          reader.cancel();
          setStrangerIsTyping(false);
          // Tear down AI demo state so stopDemoMode doesn't double-clean
          isAITextDemoRef.current = false;
          aiTextDemoHistoryRef.current = [];
          aiTextDemoPersonaRef.current = null;
          aiTextDemoReplyPendingRef.current = false;
          // Replicate exact real-stranger-leave UX
          setStrangerProfile(PENDING_STRANGER_PROFILE);
          setStrangerSkipped(true);
          setWaitingForNext(true);
          setShowNextStrangerPrompt(true);
          setConnectingStatus(STRANGER_LEFT_PROMPT);
          setMessages((prev) => {
            // Remove any partial __SKIP__ fragment that may have already rendered
            const filtered = prev.filter((m) => m.id !== aiMsgId);
            const already = filtered.some((m) => m.text === STRANGER_LEFT_PROMPT);
            if (already) return filtered;
            const now2 = new Date();
            return [
              ...filtered,
              {
                id: `system-skip-${Date.now()}`,
                author: "stranger" as const,
                text: STRANGER_LEFT_PROMPT,
                sentAt: `${String(now2.getHours()).padStart(2, "0")}:${String(now2.getMinutes()).padStart(2, "0")}`,
                createdAtMs: Date.now(),
              },
            ];
          });
          return;
        }

        // Hold off rendering while accumulated could still be a partial __SKIP__ token
        if ("__SKIP__".startsWith(accumulated.trimStart())) {
          continue;
        }
      }

      // Enforce minimum typing indicator duration (3–10 s) before revealing the message
      const elapsed = Date.now() - aiTypingStartMsRef.current;
      const remaining = aiTypingMinDurationMsRef.current - elapsed;
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }

      if (!isAITextDemoRef.current) return;

      // Reveal the accumulated message after the typing indicator has shown long enough
      if (!accumulated.includes("__SKIP__") && accumulated.trim()) {
        const nowFinal = new Date();
        const tsFinal = `${String(nowFinal.getHours()).padStart(2, "0")}:${String(nowFinal.getMinutes()).padStart(2, "0")}`;
        setStrangerIsTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: aiMsgId, author: "stranger" as const, text: accumulated, sentAt: tsFinal, createdAtMs: Date.now() },
        ]);
      }

      // Insert the assistant reply right after the snapshot point.
      // Any user messages added during streaming are preserved after it.
      const currentHistory = aiTextDemoHistoryRef.current;
      aiTextDemoHistoryRef.current = [
        ...currentHistory.slice(0, historySnapshot.length),
        { role: "assistant" as const, content: accumulated },
        ...currentHistory.slice(historySnapshot.length),
      ];
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setStrangerIsTyping(false);
      } else {
        setStrangerIsTyping(false);
      }
    } finally {
      isAITextDemoStreamingRef.current = false;
      aiTextDemoAbortRef.current = null;
      // If user sent more messages while AI was replying, trigger another reply
      if (aiTextDemoReplyPendingRef.current && isAITextDemoRef.current) {
        const pendingDelayMs = 1000 + Math.floor(Math.random() * 9000);
        aiTextDemoTypingDelayRef.current = setTimeout(() => {
          aiTextDemoTypingDelayRef.current = null;
          if (!isAITextDemoRef.current) return;
          aiTypingStartMsRef.current = Date.now();
          aiTypingMinDurationMsRef.current = 3000 + Math.floor(Math.random() * 7000);
          setStrangerIsTyping(true);
          void streamAITextDemoReply();
        }, pendingDelayMs);
      }
    }
  };

  const sendAITextDemoMessage = (messageText: string) => {
    const persona = aiTextDemoPersonaRef.current;
    if (!persona) return;

    // Immediately show the user's message in chat
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const userMsg: ChatMessage = {
      id: `ai-demo-user-${Date.now()}`,
      author: "you",
      text: messageText,
      sentAt: ts,
      createdAtMs: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Append to history
    aiTextDemoHistoryRef.current = [...aiTextDemoHistoryRef.current, { role: "user", content: messageText }];

    if (isAITextDemoStreamingRef.current) {
      // AI is mid-reply — flag that a new reply is needed when it finishes
      aiTextDemoReplyPendingRef.current = true;
    } else {
      // Delay before showing typing indicator (1–10 s) to mimic a real person reading
      const replyDelayMs = 1000 + Math.floor(Math.random() * 9000);
      aiTextDemoTypingDelayRef.current = setTimeout(() => {
        aiTextDemoTypingDelayRef.current = null;
        if (!isAITextDemoRef.current) return;
        aiTypingStartMsRef.current = Date.now();
        aiTypingMinDurationMsRef.current = 3000 + Math.floor(Math.random() * 7000);
        setStrangerIsTyping(true);
        void streamAITextDemoReply();
      }, replyDelayMs);
    }
  };

  const handleSendMessage = async () => {
    if (isAITextDemoRef.current && !activeRoomIdRef.current) {
      const textToSend = text.trim();
      if (!textToSend) return;
      setText("");
      sendAITextDemoMessage(textToSend);
      return;
    }

    // Video demo mode — show message locally only (no real room)
    // Allow only when video is actively playing OR in the between-videos gap
    if (isDemoModeRef.current && !activeRoomIdRef.current && (hasRemoteVideoRef.current || waitingForNextRef.current)) {
      const textToSend = text.trim();
      if (!textToSend) return;
      setText("");
      const now = new Date();
      const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setMessages((prev) => [
        ...prev,
        { id: `demo-user-${Date.now()}`, author: "you" as const, text: textToSend, sentAt: ts, createdAtMs: Date.now() },
      ]);
      return;
    }

    await sendMessage();
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

  function firebaseAuthErrorMessage(code: string): string | null {
    const map: Record<string, string> = {
      "auth/invalid-credential":       "Wrong email or password. Please try again.",
      "auth/user-not-found":           "No account found with that email.",
      "auth/wrong-password":           "Incorrect password. Please try again.",
      "auth/email-already-in-use":     "An account with this email already exists. Try signing in.",
      "auth/weak-password":            "Password must be at least 6 characters.",
      "auth/invalid-email":            "That doesn't look like a valid email address.",
      "auth/too-many-requests":        "Too many attempts. Wait a moment, then try again.",
      "auth/network-request-failed":   "Network error. Check your connection and retry.",
      "auth/user-disabled":            "This account has been disabled. Contact support.",
      "auth/requires-recent-login":    "Please sign in again to continue.",
      "auth/unauthorized-domain":      "Sign-in not enabled for this domain. Contact support.",
      "auth/popup-closed-by-user":     "Sign-in popup was closed. Please try again.",
      "auth/cancelled-popup-request":  "Another sign-in is in progress.",
    };
    return map[code] ?? null;
  }

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
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      const message = firebaseAuthErrorMessage(code) ?? (error instanceof Error ? error.message : "Guest login failed. Try again.");
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
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      const message = firebaseAuthErrorMessage(code) ?? (error instanceof Error ? error.message : "Google login failed. Try again.");
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const loginWithEmail = async () => {
    if (!email || !password) {
      setAuthError("Please enter your email and password.");
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
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      const message = firebaseAuthErrorMessage(code) ?? (error instanceof Error ? error.message : "Login failed. Try again.");
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const sendResetCode = async (emailAddr: string): Promise<void> => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAddr }),
    });
    if (!res.ok) throw new Error("Failed to send code");
  };

  const confirmResetCode = async (emailAddr: string, code: string, newPassword: string): Promise<{ error?: string }> => {
    const res = await fetch("/api/auth/reset-password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAddr, code, newPassword }),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || data.error) return { error: data.error ?? "Something went wrong." };
    return {};
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
  // Poll until the webhook has written to Firestore (can take 5-20s).
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      window.history.replaceState({}, "", "/");
      setShowPaymentSuccess(true);

      let attempts = 0;
      const MAX_ATTEMPTS = 12; // poll up to ~30s
      const POLL_INTERVAL_MS = 2500;
      let timerId: ReturnType<typeof setTimeout>;

      const poll = async () => {
        attempts += 1;
        try {
          const token = await auth.currentUser?.getIdToken(true);
          if (!token) return;
          const res = await fetch(`/api/subscription?uid=${encodeURIComponent(user.uid)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.active) {
              setSubscriptionExpiresAt(data.expiresAt ?? null);
              setSubscriptionTier(data.tier ?? null);
              return; // done
            }
          }
        } catch {
          // ignore, retry
        }
        if (attempts < MAX_ATTEMPTS) {
          timerId = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      };

      timerId = setTimeout(() => void poll(), 1500);
      return () => clearTimeout(timerId);
    }
    if (params.get("payment") === "cancelled") {
      window.history.replaceState({}, "", "/");
    }
  }, [user]);

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
            <article className="auth-panel auth-loading" aria-live="polite" aria-busy="true">
              <span className="sr-only">Checking account session...</span>
              <span className="auth-loading-visual" aria-hidden="true">
                <span className="auth-loading-ring" />
                <span className="auth-loading-spinner" />
                <span className="auth-loading-core" />
                <span className="auth-loading-orbit">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            </article>
          </section>
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
            setAuthNotice={setAuthNotice}
            authError={authError}
            authNotice={authNotice}
            loginAnonymously={loginAnonymously}
            renderRecaptcha={renderRecaptcha}
            loginWithGoogle={loginWithGoogle}
            loginWithEmail={loginWithEmail}
            sendResetCode={sendResetCode}
            confirmResetCode={confirmResetCode}
          />
          <LandingPageSection />
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
        </main>
      </>
    );
  }

  if (!chatMode || !chatFilters) {
    return (
      <>
        {showPaymentSuccess && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(8px)",
            }}
            onClick={() => setShowPaymentSuccess(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: subscriptionTier === "vvip"
                  ? "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(20,20,30,0.98))"
                  : "linear-gradient(135deg,rgba(236,72,153,0.12),rgba(20,20,30,0.98))",
                border: subscriptionTier === "vvip" ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(236,72,153,0.35)",
                borderRadius: "2rem",
                padding: "2.5rem 2rem",
                maxWidth: "22rem",
                width: "90%",
                textAlign: "center",
                boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
              }}
            >
              {subscriptionTier && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={subscriptionTier === "vvip" ? "/asstes/vvip/vviplogo.png" : "/asstes/vip/viplogo.png"}
                  alt={subscriptionTier === "vvip" ? "VVIP" : "VIP"}
                  style={{ width: 72, height: 72, objectFit: "contain", margin: "0 auto 1rem" }}
                />
              )}
              {!subscriptionTier && (
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.08)", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 24, height: 24, color: "#f59e0b" }}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
              )}
              <p style={{ fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.3em", textTransform: "uppercase", color: subscriptionTier === "vvip" ? "#f59e0b" : subscriptionTier === "vip" ? "#ec4899" : "#a78bfa", marginBottom: "0.5rem" }}>Payment Successful</p>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", marginBottom: "0.75rem", letterSpacing: "-0.03em" }}>
                {subscriptionTier ? `${subscriptionTier.toUpperCase()} Unlocked!` : "Features Unlocked!"}
              </h2>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                {subscriptionTier
                  ? `Your ${subscriptionTier.toUpperCase()} filters and priority matching are now active. Enjoy!`
                  : "Your subscription is now active. Enjoy your premium features!"}
              </p>
              <button
                onClick={() => setShowPaymentSuccess(false)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "1rem",
                  border: "none",
                  background: subscriptionTier === "vvip" ? "linear-gradient(90deg,#f59e0b,#ea580c)" : "rgba(255,255,255,0.1)",
                  color: subscriptionTier === "vvip" ? "#000" : "#fff",
                  fontWeight: 900,
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                Start Chatting
              </button>
            </div>
          </div>
        )}
        <main>
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
            onStart={(mode, filters, nickname, interests, adminProfileOverride) => {
              if (adminProfileOverride) {
                const locale = navigator.languages?.[0] ?? navigator.language ?? "en";
                const nextProfile: UserProfile = {
                  ...profile,
                  gender: adminProfileOverride.gender,
                  age: adminProfileOverride.age,
                  countryCode: adminProfileOverride.countryCode ?? undefined,
                  country: adminProfileOverride.countryCode
                    ? getCountryNameFromCode(adminProfileOverride.countryCode, locale)
                    : (profile.country ?? "Unknown"),
                };
                if (user) {
                  window.localStorage.setItem(`profile_${user.uid}`, JSON.stringify(nextProfile));
                }
                setProfile(nextProfile);
              }

              setChatMode(mode);
              setChatFilters(filters);
              setMyInterests(interests ?? []);
              void startSearching(filters, mode, nickname, interests, adminProfileOverride);
            }}
            onBack={logout}
            hasActiveSubscription={hasActiveSubscription}
            subscriptionTier={effectiveSubscriptionTier}
            isAdmin={isAdmin}
            initialAdminProfile={{
              gender: profile.gender,
              age: profile.age,
              countryCode: profile.countryCode ?? null,
            }}
            onShowPaywall={() => router.push("/plans")}
          />
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
          sendMessage={handleSendMessage}
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
          isSendingMessage={isSendingMessage}
          imageUploadProgress={imageUploadProgress}
          sendError={sendError}
          videoError={videoError}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          hasRemoteVideo={hasRemoteVideo}
          isDemoMode={isDemoMode}
          remoteAudioEnabled={hasRemoteAudio}
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
              setChatFilters(filters);
              await markRoomEnded();
              await stopSearching();
              await startSearching(filters);
            })();
          }}
          onChangeMode={() => {
            setChatMode(null);
            setChatFilters(null);
            void markRoomEnded();
            void stopSearching();
          }}
          onNextStranger={() => {
            if (isDemoMode && strangerSkipped && waitingForNext) {
              void handleDemoNext();
              return;
            }

            void (async () => {
              await markRoomEnded();
              void startSearching(chatFilters);
            })();
          }}
        />
      </main>
    </>
  );
}
