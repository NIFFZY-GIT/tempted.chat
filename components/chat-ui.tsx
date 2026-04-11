"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";

export type ChatMessage = {
  id: string;
  author: "you" | "stranger";
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
  sentAt: string;
};

export type ProfileGender = "Male" | "Female" | "Other";
export type UserProfile = { gender: ProfileGender; age: number; country?: string; countryCode?: string };
export type ChatMode = "text" | "video" | "group";
export type GenderFilter = "Any" | ProfileGender;
export type AgeGroupFilter = "Any age" | "Under 18" | "18-25" | "25+";
export type ChatStyleFilter = "Any style" | "Casual" | "Intimate";
export type CountryFilter = "Any" | "US" | "GB" | "IN" | "DE" | "FR" | "ES" | "IT" | "BR" | "CA" | "AU" | "JP" | "KR" | "LK";
export type ChatFilters = {
  gender: GenderFilter;
  ageGroup: AgeGroupFilter;
  style: ChatStyleFilter;
  country: CountryFilter;
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
  loginWithGoogle,
  loginWithEmail,
  resetPassword,
}: AuthViewProps) {
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
        <button
          onClick={loginAnonymously}
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
}: {
  onStart: (mode: ChatMode, filters: ChatFilters) => void;
  onBack: () => void;
}) {
  const [selectedMode, setSelectedMode] = useState<ChatMode>("text");
  const [showFilters, setShowFilters] = useState(false);
  const [gender, setGender] = useState<GenderFilter>("Any");
  const [ageGroup, setAgeGroup] = useState<AgeGroupFilter>("Any age");
  const [style, setStyle] = useState<ChatStyleFilter>("Any style");
  const [country, setCountry] = useState<CountryFilter>("Any");
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
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

  const modeOptions: Array<{ id: ChatMode; label: string; desc: string; icon: ReactNode; color: string; activeBg: string }> = [
    {
      id: "text",
      label: "Text",
      desc: "Message chat",
      color: "text-cyan-400",
      activeBg: "border-cyan-500/30 bg-cyan-500/[0.08]",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
        </svg>
      ),
    },
    {
      id: "video",
      label: "Video",
      desc: "Face to face",
      color: "text-rose-400",
      activeBg: "border-rose-500/30 bg-rose-500/[0.08]",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 10.5 20 7v10l-5-3.5" />
          <rect x="3" y="6" width="12" height="12" rx="2.5" />
        </svg>
      ),
    },
    {
      id: "group",
      label: "Groups",
      desc: "Multi-person",
      color: "text-amber-400",
      activeBg: "border-amber-500/30 bg-amber-500/[0.08]",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="8" cy="9" r="2.5" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M4.5 18a3.5 3.5 0 0 1 7 0M12.5 18a3.5 3.5 0 0 1 7 0" />
        </svg>
      ),
    },
  ];

  const handleStart = () => {
    onStart(selectedMode, { gender, ageGroup, style, country });
  };

  const handleQuickStart = () => {
    onStart("text", { gender: "Any", ageGroup: "Any age", style: "Any style", country: "Any" });
  };

  const pillClasses = (active: boolean) =>
    `rounded-xl py-2.5 text-sm font-medium transition-all active:scale-[0.97] ${active ? "bg-white/[0.1] text-white ring-1 ring-white/20" : "bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60"}`;

  return (
    <section className="w-full max-w-sm animate-fade-in-up px-4">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white">Ready to chat?</h2>
        <p className="mt-1.5 text-sm text-white/40">Choose your mode</p>
      </div>

      {/* Mode cards */}
      <div className="space-y-2">
        {modeOptions.map((m) => {
          const active = selectedMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMode(m.id)}
              className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all active:scale-[0.98] ${active ? m.activeBg : "border-white/[0.07] bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]"}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.05] ${active ? m.color : "text-white/30"}`}>
                {m.icon}
              </span>
              <div>
                <span className={`block text-[15px] font-semibold ${active ? "text-white" : "text-white/60"}`}>{m.label}</span>
                <span className={`block text-xs ${active ? "text-white/50" : "text-white/25"}`}>{m.desc}</span>
              </div>
              {active && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                  <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Start */}
      <button
        type="button"
        onClick={handleQuickStart}
        className="mt-5 w-full rounded-xl bg-pink-500 py-3.5 text-[15px] font-bold text-white transition hover:bg-pink-400 active:scale-[0.98]"
      >
        Quick Start
      </button>

      {/* Filter toggle */}
      <button
        type="button"
        onClick={() => setShowFilters((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-white/30 transition hover:text-white/60"
      >
        {showFilters ? "Hide preferences" : "Set preferences"}
        <svg className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {/* Collapsible filters */}
      {showFilters && (
        <div className="animate-fade-in space-y-4 pt-2">
          {/* Age group */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/30">Age</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(["Any age", "Under 18", "18-25", "25+"] as AgeGroupFilter[]).map((option) => (
                <button key={option} type="button" onClick={() => setAgeGroup((c) => (c === option ? "Any age" : option))} className={pillClasses(ageGroup === option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/30">Style</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["Any style", "Casual", "Intimate"] as ChatStyleFilter[]).map((option) => (
                <button key={option} type="button" onClick={() => setStyle((c) => (c === option ? "Any style" : option))} className={pillClasses(style === option)}>
                  {option === "Any style" ? "Any" : option}
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/30">Gender</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(["Any", "Male", "Female", "Other"] as GenderFilter[]).map((option) => (
                <button key={option} type="button" onClick={() => setGender((c) => (c === option ? "Any" : option))} className={pillClasses(gender === option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Country */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/30">Country</p>
            <div className="relative" ref={countryMenuRef}>
              <button
                type="button"
                onClick={() => setCountryMenuOpen((c) => !c)}
                className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06]"
              >
                <span className="inline-flex items-center gap-2.5">
                  <CountryFlagIcon countryCode={selectedCountryCode} className="h-3.5 w-5 rounded-[2px] object-cover" />
                  <span>{country === "Any" ? "Any country" : getCountryLabel(country)}</span>
                </span>
                <svg className={`h-3.5 w-3.5 text-white/30 transition-transform ${countryMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              {countryMenuOpen && (
                <div className="absolute z-30 mt-1.5 max-h-52 w-full overflow-y-auto rounded-xl border border-white/[0.08] bg-[#12121a] p-1 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => { setCountry("Any"); setCountryMenuOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${country === "Any" ? "bg-white/[0.08] text-white" : "text-white/60 hover:bg-white/[0.06]"}`}
                  >
                    <CountryFlagIcon className="h-3.5 w-5 rounded-[2px] object-cover" />
                    Any country
                  </button>
                  {COUNTRY_OPTIONS.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => { setCountry(option.code); setCountryMenuOpen(false); }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${country === option.code ? "bg-white/[0.08] text-white" : "text-white/60 hover:bg-white/[0.06]"}`}
                    >
                      <CountryFlagIcon countryCode={option.code} className="h-3.5 w-5 rounded-[2px] object-cover" />
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Start with preferences */}
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-xl border border-pink-500/25 bg-pink-500/[0.08] py-3 text-sm font-bold text-pink-300 transition hover:bg-pink-500/15 active:scale-[0.98]"
          >
            Start with Preferences
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-4 w-full py-2 text-xs font-medium text-white/25 transition hover:text-white/50"
      >
        Sign Out
      </button>
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
  const [revealedTimedImageIds, setRevealedTimedImageIds] = useState<Set<string>>(new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());

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

  useEffect(() => {
    if (!isSendingMessage && !isConnecting) {
      messageInputRef.current?.focus();
    }
  }, [isConnecting, isSendingMessage]);

  return (
    <section
      ref={chatContainerRef}
      className={`${isFullscreen ? "fixed inset-0 z-50 mt-0 h-dvh rounded-none" : "mt-0 h-[calc(100dvh-5.5rem)] rounded-2xl sm:h-[calc(100dvh-6rem)] md:rounded-3xl"} relative flex w-full max-w-none flex-col overflow-hidden border border-white/[0.06] bg-[#0a0a10] shadow-[0_8px_40px_rgba(0,0,0,0.5)]`}
    >
      {/* ─── Header ─── */}
      <header className="flex items-center gap-2 border-b border-white/[0.06] bg-[#0d0d14]/90 px-2.5 py-2 backdrop-blur-md sm:px-4 sm:py-2.5">
        {!showBackConfirm ? (
          <button
            onClick={() => setShowBackConfirm(true)}
            className="flex h-8 items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-white/50 transition hover:bg-white/[0.08] hover:text-white/70 active:scale-[0.97]"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
        ) : (
          <div className="flex items-center gap-1.5 animate-fade-in">
            <span className="text-[11px] font-semibold text-white/40">Sure?</span>
            <button onClick={() => { setShowBackConfirm(false); onChangeMode(); }} className="h-7 rounded-lg bg-pink-500 px-3 text-[11px] font-bold text-white transition hover:bg-pink-400 active:scale-[0.97]">Yes</button>
            <button onClick={() => setShowBackConfirm(false)} className="h-7 rounded-lg bg-white/[0.08] px-3 text-[11px] font-semibold text-white/60 transition hover:bg-white/[0.12] active:scale-[0.97]">No</button>
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
            <span className="text-sm font-semibold text-white/90">Stranger</span>
            {hasResolvedStrangerProfile && (
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <CountryFlagIcon countryCode={strangerProfile.countryCode} className="h-3 w-4 rounded-[1px] object-cover" />
                {strangerProfile.gender}, {strangerProfile.age}
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-white/30">
            {isConnecting ? connectingStatus : `${modeLabel} · ${genderLabel} · ${ageLabel}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {showNextStrangerPrompt && (
            <button
              onClick={onNextStranger}
              className="flex h-8 items-center gap-1 rounded-lg bg-emerald-500/15 px-3 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/25 active:scale-[0.97]"
            >
              Next
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 6 6 6-6 6"/></svg>
            </button>
          )}
          {!showLeaveConfirm ? (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="flex h-8 items-center rounded-lg bg-rose-500 px-3 text-[11px] font-bold text-white transition hover:bg-rose-400 active:scale-[0.97]"
            >
              Leave
            </button>
          ) : (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <span className="text-[11px] font-semibold text-white/40">Sure?</span>
              <button onClick={() => { setShowLeaveConfirm(false); if (chatFilters) onLeaveChat(chatFilters); }} className="h-7 rounded-lg bg-pink-500 px-3 text-[11px] font-bold text-white transition hover:bg-pink-400 active:scale-[0.97]">Yes</button>
              <button onClick={() => setShowLeaveConfirm(false)} className="h-7 rounded-lg bg-white/[0.08] px-3 text-[11px] font-semibold text-white/60 transition hover:bg-white/[0.12] active:scale-[0.97]">No</button>
            </div>
          )}
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
        className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {/* Video section */}
          {chatMode === "video" && (
            <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/40">
              <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
                <div className="relative bg-black">
                  <video ref={remoteVideoRef} autoPlay playsInline className="aspect-[3/4] h-full w-full object-cover sm:aspect-[4/3]" />
                  {!hasRemoteVideo && (
                    <div className="absolute inset-0 grid place-items-center bg-black/70 text-center text-xs font-medium text-white/50">
                      Waiting for stranger&apos;s camera...
                    </div>
                  )}
                  <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-sm">Stranger</span>
                </div>
                <div className="relative bg-black">
                  <video ref={localVideoRef} autoPlay playsInline muted className="aspect-[3/4] h-full w-full object-cover sm:aspect-[4/3]" />
                  {!localVideoEnabled && (
                    <div className="absolute inset-0 grid place-items-center bg-black/70 text-center text-xs font-medium text-white/50">
                      Camera off
                    </div>
                  )}
                  <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-sm">You</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 px-3 py-3">
                <button
                  type="button"
                  onClick={toggleLocalAudio}
                  aria-label={localAudioEnabled ? "Mute microphone" : "Unmute microphone"}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${localAudioEnabled ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25" : "bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25"}`}
                >
                  {localAudioEnabled ? (
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></svg>
                  ) : (
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 4 16 16" /><path d="M9 9v3a3 3 0 0 0 5.14 2.14" /><path d="M15 6a3 3 0 0 0-5.08-2.2" /><path d="M19 10v2a7 7 0 0 1-1.6 4.49" /><path d="M5 10v2a7 7 0 0 0 11.98 4.95" /></svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={toggleLocalVideo}
                  aria-label={localVideoEnabled ? "Turn off camera" : "Turn on camera"}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${localVideoEnabled ? "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25" : "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25"}`}
                >
                  {localVideoEnabled ? (
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="12" height="10" rx="2" /><path d="m15 10 6-3v10l-6-3" /></svg>
                  ) : (
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 2 20 20" /><rect x="3" y="7" width="12" height="10" rx="2" /><path d="m15 10 6-3v10l-6-3" /></svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={switchCamera}
                  aria-label="Switch camera"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white/60 ring-1 ring-white/[0.08] transition hover:bg-white/[0.12]"
                >
                  <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 4h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1" /><path d="M7 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h1" /><path d="m8 9 3-3 3 3" /><path d="m16 15-3 3-3-3" /><path d="M11 6h2v12h-2" /></svg>
                </button>
              </div>

              {videoError && (
                <p className="border-t border-rose-500/15 bg-rose-500/[0.06] px-4 py-2.5 text-xs font-medium text-rose-300">{videoError}</p>
              )}
            </section>
          )}

          {/* Connecting state */}
          {isConnecting && (
            <div className="animate-fade-in-up flex justify-center py-10">
              <div className="flex flex-col items-center gap-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-pink-400" style={{ animation: "typing-bounce 1.2s ease-in-out infinite" }} />
                  <span className="h-2 w-2 rounded-full bg-pink-400/70" style={{ animation: "typing-bounce 1.2s ease-in-out 0.15s infinite" }} />
                  <span className="h-2 w-2 rounded-full bg-pink-400/40" style={{ animation: "typing-bounce 1.2s ease-in-out 0.3s infinite" }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white/70">Finding someone...</p>
                  <p className="mt-1 text-xs text-white/35">{connectingStatus}</p>
                </div>
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg) => {
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

            return (
              <div key={msg.id} className={`flex ${isYou ? "justify-end" : "justify-start"} ${isYou ? "animate-slide-in-right" : "animate-slide-in-left"}`}>
                <div className={`flex max-w-[82%] flex-col gap-1 sm:max-w-[70%] ${isYou ? "items-end" : "items-start"}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed break-words [overflow-wrap:anywhere] sm:text-[15px] ${
                    isYou
                      ? "rounded-br-sm bg-pink-500 text-white"
                      : "rounded-bl-sm bg-white/[0.06] text-white/85"
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
                  </div>
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
      <footer className="border-t border-white/[0.06] bg-[#0a0a10] px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:px-4 md:pt-2.5">
        <div className="mx-auto w-full max-w-2xl space-y-2">
          {/* Image preview */}
          {chatMode !== "video" && imagePreview && (
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
            {chatMode !== "video" && (
              <button
                disabled={isSendingMessage}
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.05] hover:text-white/60 active:scale-[0.95] disabled:opacity-20"
                aria-label="Upload image"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5" /></svg>
              </button>
            )}

            <div className="relative flex min-h-[44px] flex-1 items-center rounded-xl border border-white/[0.06] bg-white/[0.03] transition-colors focus-within:border-white/15 focus-within:bg-white/[0.05]">
              <input
                ref={messageInputRef}
                type="text"
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
              disabled={isSendingMessage || (!text.trim() && (chatMode === "video" || !imagePreview))}
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
    </section>
  );
}