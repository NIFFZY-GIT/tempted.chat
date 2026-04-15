"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";

export type ChatMessage = {
  id: string;
  author: "you" | "stranger";
  senderId?: string;
  senderNickname?: string;
  senderColor?: string;
  clientMessageId?: string;
  isPending?: boolean;
  text?: string;
  image?: string;
  imageMimeType?: string;
  linkImageUrl?: string;
  linkImageMimeType?: string;
  imageUnavailable?: boolean;
  imageDecrypting?: boolean;
  imageViewTimerSeconds?: number;
  imageRevealAtMs?: number;
  imageExpiresAtMs?: number;
  imageDeleted?: boolean;
  replyToId?: string;
  replyToText?: string;
  replyToAuthor?: "you" | "stranger";
  reactions?: Record<string, string[]>; // emoji -> list of senderIds
  deletedForEveryone?: boolean;
  createdAtMs?: number;
  sentAt: string;
};

export type ProfileGender = "Male" | "Female" | "Other";
export type UserProfile = { gender: ProfileGender; age: number; country?: string; countryCode?: string; interests?: string[] };
export type ChatMode = "text" | "video";
export type GenderFilter = "Any" | ProfileGender;
export type AgeGroupFilter = "Any age" | "Under 18" | "18-25" | "25+";
export type ChatStyleFilter = "Any style" | "Casual" | "Intimate";
export type CountryFilter = "Any" | "US" | "GB" | "IN" | "DE" | "FR" | "ES" | "IT" | "BR" | "CA" | "AU" | "JP" | "KR" | "LK";
export type ChatFilters = {
  gender: GenderFilter;
  ageGroup: AgeGroupFilter;
  style: ChatStyleFilter;
  country: CountryFilter;
  hideCountry?: boolean;
};

export const starterMessages: ChatMessage[] = [
  { id: "1", author: "stranger", text: "Hey! What music are you into?", sentAt: "10:14 PM" },
  { id: "2", author: "you", text: "Mostly electronic. You?", sentAt: "10:15 PM" },
];

const IMAGE_DELETED_NOTICE = "Timer ran out. Image deleted.";

const isGifMimeType = (mimeType?: string): boolean => mimeType?.toLowerCase() === "image/gif";

const isGifFilename = (fileName?: string | null): boolean => {
  if (!fileName) {
    return false;
  }

  return fileName.trim().toLowerCase().endsWith(".gif");
};

function ChatMedia({
  src,
  alt,
  className,
  mimeType,
}: {
  src: string;
  alt: string;
  className: string;
  mimeType?: string;
}) {
  if (isGifMimeType(mimeType)) {
    return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
  }

  return <Image src={src} alt={alt} width={300} height={200} className={className} unoptimized />;
}

const pickRandomGender = (): ProfileGender => {
  const genders: ProfileGender[] = ["Male", "Female", "Other"];
  return genders[Math.floor(Math.random() * genders.length)];
};

const COUNTRY_OPTIONS: Array<{ code: Exclude<CountryFilter, "Any">; label: string }> = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "IN", label: "India" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "BR", label: "Brazil" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "LK", label: "Sri Lanka" },
];

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

const getCountryCodeFromName = (countryName?: string): string | null => {
  if (!countryName) {
    return null;
  }

  const normalizedName = countryName.trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  const fromOptions = COUNTRY_OPTIONS.find((option) => option.label.toLowerCase() === normalizedName)?.code;
  if (fromOptions) {
    return fromOptions;
  }

  if (normalizedName === "sri lanka") {
    return "LK";
  }

  return null;
};

const getCountryDisplayName = (country?: string): string => {
  if (!country) {
    return "";
  }

  const normalized = country.trim().toUpperCase() === "UK" ? "GB" : country.trim();

  if (/^[A-Z]{2}$/.test(normalized.toUpperCase())) {
    const code = normalized.toUpperCase();
    const fromOptions = COUNTRY_OPTIONS.find((option) => option.code === code)?.label;
    if (fromOptions) {
      return fromOptions;
    }

    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  return normalized;
};

const getCountryLabel = (countryCode: CountryFilter): string => {
  if (countryCode === "Any") {
    return "Any country";
  }

  return getCountryDisplayName(countryCode);
};

const pickRandomCountryCode = (): string => {
  const countryCodes = COUNTRY_OPTIONS.map((option) => option.code);
  return countryCodes[Math.floor(Math.random() * countryCodes.length)];
};

const toFlagEmoji = (countryCode?: string): string => {
  const normalizedCode = normalizeCountryCode(countryCode);
  if (!normalizedCode) {
    return "🌐";
  }

  return String.fromCodePoint(
    ...normalizedCode.split("").map((char) => 127397 + char.charCodeAt(0)),
  );
};

const getFlagIconUrl = (countryCode?: string): string | null => {
  const normalizedCode = normalizeCountryCode(countryCode);
  if (!normalizedCode) {
    return null;
  }

  return `https://flagcdn.com/24x18/${normalizedCode.toLowerCase()}.png`;
};

function CountryFlagIcon({ countryCode, className }: { countryCode?: string; className?: string }) {
  const iconUrl = getFlagIconUrl(countryCode);
  const normalizedCode = normalizeCountryCode(countryCode);

  if (!iconUrl || !normalizedCode) {
    return <span className={className ?? ""}>🌐</span>;
  }

  return (
    <img
      src={iconUrl}
      alt={`${normalizedCode} flag`}
      width={20}
      height={14}
      className={className ?? "h-3.5 w-5 rounded-[2px] object-cover"}
      loading="lazy"
      decoding="async"
    />
  );
}

export const generateRandomStrangerProfile = (filters?: ChatFilters): UserProfile => {
  const ageRangeByGroup: Record<AgeGroupFilter, [number, number]> = {
    "Any age": [13, 45],
    "Under 18": [13, 17],
    "18-25": [18, 25],
    "25+": [25, 45],
  };

  const [minAge, maxAge] = ageRangeByGroup[filters?.ageGroup ?? "Any age"];

  return {
    gender: filters?.gender && filters.gender !== "Any" ? filters.gender : pickRandomGender(),
    age: Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge,
    countryCode: filters?.country && filters.country !== "Any" ? filters.country : pickRandomCountryCode(),
  };
};

function GenderIcon({ gender }: { gender: ProfileGender }) {
  if (gender === "Male") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="9" cy="15" r="5" />
        <path d="M12.5 11.5 19 5m-5 0h5v5" />
      </svg>
    );
  }

  if (gender === "Female") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="8" r="5" />
        <path d="M12 13v8m-3.5-3h7" />
      </svg>
    );
  }

  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="10" cy="10" r="4" />
      <path d="m13 7 5-5m-3.5 0H18v3.5M10 14v7m-2.5-3h5" />
    </svg>
  );
}

type AuthViewProps = {
  authMethod: "email" | "google" | "anonymous";
  setAuthMethod: (value: "email" | "google" | "anonymous") => void;
  authMode: "signin" | "signup";
  setAuthMode: (value: "signin" | "signup") => void;
  authBusy: boolean;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  setAuthError: (value: string | null) => void;
  authError: string | null;
  authNotice: string | null;
  emailInputRef: RefObject<HTMLInputElement | null>;
  loginAnonymously: () => void;
  renderRecaptcha: (containerId: string) => void;
  loginWithGoogle: () => void;
  loginWithEmail: () => void;
  resetPassword: () => void;
};

export function AuthView({
  authMethod,
  setAuthMethod,
  authMode,
  setAuthMode,
  authBusy,
  email,
  setEmail,
  password,
  setPassword,
  setAuthError,
  authError,
  authNotice,
  emailInputRef,
  loginAnonymously,
  renderRecaptcha,
  loginWithGoogle,
  loginWithEmail,
  resetPassword,
}: AuthViewProps) {
  const captchaRendered = useRef(false);
  const [showCaptcha, setShowCaptcha] = useState(false);

  useEffect(() => {
    if (!showCaptcha || captchaRendered.current) return;
    const tryRender = (attempts: number) => {
      if (typeof window !== "undefined" && window.grecaptcha) {
        renderRecaptcha("recaptcha-container");
        captchaRendered.current = true;
      } else if (attempts > 0) {
        setTimeout(() => tryRender(attempts - 1), 500);
      }
    };
    tryRender(20);
  }, [showCaptcha, renderRecaptcha]);

  return (
    <section className="w-full max-w-sm animate-fade-in-up px-4">
      {/* Heading */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">tempted.chat</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/50">Anonymous. Encrypted. Instant.</p>
      </div>

      {/* Auth options */}
      <div className="space-y-2.5">
        {/* Guest */}
        {!showCaptcha ? (
          <button
            onClick={() => setShowCaptcha(true)}
            disabled={authBusy}
            className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-left transition-all hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <div className="min-w-0">
              <span className="block text-[15px] font-semibold text-white">Continue as Guest</span>
              <span className="block text-xs text-white/35">No sign-up needed</span>
            </div>
            <svg className="ml-auto h-4 w-4 text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        ) : (
          <div className="animate-pop-in rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <span className="text-sm font-medium text-white/70">Verify to continue as guest</span>
            </div>
            <div className="flex justify-center">
              <div id="recaptcha-container" />
            </div>
            <button
              onClick={loginAnonymously}
              disabled={authBusy}
              className="mt-3 w-full rounded-xl bg-emerald-500/15 py-2.5 text-sm font-semibold text-emerald-400 ring-1 ring-emerald-500/25 transition-all hover:bg-emerald-500/25 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
            >
              {authBusy ? "Joining…" : "Join as Guest"}
            </button>
          </div>
        )}

        {/* Google */}
        <button
          onClick={loginWithGoogle}
          disabled={authBusy}
          className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 text-left transition-all hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-1.9 3l3 2.3c1.8-1.7 2.8-4.1 2.8-7 0-.6-.1-1.2-.2-1.8H12z" />
              <path fill="#34A853" d="M12 21c2.5 0 4.7-.8 6.3-2.2l-3-2.3c-.8.6-1.9 1-3.3 1-2.5 0-4.6-1.7-5.3-4H3.6v2.4C5.2 19 8.3 21 12 21z" />
              <path fill="#FBBC05" d="M6.7 13.5c-.2-.6-.3-1.1-.3-1.7s.1-1.2.3-1.7V7.7H3.6C2.9 9 2.5 10.3 2.5 11.8s.4 2.8 1.1 4.1l3.1-2.4z" />
              <path fill="#4285F4" d="M12 6.1c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.7 3 14.5 2 12 2 8.3 2 5.2 4 3.6 7.7l3.1 2.4c.7-2.3 2.8-4 5.3-4z" />
            </svg>
          </span>
          <div className="min-w-0">
            <span className="block text-[15px] font-semibold text-white">Continue with Google</span>
            <span className="block text-xs text-white/35">Fast &amp; secure</span>
          </div>
          <svg className="ml-auto h-4 w-4 text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>

        {/* Email */}
        <button
          onClick={() => {
            setAuthMethod("email");
            setAuthError(null);
            setTimeout(() => emailInputRef.current?.focus(), 100);
          }}
          disabled={authBusy}
          className={`group flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${authMethod === "email" ? "border-pink-500/30 bg-pink-500/[0.06]" : "border-white/[0.07] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </span>
          <div className="min-w-0">
            <span className="block text-[15px] font-semibold text-white">Use Email</span>
            <span className="block text-xs text-white/35">Sign in or create account</span>
          </div>
          <svg className="ml-auto h-4 w-4 text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      {/* Email form */}
      {authMethod === "email" && (
        <div className="mt-4 animate-fade-in space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <input
            id="email"
            ref={emailInputRef}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="Email address"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/25 outline-none transition focus:border-pink-500/40 focus:bg-white/[0.06]"
          />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            placeholder="Password"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/25 outline-none transition focus:border-pink-500/40 focus:bg-white/[0.06]"
          />
          <button
            type="button"
            onClick={loginWithEmail}
            disabled={authBusy}
            className="w-full rounded-xl bg-pink-500 py-3 text-[15px] font-bold text-white transition hover:bg-pink-400 active:scale-[0.98] disabled:opacity-50"
          >
            {authMode === "signup" ? "Create Account" : "Sign In"}
          </button>
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={resetPassword}
              disabled={authBusy}
              className="text-white/30 transition hover:text-white/60"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "signin" ? "signup" : "signin");
                setAuthError(null);
              }}
              className="font-medium text-pink-400/70 transition hover:text-pink-400"
            >
              {authMode === "signin" ? "Create account" : "Sign in instead"}
            </button>
          </div>
        </div>
      )}

      {/* Notices */}
      {authError && (
        <div className="mt-4 animate-fade-in rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-center text-sm text-red-300">
          {authError}
        </div>
      )}
      {authNotice && (
        <div className="mt-4 animate-fade-in rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-center text-sm text-emerald-300">
          {authNotice}
        </div>
      )}
    </section>
  );
}

export function ProfileSetupView({
  profileGender,
  setProfileGender,
  profileAge,
  setProfileAge,
  profileCountry,
  profileCountryCode,
  profileError,
  onBack,
  onContinue,
  backLabel,
}: {
  profileGender: ProfileGender | null;
  setProfileGender: (value: ProfileGender) => void;
  profileAge: string;
  setProfileAge: (value: string) => void;
  profileCountry: string;
  profileCountryCode: string;
  profileError: string | null;
  onBack: () => void;
  onContinue: () => void;
  backLabel?: string;
}) {
  const resolvedCountryCode = normalizeCountryCode(profileCountryCode) ?? getCountryCodeFromName(profileCountry);
  const normalizedCountryName = getCountryDisplayName(profileCountry);

  return (
    <section className="w-full max-w-sm animate-fade-in-up px-4">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white">About you</h2>
        <p className="mt-1.5 text-sm text-white/40">Helps us match you better</p>
      </div>

      {/* Gender */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/30">Gender</p>
      <div className="grid grid-cols-3 gap-2">
        {(["Male", "Female", "Other"] as ProfileGender[]).map((gender) => {
          const selected = profileGender === gender;
          return (
            <button
              key={gender}
              type="button"
              className={`flex flex-col items-center gap-2 rounded-2xl border py-5 font-medium transition-all active:scale-[0.97] ${selected ? "border-pink-500/40 bg-pink-500/10 text-white shadow-[0_0_20px_rgba(236,72,153,0.08)]" : "border-white/[0.07] bg-white/[0.03] text-white/50 hover:border-white/15 hover:bg-white/[0.06] hover:text-white/70"}`}
              onClick={() => setProfileGender(gender)}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${selected ? "bg-pink-500/15 text-pink-400" : "bg-white/[0.05] text-white/40"}`}>
                <GenderIcon gender={gender} />
              </span>
              <span className="text-sm">{gender}</span>
            </button>
          );
        })}
      </div>

      {/* Age */}
      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-white/30">Age</p>
      <input
        id="profile-age"
        type="number"
        min={13}
        max={99}
        value={profileAge}
        onChange={(event) => setProfileAge(event.target.value)}
        placeholder="Your age"
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center text-lg font-medium text-white placeholder:text-white/20 outline-none transition focus:border-pink-500/40 focus:bg-white/[0.06]"
      />

      {/* Country */}
      <div className="mt-4 flex items-center justify-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/50">
        <CountryFlagIcon countryCode={resolvedCountryCode ?? undefined} className="h-3.5 w-5 rounded-[2px] object-cover" />
        <span>{profileCountry ? (normalizedCountryName || "Unknown") : "Detecting location..."}</span>
      </div>

      {/* Error */}
      {profileError && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-center text-sm text-red-300">
          {profileError}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-sm font-semibold text-white/50 transition hover:border-white/15 hover:text-white/80 active:scale-[0.97]"
        >
          {backLabel ?? "Back"}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-xl bg-pink-500 py-3 text-sm font-bold text-white transition hover:bg-pink-400 active:scale-[0.97]"
        >
          Continue
        </button>
      </div>
    </section>
  );
}

export function ModeAndFiltersView({
  onStart,
  onBack,
  hasActiveSubscription = false,
  subscriptionTier = null,
  onShowPaywall,
}: {
  onStart: (mode: ChatMode, filters: ChatFilters, nickname?: string, interests?: string[]) => void;
  onBack: () => void;
  hasActiveSubscription?: boolean;
  subscriptionTier?: "vip" | "vvip" | null;
  onShowPaywall?: () => void;
}) {
  const [selectedMode, setSelectedMode] = useState<ChatMode>("text");
  const [interestsInput, setInterestsInput] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [gender, setGender] = useState<GenderFilter>("Any");
  const [ageGroup, setAgeGroup] = useState<AgeGroupFilter>("Any age");
  const [style, setStyle] = useState<ChatStyleFilter>("Any style");
  const [country, setCountry] = useState<CountryFilter>("Any");
  const [hideCountry, setHideCountry] = useState(false);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [hoveredMode, setHoveredMode] = useState<ChatMode | null>(null);
  const countryMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedCountryCode = country !== "Any" ? country : undefined;

  useEffect(() => {
    if (!countryMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!countryMenuRef.current?.contains(event.target as Node)) setCountryMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [countryMenuOpen]);

  const addInterest = (value: string) => {
    const tag = value.trim().toLowerCase();
    if (tag && interests.length < 10 && !interests.includes(tag)) {
      setInterests((prev) => [...prev, tag]);
    }
    setInterestsInput("");
  };

  const removeInterest = (tag: string) => {
    setInterests((prev) => prev.filter((t) => t !== tag));
  };

  const handleInterestsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addInterest(interestsInput);
    } else if (e.key === "Backspace" && !interestsInput && interests.length > 0) {
      setInterests((prev) => prev.slice(0, -1));
    }
  };

  const handleStart = () => {
    onStart(selectedMode, { gender, ageGroup, style, country, hideCountry }, undefined, interests.length > 0 ? interests : undefined);
  };

  const handleQuickStart = () => {
    onStart(selectedMode, { gender: "Any", ageGroup: "Any age", style: "Any style", country: "Any", hideCountry }, undefined, interests.length > 0 ? interests : undefined);
  };

  const activeFiltersCount = [
    gender !== "Any",
    ageGroup !== "Any age",
    style !== "Any style",
    country !== "Any",
    hideCountry,
  ].filter(Boolean).length;

  const chip = (active: boolean, color?: "pink" | "violet" | "blue" | "amber") => {
    const c = color ?? "pink";
    const activeColors: Record<string, string> = {
      pink: "bg-pink-500/15 text-pink-300 border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.1)]",
      violet: "bg-violet-500/15 text-violet-300 border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]",
      blue: "bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.1)]",
      amber: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.1)]",
    };
    return `rounded-xl px-4 py-2.5 text-[13px] font-semibold text-center transition-all duration-300 cursor-pointer select-none border ${
      active
        ? activeColors[c]
        : "bg-white/[0.02] text-white/35 border-white/[0.06] hover:border-white/[0.12] hover:text-white/55 hover:bg-white/[0.04]"
    }`;
  };

  const modeConfig: Array<{
    id: ChatMode;
    emoji: string;
    title: string;
    sub: string;
    desc: string;
    accent: string;
    accentRgb: string;
    bg: string;
    border: string;
    glow: string;
    ring: string;
    iconBg: string;
    badgeBg: string;
    chipColor: "pink" | "violet" | "blue";
  }> = [
    {
      id: "text",
      emoji: "💬",
      title: "Text Chat",
      sub: "Messages, photos & fun",
      desc: "Send messages, share photos, and have fun conversations",
      accent: "text-pink-400",
      accentRgb: "236,72,153",
      bg: "bg-pink-500/[0.06]",
      border: "border-pink-500/30",
      glow: "shadow-[0_0_40px_rgba(236,72,153,0.15),0_4px_24px_rgba(236,72,153,0.1)]",
      ring: "ring-pink-500/20",
      iconBg: "bg-gradient-to-br from-pink-500/20 to-pink-600/10",
      badgeBg: "bg-pink-500",
      chipColor: "pink",
    },
    {
      id: "video",
      emoji: "📹",
      title: "Video Chat",
      sub: "Face-to-face with strangers",
      desc: "Live video calls with camera and microphone",
      accent: "text-violet-400",
      accentRgb: "139,92,246",
      bg: "bg-violet-500/[0.06]",
      border: "border-violet-500/30",
      glow: "shadow-[0_0_40px_rgba(139,92,246,0.15),0_4px_24px_rgba(139,92,246,0.1)]",
      ring: "ring-violet-500/20",
      iconBg: "bg-gradient-to-br from-violet-500/20 to-violet-600/10",
      badgeBg: "bg-violet-500",
      chipColor: "violet",
    },
  ];

  const activeModeConfig = modeConfig.find((m) => m.id === selectedMode) ?? modeConfig[0];

  return (
    <section className="relative flex h-full w-full items-center justify-center overflow-hidden px-4">

      {/* ── Ambient glow that follows selected mode ── */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 40%, rgba(${activeModeConfig.accentRgb}, 0.06) 0%, transparent 70%)`,
        }}
      />

      {/* ══ Main content ══ */}
      <div className="relative w-full max-w-[480px]">

        {/* Hero section */}
        <div className="mb-10 text-center">
          <div className="animate-hero-text-in mb-5 inline-flex items-center justify-center">
            <Image
              src="/asstes/logo/logologoheartandtempetedchat.png"
              alt="TEMPTED.CHAT"
              width={200}
              height={40}
              className="h-8 w-auto sm:h-10"
              priority
            />
          </div>
          <p className="animate-hero-text-in mode-stagger-2 mt-3 text-[14px] text-white/30 font-medium">
            Pick a mode, tap go — it&apos;s that simple
          </p>
        </div>

        {/* Mode cards */}
        <div className="mb-8 flex flex-col gap-3">
          {modeConfig.map((m, i) => {
            const active = selectedMode === m.id;
            const hovered = hoveredMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMode(m.id)}
                onMouseEnter={() => setHoveredMode(m.id)}
                onMouseLeave={() => setHoveredMode(null)}
                className={`animate-mode-card-in mode-stagger-${i + 1} group relative flex items-center gap-4 rounded-2xl border px-5 py-[18px] transition-all duration-300 active:scale-[0.98] ${
                  active
                    ? `${m.border} ${m.bg} ${m.glow}`
                    : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1] hover:bg-white/[0.03]"
                }`}
              >
                {/* Active indicator line on left */}
                <div
                  className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full transition-all duration-300 ${
                    active ? `opacity-100 ${m.badgeBg}` : "opacity-0"
                  }`}
                />

                {/* Animated ring pulse behind icon when active */}
                {active && (
                  <div
                    className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 h-12 w-12 rounded-xl"
                    style={{
                      animation: "pulse-ring 2s ease-out infinite",
                      boxShadow: `0 0 0 0 rgba(${m.accentRgb}, 0.3)`,
                    }}
                  />
                )}

                {/* Icon */}
                <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                  active
                    ? `${m.iconBg} ring-1 ${m.ring}`
                    : "bg-white/[0.03] ring-1 ring-white/[0.05] group-hover:bg-white/[0.05] group-hover:ring-white/[0.08]"
                }`}>
                  <span className={`text-2xl transition-transform duration-300 ${active || hovered ? "scale-110" : "scale-100"}`}>
                    {m.emoji}
                  </span>
                </div>

                {/* Text */}
                <div className="relative min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={`text-[15px] font-bold leading-tight transition-colors duration-200 ${
                      active ? "text-white" : "text-white/50 group-hover:text-white/70"
                    }`}>
                      {m.title}
                    </span>
                  </div>
                  <span className={`mt-1 block text-[12px] leading-tight transition-colors duration-200 ${
                    active ? "text-white/40" : "text-white/20 group-hover:text-white/30"
                  }`}>
                    {m.sub}
                  </span>
                </div>

                {/* Arrow / Check indicator on right */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
                  active
                    ? `${m.badgeBg} shadow-lg`
                    : "bg-white/[0.03] group-hover:bg-white/[0.06]"
                }`}
                  style={active ? { boxShadow: `0 4px 12px rgba(${m.accentRgb}, 0.3)` } : undefined}
                >
                  {active ? (
                    <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    <svg className="h-3.5 w-3.5 text-white/20 transition-all duration-200 group-hover:text-white/40 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Interests (optional) */}
        <div className="mb-6 animate-fade-in-up">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">
            Interests <span className="text-white/15 normal-case">(optional · press Enter to add)</span>
          </label>
          <div className={`flex flex-wrap items-center gap-1.5 rounded-xl border bg-white/[0.03] px-3 py-2.5 transition-all duration-300 focus-within:border-pink-500/40 focus-within:ring-1 focus-within:ring-pink-500/20 focus-within:bg-white/[0.04] ${interests.length >= 10 ? "border-white/[0.04]" : "border-white/[0.08]"}`}>
            {interests.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 pl-2.5 pr-1.5 py-1 text-[11px] font-medium text-pink-300 border border-pink-500/20 animate-pop-in">
                {tag}
                <button
                  type="button"
                  onClick={() => removeInterest(tag)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-pink-400/60 transition-colors hover:bg-pink-500/20 hover:text-pink-300"
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </span>
            ))}
            {interests.length < 10 && (
              <input
                type="text"
                value={interestsInput}
                onChange={(e) => setInterestsInput(e.target.value.slice(0, 30))}
                onKeyDown={handleInterestsKeyDown}
                onBlur={() => { if (interestsInput.trim()) addInterest(interestsInput); }}
                placeholder={interests.length === 0 ? "e.g. music, gaming, travel" : "Add more..."}
                className="min-w-[80px] flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/20"
              />
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-white/15">{interests.length}/10 interests</span>
          </div>
        </div>

        {/* Start button */}
        <div className="animate-mode-card-in mode-stagger-4">
          <button
            type="button"
            onClick={handleQuickStart}
            className="group relative mb-5 flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl py-4.5 text-[15px] font-extrabold text-white transition-all duration-300 active:scale-[0.97]"
          >
            {/* Base gradient */}
            <span
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                background: `linear-gradient(135deg, rgba(${activeModeConfig.accentRgb}, 0.9) 0%, rgba(${activeModeConfig.accentRgb}, 1) 50%, rgba(${activeModeConfig.accentRgb}, 0.85) 100%)`,
              }}
            />
            {/* Brighter on hover */}
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: `linear-gradient(135deg, rgba(${activeModeConfig.accentRgb}, 1) 0%, rgba(${activeModeConfig.accentRgb}, 0.9) 100%)`,
              }}
            />
            {/* Shine sweep */}
            <span className="pointer-events-none absolute inset-0 overflow-hidden">
              <span
                className="absolute top-0 h-full w-1/3 -skew-x-12 opacity-0 group-hover:opacity-100"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
                  animation: "btn-shine 1.5s ease-in-out infinite",
                }}
              />
            </span>
            {/* Shadow */}
            <span
              className="pointer-events-none absolute inset-0 transition-shadow duration-300"
              style={{
                boxShadow: `0 8px 32px rgba(${activeModeConfig.accentRgb}, 0.35)`,
              }}
            />
            <span className="pointer-events-none absolute inset-0 transition-shadow duration-300 opacity-0 group-hover:opacity-100"
              style={{
                boxShadow: `0 12px 44px rgba(${activeModeConfig.accentRgb}, 0.5)`,
              }}
            />
            <span className="relative flex items-center gap-2.5">
              <span className="text-lg transition-transform duration-300 group-hover:scale-110">🚀</span>
              <span>Start Chatting</span>
              <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </button>
        </div>

        {/* Filter toggle */}
        <div className="animate-mode-card-in mode-stagger-5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (!hasActiveSubscription) { onShowPaywall?.(); return; }
              setShowFilters((v) => !v);
            }}
            className="group relative inline-flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 text-[12px] font-semibold text-white/30 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/50 active:scale-[0.97]"
          >
            <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Filters
            {!hasActiveSubscription ? (
              <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-[9px] font-bold text-pink-400">VIP</span>
            ) : activeFiltersCount > 0 ? (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: `rgba(${activeModeConfig.accentRgb}, 0.8)` }}
              >
                {activeFiltersCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* ══ Backdrop overlay ══ */}
      {showFilters && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
          onClick={() => setShowFilters(false)}
        />
      )}

      {/* ══ Centered filter panel ══ */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowFilters(false)}>
          <div
            className="animate-filter-slide-in flex w-full max-w-[420px] max-h-[80dvh] flex-col rounded-3xl border border-white/[0.08] bg-[#0f0f17]/95 shadow-[0_32px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">
                  <svg className="h-4 w-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-white">Filters</h2>
                  <p className="text-[11px] text-white/25">Customize your match</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/30 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/60 active:scale-90"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Divider */}
            <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Scrollable filters */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* VIP section */}
              <div>
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pink-500/10 text-[12px]">💎</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-pink-400/60">VIP Filters</span>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2.5 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Gender preference</label>
                    <div className="flex flex-wrap gap-2">
                      {(["Any", "Male", "Female", "Other"] as GenderFilter[]).map((opt) => (
                        <button key={opt} type="button" onClick={() => setGender((c) => (c === opt ? "Any" : opt))} className={chip(gender === opt, activeModeConfig.chipColor)}>{opt}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2.5 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Chat vibe</label>
                    <div className="flex flex-wrap gap-2">
                      {(["Any style", "Casual", "Intimate"] as ChatStyleFilter[]).map((opt) => (
                        <button key={opt} type="button" onClick={() => setStyle((c) => (c === opt ? "Any style" : opt))} className={chip(style === opt, activeModeConfig.chipColor)}>
                          {opt === "Any style" ? "Any" : opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHideCountry((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 transition-all duration-200 hover:bg-white/[0.04]"
                  >
                    <span className="flex items-center gap-2.5 text-[13px] font-medium text-white/40">
                      <span className="text-[14px]">🙈</span>
                      Hide my location
                    </span>
                    <span className={`relative flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${hideCountry ? "bg-pink-500" : "bg-white/10"}`}>
                      <span className={`absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${hideCountry ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
                    </span>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              {/* VVIP section */}
              <div className={subscriptionTier !== "vvip" ? "pointer-events-none" : ""}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-[12px]">👑</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400/60">VVIP Filters</span>
                  </div>
                  {subscriptionTier !== "vvip" && (
                    <button
                      type="button"
                      onClick={() => onShowPaywall?.()}
                      className="pointer-events-auto rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3.5 py-1.5 text-[10px] font-bold text-black transition-all duration-200 hover:shadow-[0_4px_16px_rgba(245,158,11,0.3)] active:scale-95"
                    >
                      Upgrade
                    </button>
                  )}
                </div>

                <div className={`space-y-5 transition-opacity duration-300 ${subscriptionTier !== "vvip" ? "opacity-30" : ""}`}>
                  <div>
                    <label className="mb-2.5 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Age range</label>
                    <div className="flex flex-wrap gap-2">
                      {(["Any age", "Under 18", "18-25", "25+"] as AgeGroupFilter[]).map((opt) => (
                        <button key={opt} type="button" onClick={() => { if (subscriptionTier === "vvip") setAgeGroup((c) => (c === opt ? "Any age" : opt)); }} className={chip(ageGroup === opt, "amber")}>
                          {opt === "Any age" ? "Any" : opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2.5 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Country</label>
                    <div className="relative" ref={countryMenuRef}>
                      <button
                        type="button"
                        onClick={() => { if (subscriptionTier === "vvip") setCountryMenuOpen((c) => !c); }}
                        className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-sm text-white/40 transition-all duration-200 hover:bg-white/[0.04]"
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <CountryFlagIcon countryCode={selectedCountryCode} className="h-3.5 w-5 rounded-sm object-cover" />
                          {country === "Any" ? "Any country" : getCountryLabel(country)}
                        </span>
                        <svg className={`h-4 w-4 text-white/20 transition-transform duration-300 ${countryMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                      {countryMenuOpen && (
                        <div className="absolute z-30 mt-2 max-h-44 w-full overflow-y-auto rounded-xl border border-white/[0.06] bg-[#141420] p-1.5 shadow-2xl backdrop-blur-xl">
                          <button type="button" onClick={() => { setCountry("Any"); setCountryMenuOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${country === "Any" ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/[0.05]"}`}>
                            <CountryFlagIcon className="h-3.5 w-5 rounded-sm object-cover" /> Any country
                          </button>
                          {COUNTRY_OPTIONS.map((opt) => (
                            <button key={opt.code} type="button" onClick={() => { setCountry(opt.code); setCountryMenuOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${country === opt.code ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/[0.05]"}`}>
                              <CountryFlagIcon countryCode={opt.code} className="h-3.5 w-5 rounded-sm object-cover" /> {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Apply button */}
            <div className="border-t border-white/[0.06] px-6 py-5">
              <button
                type="button"
                onClick={handleStart}
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl py-3.5 text-[14px] font-bold text-white transition-all duration-300 active:scale-[0.97]"
                style={{
                  background: `linear-gradient(135deg, rgba(${activeModeConfig.accentRgb}, 0.9), rgba(${activeModeConfig.accentRgb}, 1))`,
                  boxShadow: `0 8px 24px rgba(${activeModeConfig.accentRgb}, 0.3)`,
                }}
              >
                <span className="relative flex items-center gap-2">
                  Apply & Start
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

export function ChatRoomView({
  strangerProfile,
  chatMode,
  chatFilters,
  isConnecting,
  connectingStatus,
  showNextStrangerPrompt,
  strangerIsTyping,
  messages,
  text,
  setText,
  sendMessage,
  onReplyToMessage,
  onReactToMessage,
  replyingTo,
  clearReply,
  currentUserId,
  onDeleteMessage,
  onRevealTimedImage,
  onLeaveChat,
  onChangeMode,
  onNextStranger,
  imagePreview,
  selectedFileName,
  imageTimerSeconds,
  setImageTimerSeconds,
  isSendingMessage,
  imageUploadProgress,
  sendError,
  videoError,
  localVideoRef,
  remoteVideoRef,
  hasRemoteVideo,
  localVideoEnabled,
  localAudioEnabled,
  toggleLocalVideo,
  toggleLocalAudio,
  switchCamera,
  fileInputRef,
  onSelectImage,
  clearAttachment,
  subscriptionTier = null,
  hasActiveSubscription = false,
  onShowPaywall,
}: {
  strangerProfile: UserProfile;
  chatMode: ChatMode;
  chatFilters: ChatFilters | null;
  isConnecting: boolean;
  connectingStatus: string;
  showNextStrangerPrompt: boolean;
  strangerIsTyping: boolean;
  messages: ChatMessage[];
  text: string;
  setText: (value: string) => void;
  sendMessage: () => void;
  onReplyToMessage: (messageId: string) => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  replyingTo: ChatMessage | null;
  clearReply: () => void;
  currentUserId: string;
  onDeleteMessage: (messageId: string) => void;
  onRevealTimedImage: (messageId: string, timerSeconds: number) => void;
  onLeaveChat: (filters: ChatFilters) => void;
  onChangeMode: () => void;
  onNextStranger: () => void;
  imagePreview: string | null;
  selectedFileName: string | null;
  imageTimerSeconds: number;
  setImageTimerSeconds?: (seconds: number) => void;
  isSendingMessage: boolean;
  imageUploadProgress: number | null;
  sendError: string | null;
  videoError: string | null;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  hasRemoteVideo: boolean;
  localVideoEnabled: boolean;
  localAudioEnabled: boolean;
  toggleLocalVideo: () => void;
  toggleLocalAudio: () => void;
  switchCamera: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSelectImage: (event: ChangeEvent<HTMLInputElement>) => void;
  clearAttachment: () => void;
  subscriptionTier?: "vip" | "vvip" | null;
  hasActiveSubscription?: boolean;
  onShowPaywall?: () => void;
}) {
  const chatContainerRef = useRef<HTMLElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const shouldAutoScrollRef = useRef(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showScrollToLatestBubble, setShowScrollToLatestBubble] = useState(false);
  const [unreadReceivedCount, setUnreadReceivedCount] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [showVideoChatOverlay, setShowVideoChatOverlay] = useState(false);
  const [revealedTimedImageIds, setRevealedTimedImageIds] = useState<Set<string>>(new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);
  const [showChatFilters, setShowChatFilters] = useState(false);
  const [filterGender, setFilterGender] = useState<GenderFilter>(chatFilters?.gender ?? "Any");
  const [filterAgeGroup, setFilterAgeGroup] = useState<AgeGroupFilter>(chatFilters?.ageGroup ?? "Any age");
  const [filterStyle, setFilterStyle] = useState<ChatStyleFilter>(chatFilters?.style ?? "Any style");
  const [filterCountry, setFilterCountry] = useState<CountryFilter>(chatFilters?.country ?? "Any");
  const [filterHideCountry, setFilterHideCountry] = useState(chatFilters?.hideCountry ?? false);
  const [filterCountryMenuOpen, setFilterCountryMenuOpen] = useState(false);
  const filterCountryMenuRef = useRef<HTMLDivElement | null>(null);
  const filterSelectedCountryCode = filterCountry !== "Any" ? filterCountry : undefined;
  const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

  const modeLabel = chatMode === "text" ? "Text" : chatMode === "video" ? "Video" : "Group";
  const ageLabel = chatFilters?.ageGroup ?? "Any age";
  const genderLabel = chatFilters?.gender && chatFilters.gender !== "Any" ? chatFilters.gender : "Any gender";
  const styleLabel = chatFilters?.style ?? "Any style";
  const countryLabel = getCountryLabel(chatFilters?.country ?? "Any");
  const selectedStyle = chatFilters?.style && chatFilters.style !== "Any style" ? chatFilters.style : null;
  const selectedCountryCode = chatFilters?.country && chatFilters.country !== "Any" ? chatFilters.country : undefined;
  const hasResolvedStrangerProfile = !isConnecting && strangerProfile.age > 0;
  const strangerProfileLabel = hasResolvedStrangerProfile
    ? `${strangerProfile.gender}, ${strangerProfile.age}`
    : "Searching...";

  const chatFilterActiveCount = [
    chatFilters?.gender !== "Any" && chatFilters?.gender,
    chatFilters?.ageGroup !== "Any age" && chatFilters?.ageGroup,
    chatFilters?.style !== "Any style" && chatFilters?.style,
    chatFilters?.country !== "Any" && chatFilters?.country,
    chatFilters?.hideCountry,
  ].filter(Boolean).length;

  useEffect(() => {
    if (!filterCountryMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!filterCountryMenuRef.current?.contains(event.target as Node)) setFilterCountryMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterCountryMenuOpen]);

  const handleApplyFilters = () => {
    setShowChatFilters(false);
    onLeaveChat({ gender: filterGender, ageGroup: filterAgeGroup, style: filterStyle, country: filterCountry, hideCountry: filterHideCountry });
  };

  const chatFilterChip = (active: boolean) =>
    `rounded-xl px-3.5 py-2 text-[12px] font-semibold text-center transition-all duration-300 cursor-pointer select-none border ${
      active
        ? "bg-pink-500/15 text-pink-300 border-pink-500/30 shadow-[0_0_12px_rgba(236,72,153,0.1)]"
        : "bg-white/[0.02] text-white/35 border-white/[0.06] hover:border-white/[0.12] hover:text-white/55 hover:bg-white/[0.04]"
    }`;

  const renderChatFilterPanel = () => (
    <>
      {showChatFilters && (
        <div
          className="animate-fade-in fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
          onClick={() => setShowChatFilters(false)}
        />
      )}
      {showChatFilters && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={() => setShowChatFilters(false)}>
          <div
            className="animate-filter-slide-in flex w-full max-w-[420px] max-h-[80dvh] flex-col rounded-3xl border border-white/[0.08] bg-[#0f0f17]/95 shadow-[0_32px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">
                  <svg className="h-4 w-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-white">Filters</h2>
                  <p className="text-[11px] text-white/25">Change filters & find new match</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowChatFilters(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/30 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/60 active:scale-90">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Filters */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* VIP */}
              <div className={!hasActiveSubscription ? "pointer-events-none opacity-40" : ""}>
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pink-500/10 text-[12px]">💎</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-pink-400/60">VIP</span>
                  {!hasActiveSubscription && (
                    <button type="button" onClick={() => { setShowChatFilters(false); onShowPaywall?.(); }} className="pointer-events-auto ml-auto rounded-lg bg-pink-500 px-3 py-1 text-[10px] font-bold text-white transition hover:bg-pink-400 active:scale-95">Unlock</button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Gender</label>
                    <div className="flex flex-wrap gap-2">
                      {(["Any", "Male", "Female", "Other"] as GenderFilter[]).map((opt) => (
                        <button key={opt} type="button" onClick={() => setFilterGender((c) => (c === opt ? "Any" : opt))} className={chatFilterChip(filterGender === opt)}>{opt}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Vibe</label>
                    <div className="flex flex-wrap gap-2">
                      {(["Any style", "Casual", "Intimate"] as ChatStyleFilter[]).map((opt) => (
                        <button key={opt} type="button" onClick={() => setFilterStyle((c) => (c === opt ? "Any style" : opt))} className={chatFilterChip(filterStyle === opt)}>{opt === "Any style" ? "Any" : opt}</button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => setFilterHideCountry((v) => !v)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:bg-white/[0.04]">
                    <span className="flex items-center gap-2.5 text-[13px] font-medium text-white/40"><span className="text-[14px]">🙈</span>Hide my location</span>
                    <span className={`relative flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${filterHideCountry ? "bg-pink-500" : "bg-white/10"}`}>
                      <span className={`absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${filterHideCountry ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
                    </span>
                  </button>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              {/* VVIP */}
              <div className={subscriptionTier !== "vvip" ? "pointer-events-none" : ""}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-[12px]">👑</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400/60">VVIP</span>
                  </div>
                  {subscriptionTier !== "vvip" && (
                    <button type="button" onClick={() => { setShowChatFilters(false); onShowPaywall?.(); }} className="pointer-events-auto rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3.5 py-1.5 text-[10px] font-bold text-black transition-all duration-200 hover:shadow-[0_4px_16px_rgba(245,158,11,0.3)] active:scale-95">Upgrade</button>
                  )}
                </div>
                <div className={`space-y-4 transition-opacity duration-300 ${subscriptionTier !== "vvip" ? "opacity-30" : ""}`}>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Age Range</label>
                    <div className="flex flex-wrap gap-2">
                      {(["Any age", "Under 18", "18-25", "25+"] as AgeGroupFilter[]).map((opt) => (
                        <button key={opt} type="button" onClick={() => { if (subscriptionTier === "vvip") setFilterAgeGroup((c) => (c === opt ? "Any age" : opt)); }} className={chatFilterChip(filterAgeGroup === opt)}>{opt === "Any age" ? "Any" : opt}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Country</label>
                    <div className="relative" ref={filterCountryMenuRef}>
                      <button type="button" onClick={() => { if (subscriptionTier === "vvip") setFilterCountryMenuOpen((c) => !c); }} className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/40 transition-all duration-200 hover:bg-white/[0.04]">
                        <span className="inline-flex items-center gap-2.5">
                          <CountryFlagIcon countryCode={filterSelectedCountryCode} className="h-3.5 w-5 rounded-sm object-cover" />
                          {filterCountry === "Any" ? "Any country" : getCountryLabel(filterCountry)}
                        </span>
                        <svg className={`h-4 w-4 text-white/20 transition-transform duration-300 ${filterCountryMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                      {filterCountryMenuOpen && (
                        <div className="absolute z-30 mt-2 max-h-44 w-full overflow-y-auto rounded-xl border border-white/[0.06] bg-[#141420] p-1.5 shadow-2xl backdrop-blur-xl">
                          <button type="button" onClick={() => { setFilterCountry("Any"); setFilterCountryMenuOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${filterCountry === "Any" ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/[0.05]"}`}>
                            <CountryFlagIcon className="h-3.5 w-5 rounded-sm object-cover" /> Any country
                          </button>
                          {COUNTRY_OPTIONS.map((opt) => (
                            <button key={opt.code} type="button" onClick={() => { setFilterCountry(opt.code); setFilterCountryMenuOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${filterCountry === opt.code ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/[0.05]"}`}>
                              <CountryFlagIcon countryCode={opt.code} className="h-3.5 w-5 rounded-sm object-cover" /> {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Apply */}
            <div className="border-t border-white/[0.06] px-6 py-5">
              <button type="button" onClick={handleApplyFilters} className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-pink-500 py-3.5 text-[14px] font-bold text-white transition-all duration-300 hover:bg-pink-400 active:scale-[0.97]">
                <span className="relative flex items-center gap-2">
                  Apply & Find New Match
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const isNearBottom = (viewport: HTMLDivElement): boolean => {
    const distanceFromBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
    return distanceFromBottom <= 72;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await chatContainerRef.current?.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  };

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    setShowScrollToLatestBubble(false);
    setUnreadReceivedCount(0);
  }, [messages, strangerProfile]);

  useEffect(() => {
    const previousKnownIds = knownMessageIdsRef.current;
    const nextKnownIds = new Set(messages.map((message) => message.id));
    knownMessageIdsRef.current = nextKnownIds;

    if (previousKnownIds.size === 0) {
      return;
    }

    const newlyReceivedCount = messages.reduce((count, message) => {
      if (previousKnownIds.has(message.id)) {
        return count;
      }

      return message.author === "stranger" ? count + 1 : count;
    }, 0);

    if (newlyReceivedCount > 0 && !shouldAutoScrollRef.current) {
      setUnreadReceivedCount((current) => current + newlyReceivedCount);
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    const nearBottom = isNearBottom(viewport);
    shouldAutoScrollRef.current = nearBottom;
    setShowScrollToLatestBubble(!nearBottom);
    if (nearBottom) {
      setUnreadReceivedCount(0);
    }
  };

  const scrollToLatestMessage = () => {
    shouldAutoScrollRef.current = true;
    setShowScrollToLatestBubble(false);
    setUnreadReceivedCount(0);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    setRevealedTimedImageIds((current) => {
      const next = new Set(current);
      let changed = false;

      for (const message of messages) {
        if (message.imageDeleted || !message.image) {
          if (next.delete(message.id)) {
            changed = true;
          }
        }
      }

      return changed ? next : current;
    });
  }, [messages]);

  /* ─── Stable vh for mobile keyboards ─── */
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty("--vh", `${vv.height * 0.01}px`);
    };
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!isSendingMessage && !isConnecting) {
      messageInputRef.current?.focus({ preventScroll: true });
    }
  }, [isConnecting, isSendingMessage]);

  /* ─── Video‑mode: full‑screen layout ─── */
  if (chatMode === "video") {
    return (
      <section
        ref={chatContainerRef}
        className="fixed inset-0 z-50 flex flex-col bg-black touch-manipulation overscroll-contain"
      >
        {/* Split-screen: col on mobile (stranger top / you bottom), row on desktop (stranger left / you right) */}
        <div className="flex h-[calc(var(--vh,1dvh)*100)] w-full flex-col sm:flex-row">
          {/* Stranger video panel */}
          <div className="relative h-[calc(var(--vh,1dvh)*50)] w-full shrink-0 overflow-hidden border-b border-white/10 sm:h-full sm:w-1/2 sm:shrink sm:border-b-0 sm:border-r">
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
            {!hasRemoteVideo && (
              <div className="absolute inset-0 grid place-items-center bg-black/90 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.05]">
                    <svg className="h-9 w-9 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z" /></svg>
                  </div>
                  {isConnecting ? (
                    <div className="flex flex-col items-center gap-4">
                      <svg className="h-30 w-30" viewBox="0 0 60 60" style={{ animation: "search-spin 1.4s linear infinite" }}>
                        <circle cx="30" cy="30" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                        <circle cx="30" cy="30" r="20" fill="none" stroke="url(#search-grad)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "search-dash 1.6s ease-in-out infinite" }} />
                        <defs><linearGradient id="search-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="rgb(236,72,153)" /><stop offset="100%" stopColor="rgb(167,139,250)" /></linearGradient></defs>
                      </svg>
                      <div className="text-center" style={{ animation: "search-text-in 0.4s ease-out both" }}>
                        <p className="text-sm font-medium text-white/60">Finding someone...</p>
                        <p className="mt-1 text-xs text-white/30">{connectingStatus}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-white/35">Waiting for stranger&apos;s camera...</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Your video panel */}
          <div className="relative h-[calc(var(--vh,1dvh)*50)] w-full shrink-0 overflow-hidden sm:h-full sm:w-1/2 sm:shrink">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            {!localVideoEnabled && (
              <div className="absolute inset-0 grid place-items-center bg-black/85">
                <svg className="h-8 w-8 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m2 2 20 20" /><rect x="3" y="7" width="12" height="10" rx="2" /><path d="m15 10 6-3v10l-6-3" /></svg>
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/60 backdrop-blur-md sm:top-auto sm:bottom-3">You</span>
          </div>
        </div>

        {/* ── Overlays (all absolute, outside overflow-hidden panels) ── */}

        {/* Top bar */}
        <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-gradient-to-b from-black/80 via-black/50 to-transparent px-3 pb-4 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-4">
          {!showBackConfirm ? (
            <button
              onClick={() => setShowBackConfirm(true)}
              className="btn-action btn-action-ghost flex h-10 min-w-[4rem] items-center justify-center gap-1.5 rounded-full bg-black/50 px-4 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:bg-black/60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </button>
          ) : (
            <div className="flex items-center gap-2 animate-pop-in">
              <span className="text-xs font-semibold text-white/60">Leave?</span>
              <button onClick={() => { setShowBackConfirm(false); onChangeMode(); }} className="btn-action btn-action-pink h-10 rounded-full bg-pink-500 px-4 text-xs font-bold text-white backdrop-blur-md">Yes</button>
              <button onClick={() => setShowBackConfirm(false)} className="btn-action btn-action-ghost h-10 rounded-full bg-black/50 px-4 text-xs font-semibold text-white/80 backdrop-blur-md">No</button>
            </div>
          )}

          <div className="relative flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-md">
              <GenderIcon gender={strangerProfile.gender} />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black ${isConnecting ? "bg-amber-400" : "bg-emerald-400"}`} style={isConnecting ? { animation: "ripple 1.5s ease-out infinite" } : {}} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white/90 drop-shadow-md">
              {hasResolvedStrangerProfile ? (
                <>
                  <CountryFlagIcon countryCode={strangerProfile.countryCode} className="h-3.5 w-5 rounded-[2px] object-cover" />
                  {strangerProfile.gender}, {strangerProfile.age}
                </>
              ) : (
                <span className="text-white/50">Connecting...</span>
              )}
              {subscriptionTier && (
                <span className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none ${subscriptionTier === "vvip" ? "bg-amber-400/20 text-amber-400" : "bg-pink-500/20 text-pink-400"}`}>
                  {subscriptionTier === "vvip" ? "VVIP" : "VIP"}
                </span>
              )}
            </p>
            {hasResolvedStrangerProfile && strangerProfile.interests && strangerProfile.interests.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {strangerProfile.interests.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70 border border-white/15 backdrop-blur-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {showNextStrangerPrompt ? (
              <button
                onClick={onNextStranger}
                className="btn-action btn-action-emerald animate-pop-in flex h-10 items-center gap-1.5 rounded-full bg-emerald-500 px-5 text-xs font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              >
                Next
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6"/></svg>
              </button>
            ) : !isConnecting ? (
              <>
                {!showLeaveConfirm ? (
                  <button
                    onClick={() => setShowLeaveConfirm(true)}
                    className="btn-action btn-action-rose flex h-10 items-center rounded-full bg-rose-500/90 px-5 text-xs font-bold text-white backdrop-blur-md"
                  >
                    Leave
                  </button>
                ) : (
                  <div className="flex items-center gap-2 animate-pop-in">
                    <span className="text-xs font-semibold text-white/60">Sure?</span>
                    <button onClick={() => { setShowLeaveConfirm(false); if (chatFilters) onLeaveChat(chatFilters); }} className="btn-action btn-action-pink h-10 rounded-full bg-pink-500 px-4 text-xs font-bold text-white backdrop-blur-md">Yes</button>
                    <button onClick={() => setShowLeaveConfirm(false)} className="btn-action btn-action-ghost h-10 rounded-full bg-black/50 px-4 text-xs font-semibold text-white/80 backdrop-blur-md">No</button>
                  </div>
                )}
              </>
            ) : null}

            {/* Filter button (video mode) */}
            <button
              type="button"
              onClick={() => setShowChatFilters(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/70 backdrop-blur-md transition hover:bg-black/60 active:scale-[0.96]"
              aria-label="Filters"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
              {chatFilterActiveCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[9px] font-bold text-white">{chatFilterActiveCount}</span>
              )}
            </button>
          </div>
        </header>

        {/* Chat overlay — full-width across both videos */}
        {showVideoChatOverlay && (
          <div className="absolute inset-x-0 bottom-20 z-20 mx-2 flex max-h-[55%] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-black/70 backdrop-blur-xl sm:mx-4 sm:max-h-[60%]">
            <div
              ref={messagesViewportRef}
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto px-3 py-3 overscroll-contain will-change-scroll [transform:translateZ(0)]"
            >
              <div className="flex flex-col gap-2">
                {messages.map((msg) => {
                  if (msg.deletedForEveryone) {
                    return (
                      <div key={msg.id} className={`flex ${msg.author === "you" ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[12px] italic ${msg.author === "you" ? "text-pink-300/40" : "text-blue-300/40"}`}>{msg.author === "you" ? "You deleted this" : "Deleted"}</span>
                      </div>
                    );
                  }
                  const isYou = msg.author === "you";
                  return (
                    <div key={msg.id} className={`flex ${isYou ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed break-words [overflow-wrap:anywhere] ${isYou ? "rounded-br-sm bg-pink-500/80 text-white" : "rounded-bl-sm bg-blue-800/80 text-white"}`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>
            {replyingTo && (
              <div className={`flex items-center gap-2 border-t border-white/[0.06] px-3 py-1.5 ${replyingTo.author === "you" ? "bg-pink-500/[0.06]" : "bg-blue-500/[0.06]"}`}>
                <div className="min-w-0 flex-1 truncate text-[11px] text-white/50">
                  <span className="font-semibold">{replyingTo.author === "you" ? "You" : "Stranger"}: </span>
                  {replyingTo.text || "Photo"}
                </div>
                <button type="button" onClick={clearReply} className="text-white/30 hover:text-white/60"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2">
              <input
                ref={messageInputRef}
                type="text"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || isSendingMessage || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  sendMessage();
                }}
                placeholder="Message..."
                disabled={isSendingMessage}
                className="h-9 flex-1 rounded-lg bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/25"
              />
              <button
                onClick={sendMessage}
                disabled={isSendingMessage || !text.trim()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-pink-500 text-white transition active:scale-[0.95] disabled:opacity-20"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* Floating incoming message toasts — visible when chat overlay is closed */}
        {!showVideoChatOverlay && (() => {
          const recentStrangerMsgs = messages
            .filter((m) => m.author === "stranger" && !m.deletedForEveryone && m.text)
            .slice(-3);
          if (recentStrangerMsgs.length === 0) return null;
          return (
            <div className="pointer-events-none absolute bottom-20 left-2 z-20 flex max-w-[60%] flex-col gap-1.5 sm:left-4 sm:max-w-[40%]">
              {recentStrangerMsgs.map((msg) => (
                <div
                  key={msg.id}
                  className="pointer-events-auto animate-pop-in rounded-2xl rounded-bl-sm bg-blue-800/80 px-3 py-1.5 text-[13px] leading-relaxed text-white shadow-lg backdrop-blur-md break-words [overflow-wrap:anywhere]"
                >
                  {msg.text}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Bottom controls — overlay */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-6">
          {/* Chat toggle */}
          <button
            type="button"
            onClick={() => setShowVideoChatOverlay((v) => !v)}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition ${showVideoChatOverlay ? "bg-white/25 text-white ring-1 ring-white/30" : "bg-white/15 text-white/80 ring-1 ring-white/20"}`}
            aria-label="Toggle chat"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" /></svg>
          </button>

          <button
            type="button"
            onClick={toggleLocalAudio}
            aria-label={localAudioEnabled ? "Mute microphone" : "Unmute microphone"}
            className={`inline-flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md transition ${localAudioEnabled ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-rose-500/90 text-white ring-1 ring-rose-400/40"}`}
          >
            {localAudioEnabled ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></svg>
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 4 16 16" /><path d="M9 9v3a3 3 0 0 0 5.14 2.14" /><path d="M15 6a3 3 0 0 0-5.08-2.2" /><path d="M19 10v2a7 7 0 0 1-1.6 4.49" /><path d="M5 10v2a7 7 0 0 0 11.98 4.95" /></svg>
            )}
          </button>

          <button
            type="button"
            onClick={toggleLocalVideo}
            aria-label={localVideoEnabled ? "Turn off camera" : "Turn on camera"}
            className={`inline-flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md transition ${localVideoEnabled ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-amber-500/90 text-white ring-1 ring-amber-400/40"}`}
          >
            {localVideoEnabled ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="12" height="10" rx="2" /><path d="m15 10 6-3v10l-6-3" /></svg>
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 2 20 20" /><rect x="3" y="7" width="12" height="10" rx="2" /><path d="m15 10 6-3v10l-6-3" /></svg>
            )}
          </button>

          <button
            type="button"
            onClick={switchCamera}
            aria-label="Switch camera"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/25"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 4h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1" /><path d="M7 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h1" /><path d="m8 9 3-3 3 3" /><path d="m16 15-3 3-3-3" /><path d="M11 6h2v12h-2" /></svg>
          </button>
        </div>

        {videoError && (
          <div className="absolute inset-x-0 bottom-24 z-20 mx-auto max-w-sm px-4">
            <p className="rounded-xl bg-rose-500/20 px-4 py-2.5 text-center text-xs font-medium text-rose-300 backdrop-blur-md">{videoError}</p>
          </div>
        )}

        {renderChatFilterPanel()}
      </section>
    );
  }

  /* ─── Text / Group mode: standard layout ─── */
  return (
    <section
      ref={chatContainerRef}
      className={`${isFullscreen ? "fixed inset-0 z-50 mt-0 h-dvh rounded-none" : "mt-0 h-[calc(var(--vh,1dvh)*100-5.5rem)] rounded-2xl sm:h-[calc(var(--vh,1dvh)*100-6rem)] md:rounded-3xl"} relative flex w-full max-w-none flex-col overflow-hidden border border-white/[0.06] bg-[#0a0a10] shadow-[0_8px_40px_rgba(0,0,0,0.5)] overscroll-contain touch-manipulation`}
    >
      {/* ─── Header ─── */}
      <header className="flex items-center gap-2 border-b border-white/[0.06] bg-[#0d0d14]/90 px-2.5 py-2 backdrop-blur-md sm:px-4 sm:py-2.5">
        {!showBackConfirm ? (
          <button
            onClick={() => setShowBackConfirm(true)}
            className="btn-action btn-action-ghost flex h-8 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-white/50 transition-all duration-150 hover:bg-white/[0.1] hover:text-white/70"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
        ) : (
          <div className="flex items-center gap-1.5 animate-pop-in">
            <span className="text-[11px] font-semibold text-white/40">Sure?</span>
            <button onClick={() => { setShowBackConfirm(false); onChangeMode(); }} className="btn-action btn-action-pink h-7 rounded-lg bg-pink-500 px-3 text-[11px] font-bold text-white transition-all duration-150 hover:bg-pink-400">Yes</button>
            <button onClick={() => setShowBackConfirm(false)} className="btn-action btn-action-ghost h-7 rounded-lg bg-white/[0.08] px-3 text-[11px] font-semibold text-white/60 transition-all duration-150 hover:bg-white/[0.14]">No</button>
          </div>
        )}

        <div className="relative flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/60 ring-1 ring-white/[0.08]">
            <GenderIcon gender={strangerProfile.gender} />
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d0d14] ${isConnecting ? "bg-amber-400" : "bg-emerald-400"}`} style={isConnecting ? { animation: "ripple 1.5s ease-out infinite" } : {}} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {hasResolvedStrangerProfile ? (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
                <CountryFlagIcon countryCode={strangerProfile.countryCode} className="h-3.5 w-5 rounded-[2px] object-cover" />
                {strangerProfile.gender}, {strangerProfile.age}
              </span>
            ) : (
              <span className="text-sm font-semibold text-white/50">Connecting...</span>
            )}
            {subscriptionTier && (
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none ${subscriptionTier === "vvip" ? "bg-amber-400/20 text-amber-400" : "bg-pink-500/20 text-pink-400"}`}>
                {subscriptionTier === "vvip" ? "VVIP" : "VIP"}
              </span>
            )}
          </div>
          {hasResolvedStrangerProfile && strangerProfile.interests && strangerProfile.interests.length > 0 ? (
            <>
              <p className="truncate text-[11px] text-white/30">
                {isConnecting
                  ? connectingStatus
                  : `${modeLabel} · ${genderLabel} · ${ageLabel}`}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {strangerProfile.interests.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-medium text-pink-300/80 border border-pink-500/15">
                    {tag}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="truncate text-[11px] text-white/30">
              {isConnecting
                ? connectingStatus
                : `${modeLabel} · ${genderLabel} · ${ageLabel}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Filter button */}
          <button
            type="button"
            onClick={() => setShowChatFilters(true)}
            className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/60 active:scale-[0.95]"
            aria-label="Filters"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
            {chatFilterActiveCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[9px] font-bold text-white">{chatFilterActiveCount}</span>
            )}
          </button>

          {showNextStrangerPrompt ? (
            <button
              onClick={onNextStranger}
              className="btn-action btn-action-emerald animate-pop-in flex h-8 items-center gap-1 rounded-lg bg-emerald-500 px-4 text-[11px] font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all duration-150 hover:bg-emerald-400 hover:shadow-[0_0_18px_rgba(16,185,129,0.35)]"
            >
              Next
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6"/></svg>
            </button>
          ) : !isConnecting ? (
            <>
              {!showLeaveConfirm ? (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="btn-action btn-action-rose flex h-8 items-center rounded-lg bg-rose-500 px-3 text-[11px] font-bold text-white transition-all duration-150 hover:bg-rose-400"
                >
                  Leave
                </button>
              ) : (
                <div className="flex items-center gap-1.5 animate-pop-in">
                  <span className="text-[11px] font-semibold text-white/40">Sure?</span>
                  <button onClick={() => { setShowLeaveConfirm(false); if (chatFilters) onLeaveChat(chatFilters); }} className="btn-action btn-action-pink h-7 rounded-lg bg-pink-500 px-3 text-[11px] font-bold text-white transition-all duration-150 hover:bg-pink-400">Yes</button>
                  <button onClick={() => setShowLeaveConfirm(false)} className="btn-action btn-action-ghost h-7 rounded-lg bg-white/[0.08] px-3 text-[11px] font-semibold text-white/60 transition-all duration-150 hover:bg-white/[0.14]">No</button>
                </div>
              )}
            </>
          ) : null}
          <button
            onClick={toggleFullscreen}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/60 active:scale-[0.95]"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            )}
          </button>
        </div>
      </header>

      {/* ─── Messages ─── */}
      <div
        ref={messagesViewportRef}
        onScroll={handleMessagesScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5 overscroll-contain will-change-scroll [transform:translateZ(0)]"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {/* Connecting state */}
          {isConnecting && (
            <div className="animate-fade-in-up flex justify-center py-10">
              <div className="flex flex-col items-center gap-5">
                <svg className="h-24 w-24" viewBox="0 0 50 50" style={{ animation: "search-spin 1.4s linear infinite" }}>
                  <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                  <circle cx="25" cy="25" r="20" fill="none" stroke="url(#search-grad-txt)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "search-dash 1.6s ease-in-out infinite" }} />
                  <defs><linearGradient id="search-grad-txt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="rgb(236,72,153)" /><stop offset="100%" stopColor="rgb(167,139,250)" /></linearGradient></defs>
                </svg>
                <div className="text-center" style={{ animation: "search-text-in 0.4s ease-out both" }}>
                  <p className="text-sm font-medium text-white/70">Finding someone...</p>
                  <p className="mt-1 text-xs text-white/35">{connectingStatus}</p>
                </div>
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg) => {
            // Deleted for everyone
            if (msg.deletedForEveryone) {
              return (
                <div key={msg.id} className={`flex ${msg.author === "you" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex items-center gap-1.5 rounded-2xl border px-4 py-2.5 ${msg.author === "you" ? "border-pink-500/10 bg-pink-500/[0.04]" : "border-blue-500/10 bg-blue-700/[0.04]"}`}>
                    <svg className={`h-3.5 w-3.5 ${msg.author === "you" ? "text-pink-400/30" : "text-blue-400/30"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                    <span className={`text-[13px] italic ${msg.author === "you" ? "text-pink-300/40" : "text-blue-300/40"}`}>{msg.author === "you" ? "You deleted this message" : "This message was deleted"}</span>
                  </div>
                </div>
              );
            }

            const isImageDeletedEvent = msg.imageDeleted || msg.text === IMAGE_DELETED_NOTICE;

            if (isImageDeletedEvent) {
              return (
                <div key={msg.id} className={`flex ${msg.author === "you" ? "justify-end" : "justify-start"}`}>
                  <p className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/40">
                    {IMAGE_DELETED_NOTICE}
                  </p>
                </div>
              );
            }

            const remainingSeconds =
              typeof msg.imageExpiresAtMs === "number" && msg.imageExpiresAtMs > nowMs
                ? Math.ceil((msg.imageExpiresAtMs - nowMs) / 1000)
                : null;
            const senderImageExpired =
              msg.author === "you" &&
              msg.imageViewTimerSeconds !== undefined &&
              msg.imageViewTimerSeconds > 0 &&
              typeof msg.imageExpiresAtMs === "number" &&
              remainingSeconds === null;
            const senderImageViewed =
              msg.author === "you" &&
              msg.imageViewTimerSeconds !== undefined &&
              msg.imageViewTimerSeconds > 0 &&
              (typeof msg.imageExpiresAtMs === "number" || typeof msg.imageRevealAtMs === "number");

            const isYou = msg.author === "you";
            const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
            const bubbleBg = isYou ? "bg-pink-950" : "bg-blue-950";
            const bubbleStyle = undefined;

            return (
              <div key={msg.id} className={`flex ${isYou ? "justify-end" : "justify-start"} ${isYou ? "animate-slide-in-right" : "animate-slide-in-left"}`}>
                <div className={`group/msg relative flex max-w-[82%] flex-col gap-1 sm:max-w-[70%] ${isYou ? "items-end" : "items-start"}`}>
                  {/* Reply quote */}
                  {msg.replyToId && msg.replyToText && (
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`msg-${msg.replyToId}`);
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                          el.classList.add("ring-2", isYou ? "ring-pink-400/50" : "ring-blue-400/50");
                          setTimeout(() => { el.classList.remove("ring-2", "ring-pink-400/50", "ring-blue-400/50"); }, 1500);
                        }
                      }}
                      className={`max-w-full truncate rounded-xl px-3 py-1.5 text-[12px] leading-snug ${
                        isYou
                          ? "bg-pink-400/20 text-white/70 text-right"
                          : "bg-blue-400/20 text-white/70 text-left"
                      }`}
                    >
                      <span className={`block text-[10px] font-semibold ${isYou ? "text-pink-300/80" : "text-blue-300/80"}`}>{msg.replyToAuthor === "you" ? "You" : "Stranger"}</span>
                      <span className="block truncate">{msg.replyToText}</span>
                    </button>
                  )}

                  {/* Message bubble */}
                  <div
                    id={`msg-${msg.id}`}
                    onDoubleClick={() => setActiveEmojiPickerMsgId(activeEmojiPickerMsgId === msg.id ? null : msg.id)}
                    style={bubbleStyle}
                    className={`relative rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed break-words transition-all [overflow-wrap:anywhere] sm:text-[15px] ${
                    isYou
                      ? "rounded-br-sm bg-pink-950 text-white"
                      : `rounded-bl-sm ${bubbleBg ?? ""} text-white`
                  } ${msg.isPending ? "opacity-50" : ""}`}>
                    {msg.text}
                    {msg.image && isYou && !msg.imageDeleted && !senderImageExpired && (
                      <div className="mt-2 space-y-1">
                        <ChatMedia src={msg.image} alt="Sent" mimeType={msg.imageMimeType} className="max-w-full rounded-xl" />
                        {msg.imageViewTimerSeconds && msg.imageViewTimerSeconds > 0 && (
                          <p className="text-[11px] font-medium text-white/70">
                            {senderImageViewed
                              ? remainingSeconds !== null
                                ? `Viewed · ${remainingSeconds}s left`
                                : "Viewed"
                              : "Waiting to be viewed"}
                          </p>
                        )}
                      </div>
                    )}
                    {!msg.image && msg.linkImageUrl && !msg.imageDeleted && (
                      <div className="mt-2">
                        <ChatMedia src={msg.linkImageUrl} alt="Linked image" mimeType={msg.linkImageMimeType} className="max-w-full rounded-xl" />
                      </div>
                    )}
                    {!msg.image && msg.imageUnavailable && (
                      <p className="mt-2 text-xs font-medium text-white/50">Image unavailable</p>
                    )}
                    {!msg.image && msg.imageDecrypting && (
                      <p className="mt-2 text-xs font-medium text-cyan-300/70">Decrypting image...</p>
                    )}
                    {msg.image && isYou && (msg.imageDeleted || senderImageExpired) && null}
                    {msg.image && msg.author === "stranger" && !msg.imageDeleted && (
                      msg.imageViewTimerSeconds && msg.imageViewTimerSeconds > 0 && !revealedTimedImageIds.has(msg.id) ? (
                        <div className="group relative mt-2 block w-full overflow-hidden rounded-xl">
                          <ChatMedia
                            src={msg.image}
                            alt="Timed image"
                            mimeType={msg.imageMimeType}
                            className="max-w-full rounded-xl blur-lg brightness-50 transition"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRevealedTimedImageIds((current) => {
                                const next = new Set(current);
                                next.add(msg.id);
                                return next;
                              });
                              onRevealTimedImage(msg.id, msg.imageViewTimerSeconds ?? 0);
                            }}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white"
                          >
                            <svg className="h-8 w-8 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
                            <span className="text-xs font-bold">{`Tap to view · ${msg.imageViewTimerSeconds}s`}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1">
                          <ChatMedia src={msg.image} alt="Sent" mimeType={msg.imageMimeType} className="max-w-full rounded-xl" />
                          {msg.imageViewTimerSeconds && msg.imageViewTimerSeconds > 0 && remainingSeconds !== null && (
                            <p className="text-[11px] font-medium text-white/60">{remainingSeconds}s left</p>
                          )}
                        </div>
                      )
                    )}
                    {msg.isPending && (
                      <p className="mt-1 text-[11px] font-medium text-white/50">Sending...</p>
                    )}

                    {/* Action buttons — shows on hover */}
                    {!msg.isPending && (
                      <div className={`absolute top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 transition group-hover/msg:opacity-100 ${isYou ? "-left-[4.5rem]" : "-right-[4.5rem]"}`}>
                        <button
                          type="button"
                          onClick={() => onReplyToMessage(msg.id)}
                          className="rounded-full bg-white/[0.08] p-1.5 text-white/30 transition hover:bg-white/[0.15] hover:text-white/60"
                          aria-label="Reply"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 14-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg>
                        </button>
                        {isYou && typeof msg.createdAtMs === "number" && (nowMs - msg.createdAtMs) < 30000 && (
                          <button
                            type="button"
                            onClick={() => onDeleteMessage(msg.id)}
                            className="rounded-full bg-white/[0.08] p-1.5 text-white/30 transition hover:bg-rose-500/20 hover:text-rose-400"
                            aria-label="Delete for everyone"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Emoji picker */}
                  {activeEmojiPickerMsgId === msg.id && (
                    <div className={`animate-pop-in flex gap-1 rounded-full border border-white/[0.08] bg-[#1a1a25] px-2 py-1.5 shadow-2xl ${isYou ? "self-end" : "self-start"}`}>
                      {QUICK_REACTIONS.map((emoji) => {
                        const reacted = msg.reactions?.[emoji]?.includes(currentUserId);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              onReactToMessage(msg.id, emoji);
                              setActiveEmojiPickerMsgId(null);
                            }}
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition hover:scale-110 active:scale-95 ${
                              reacted ? "bg-white/[0.1]" : "hover:bg-white/[0.06]"
                            }`}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Reaction pills */}
                  {hasReactions && (
                    <div className={`flex flex-wrap gap-1 ${isYou ? "justify-end" : "justify-start"}`}>
                      {Object.entries(msg.reactions!).map(([emoji, senderIds]) => {
                        if (!senderIds || senderIds.length === 0) return null;
                        const didReact = senderIds.includes(currentUserId);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => onReactToMessage(msg.id, emoji)}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition active:scale-95 ${
                              didReact
                                ? isYou
                                  ? "border border-pink-500/30 bg-pink-500/[0.1] text-white/80"
                                  : "border border-blue-500/30 bg-blue-500/[0.1] text-white/80"
                                : "border border-white/[0.06] bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
                            }`}
                          >
                            <span>{emoji}</span>
                            {senderIds.length > 1 && <span className="text-[10px]">{senderIds.length}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <span className="px-1 text-[11px] text-white/20">{msg.sentAt}</span>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {!isConnecting && strangerIsTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white/[0.06] px-4 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" style={{ animation: "typing-bounce 1.2s ease-in-out infinite" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-white/30" style={{ animation: "typing-bounce 1.2s ease-in-out 0.15s infinite" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-white/20" style={{ animation: "typing-bounce 1.2s ease-in-out 0.3s infinite" }} />
              </div>
            </div>
          )}

          {/* Scroll to latest */}
          {showScrollToLatestBubble && (
            <div className="pointer-events-none sticky bottom-3 z-10 flex justify-center">
              <button
                type="button"
                onClick={scrollToLatestMessage}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-white/60 shadow-lg backdrop-blur-md transition hover:bg-white/[0.12] hover:text-white/80"
                aria-label="Scroll to latest message"
              >
                {unreadReceivedCount > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white">{unreadReceivedCount}</span>
                    new
                  </span>
                ) : (
                  "Latest"
                )}
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] bg-[#0a0a10] px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:px-4 md:pt-2.5 flex-shrink-0">
        <div className="mx-auto w-full max-w-2xl space-y-2">
          {/* Reply preview */}
          {replyingTo && (
            <div className={`animate-fade-in flex items-center gap-3 rounded-xl border px-3 py-2 ${replyingTo.author === "you" ? "border-pink-500/15 bg-pink-500/[0.04]" : "border-blue-500/15 bg-blue-500/[0.04]"}`}>
              <div className={`min-w-0 flex-1 border-l-2 pl-3 ${replyingTo.author === "you" ? "border-pink-500/40" : "border-blue-500/40"}`}>
                <p className={`text-[11px] font-semibold ${replyingTo.author === "you" ? "text-pink-400/80" : "text-blue-400/80"}`}>{replyingTo.author === "you" ? "You" : "Stranger"}</p>
                <p className="truncate text-xs text-white/50">{replyingTo.text || (replyingTo.image ? "Photo" : "Message")}</p>
              </div>
              <button
                type="button"
                onClick={clearReply}
                className="flex-shrink-0 rounded-lg p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
                aria-label="Cancel reply"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="animate-fade-in relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              {isGifFilename(selectedFileName) ? (
                <img
                  src={imagePreview}
                  alt="Attachment preview"
                  className="h-12 w-12 flex-shrink-0 rounded-lg border border-white/[0.06] object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <Image
                  src={imagePreview}
                  alt="Attachment preview"
                  width={48}
                  height={48}
                  className="h-12 w-12 flex-shrink-0 rounded-lg border border-white/[0.06] object-cover"
                  unoptimized
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white/60" title={selectedFileName ?? "Selected image"}>
                  {selectedFileName ?? "Selected image"}
                </p>
                {isSendingMessage && imageUploadProgress !== null && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-pink-500 transition-all duration-200" style={{ width: `${imageUploadProgress}%` }} />
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-white/30">Timer:</span>
                  {[0, 3, 5, 10, 15].map((seconds) => {
                    const isActive = imageTimerSeconds === seconds;
                    return (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => setImageTimerSeconds?.(seconds)}
                        disabled={isSendingMessage}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${isActive ? "bg-pink-500 text-white" : "bg-white/[0.04] text-white/40 hover:text-white/60"} disabled:opacity-30`}
                      >
                        {seconds === 0 ? "Off" : `${seconds}s`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={clearAttachment}
                disabled={isSendingMessage}
                className="flex-shrink-0 rounded-lg p-2 text-white/30 transition hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-30"
                aria-label="Remove image"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-end gap-2">
              <button
                disabled={isSendingMessage}
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.05] hover:text-white/60 active:scale-[0.95] disabled:opacity-20"
                aria-label="Upload image"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5" /></svg>
              </button>

            <div className="relative flex min-h-[44px] flex-1 items-center rounded-xl border border-white/[0.06] bg-white/[0.03] transition-colors focus-within:border-white/15 focus-within:bg-white/[0.05]">
              <input
                ref={messageInputRef}
                type="text"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || isSendingMessage || e.nativeEvent.isComposing) {
                    return;
                  }
                  e.preventDefault();
                  sendMessage();
                }}
                placeholder={isConnecting ? "Finding someone..." : "Message..."}
                disabled={isSendingMessage}
                className="h-full w-full bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/20"
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={isSendingMessage || (!text.trim() && !imagePreview)}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-pink-500 text-white transition hover:bg-pink-400 active:scale-[0.95] disabled:opacity-15"
            >
              {isSendingMessage ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
              ) : (
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              )}
            </button>
          </div>

          {sendError && (
            <p className="animate-fade-in px-1 text-xs font-medium text-rose-400/80">{sendError}</p>
          )}
        </div>
      </footer>

      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={onSelectImage} />

      {renderChatFilterPanel()}
    </section>
  );
}