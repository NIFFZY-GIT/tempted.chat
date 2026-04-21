"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";

import { TierLogo } from "@/components/tier-logo";
import { ChatFiltersPanel } from "./chat-ui/chat-filters-panel";
import { ChatRoomTextView } from "./chat-ui/chat-room-text-view";
import { ChatRoomVideoView } from "./chat-ui/chat-room-video-view";
export { AuthView } from "@/components/chat-ui/auth-view";
export { ModeAndFiltersView } from "./chat-ui/mode-and-filters-view";

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
export type CountryFilter = "Any" | string;
export type ChatFilters = {
  gender: GenderFilter;
  ageGroup: AgeGroupFilter;
  style: ChatStyleFilter;
  country: CountryFilter;
  hideCountry?: boolean;
};

export type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export const starterMessages: ChatMessage[] = [
  { id: "1", author: "stranger", text: "Hey! What music are you into?", sentAt: "10:14 PM" },
  { id: "2", author: "you", text: "Mostly electronic. You?", sentAt: "10:15 PM" },
];

export const IMAGE_DELETED_NOTICE = "Timer ran out. Image deleted.";

const isGifMimeType = (mimeType?: string): boolean => mimeType?.toLowerCase() === "image/gif";

export const isGifFilename = (fileName?: string | null): boolean => {
  if (!fileName) {
    return false;
  }

  return fileName.trim().toLowerCase().endsWith(".gif");
};

export function ChatMedia({
  src,
  alt,
  className,
  mimeType,
}: {
  src: string;
  alt: string;
  className?: string;
  mimeType?: string;
}) {
  if (isGifMimeType(mimeType)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className ?? ""} loading="lazy" decoding="async" />;
  }
  return <Image src={src} alt={alt} width={300} height={200} className={className ?? ""} unoptimized />;
}

const pickRandomGender = (): ProfileGender => {
  const genders: ProfileGender[] = ["Male", "Female", "Other"];
  return genders[Math.floor(Math.random() * genders.length)];
};

const buildCountryOptions = (): Array<{ code: string; label: string }> => {
  let displayNames: Intl.DisplayNames;
  try {
    displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return [
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
  }

  const options: Array<{ code: string; label: string }> = [];
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = `${String.fromCharCode(first)}${String.fromCharCode(second)}`;
      const label = displayNames.of(code);
      if (!label || label === code) {
        continue;
      }

      // Avoid macro-regions and unknown placeholders so only concrete countries appear.
      if (/^world|unknown|outlying|european union$/i.test(label)) {
        continue;
      }

      options.push({ code, label });
    }
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
};

export const COUNTRY_OPTIONS: Array<{ code: string; label: string }> = buildCountryOptions();

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

export const getCountryLabel = (countryCode: string): string => {
  if (countryCode === "Any") {
    return "Any country";
  }

  return getCountryDisplayName(countryCode);
};

const pickRandomCountryCode = (): string => {
  const countryCodes = COUNTRY_OPTIONS.map((option) => option.code);
  return countryCodes[Math.floor(Math.random() * countryCodes.length)];
};

const getFlagIconUrl = (countryCode?: string): string | null => {
  const normalizedCode = normalizeCountryCode(countryCode);
  if (!normalizedCode) {
    return null;
  }

  return `https://flagcdn.com/24x18/${normalizedCode.toLowerCase()}.png`;
};

export function CountryFlagIcon({ countryCode, className }: { countryCode?: string | null; className?: string }) {
  const iconUrl = getFlagIconUrl(countryCode ?? undefined);
  const normalizedCode = normalizeCountryCode(countryCode ?? undefined);

  if (!iconUrl || !normalizedCode) {
    return <span className={className ?? ""}>🌐</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
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

export function GenderIcon({ gender }: { gender?: ProfileGender | null }) {
  const resolvedGender: ProfileGender = gender === "Male" || gender === "Female" || gender === "Other" ? gender : "Other";
  if (resolvedGender === "Male") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="9" cy="15" r="5" />
        <path d="M12.5 11.5 19 5m-5 0h5v5" />
      </svg>
    );
  }

  if (resolvedGender === "Female") {
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

/* AuthView moved to components/chat-ui/auth-view.tsx */

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ModeAndFiltersViewLegacy({
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
  void onBack;
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

  const collectInterests = () => {
    const all = [...interests];
    // Also grab any uncommitted text from the input (may contain commas)
    interestsInput.split(",").forEach((s) => {
      const tag = s.trim().toLowerCase();
      if (tag && !all.includes(tag) && all.length < 10) {
        all.push(tag);
      }
    });
    return all.length > 0 ? all : undefined;
  };

  const handleStart = () => {
    onStart(selectedMode, { gender, ageGroup, style, country, hideCountry }, undefined, collectInterests());
  };

  const handleApplyLegacyFilters = () => {
    setShowFilters(false);
    handleStart();
  };

  const handleQuickStart = () => {
    onStart(selectedMode, { gender: "Any", ageGroup: "Any age", style: "Any style", country: "Any", hideCountry }, undefined, collectInterests());
  };

  const activeFiltersCount = [
    gender !== "Any",
    ageGroup !== "Any age",
    style !== "Any style",
    country !== "Any",
    hideCountry,
  ].filter(Boolean).length;

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
    chipColor: "blue" | "violet" | "pink";
  }> = [
    {
      id: "text",
      emoji: "💬",
      title: "Text Chat",
      sub: "Messages, photos & fun",
      desc: "Send messages, share photos, and have fun conversations",
      accent: "text-blue-400",
      accentRgb: "59,130,246",
      bg: "bg-blue-500/[0.06]",
      border: "border-blue-500/30",
      glow: "shadow-[0_0_40px_rgba(59,130,246,0.15),0_4px_24px_rgba(59,130,246,0.1)]",
      ring: "ring-blue-500/20",
      iconBg: "bg-gradient-to-br from-blue-500/20 to-blue-600/10",
      badgeBg: "bg-blue-500",
      chipColor: "blue",
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
              className="h-auto w-[160px] sm:w-[200px]"
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
            className="group relative inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[12px] font-semibold text-white/30 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/50 active:scale-[0.97]"
            aria-label={!hasActiveSubscription ? "Unlock filters" : "Filters"}
          >
            <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            <span>{!hasActiveSubscription ? "Unlock filters" : "Filters"}</span>
            {!hasActiveSubscription ? (
              <TierLogo tier="vvip" size="xs" className="rounded-full bg-amber-400/10 px-1.5 py-1 ring-1 ring-amber-400/15" />
            ) : subscriptionTier ? (
              <TierLogo
                tier={subscriptionTier}
                size="xs"
                className={`rounded-full px-1.5 py-1 ring-1 ${subscriptionTier === "vvip" ? "bg-amber-400/10 ring-amber-400/15" : "bg-pink-500/10 ring-pink-500/15"}`}
              />
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

      <ChatFiltersPanel
        showChatFilters={showFilters}
        setShowChatFilters={setShowFilters}
        hasActiveSubscription={hasActiveSubscription}
        onShowPaywall={onShowPaywall}
        filterGender={gender}
        setFilterGender={setGender}
        filterStyle={style}
        setFilterStyle={setStyle}
        filterHideCountry={hideCountry}
        setFilterHideCountry={setHideCountry}
        subscriptionTier={subscriptionTier}
        filterAgeGroup={ageGroup}
        setFilterAgeGroup={setAgeGroup}
        filterCountryMenuRef={countryMenuRef}
        filterCountryMenuOpen={countryMenuOpen}
        setFilterCountryMenuOpen={setCountryMenuOpen}
        filterSelectedCountryCode={selectedCountryCode}
        CountryFlagIcon={CountryFlagIcon}
        filterCountry={country}
        setFilterCountry={setCountry}
        COUNTRY_OPTIONS={COUNTRY_OPTIONS}
        getCountryLabel={getCountryLabel}
        handleApplyFilters={handleApplyLegacyFilters}
      />

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
  isDemoMode,
  remoteAudioEnabled,
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
  isDemoMode: boolean;
  remoteAudioEnabled: boolean;
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
  void isDemoMode;
  const chatContainerRef = useRef<HTMLElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const shouldAutoScrollRef = useRef(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);
  const [showScrollToLatestBubble, setShowScrollToLatestBubble] = useState(false);
  const [unreadReceivedCount, setUnreadReceivedCount] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [showVideoChatOverlay, setShowVideoChatOverlay] = useState(false);
  const [revealedTimedImageIds, setRevealedTimedImageIds] = useState<Set<string>>(new Set());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);
  const [expandedActionMsgId, setExpandedActionMsgId] = useState<string | null>(null);
  const [swipePreview, setSwipePreview] = useState<{ id: string; offset: number } | null>(null);
  const suppressNextMessageTapRef = useRef(false);
  const swipeStateRef = useRef<{ id: string | null; pointerId: number | null; startX: number; startY: number; dragging: boolean; triggered: boolean }>({
    id: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    dragging: false,
    triggered: false,
  });
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

  const SWIPE_REPLY_TRIGGER_PX = 56;
  const SWIPE_REPLY_MAX_PX = 84;

  const modeLabel = chatMode === "text" ? "Text" : chatMode === "video" ? "Video" : "Group";
  const genderLabel = chatFilters?.gender && chatFilters.gender !== "Any" ? chatFilters.gender : "Any gender";
  const hasResolvedStrangerProfile = !isConnecting && strangerProfile.age > 0;

  const chatFilterActiveCount = [
    chatFilters?.gender !== "Any" && chatFilters?.gender,
    chatFilters?.ageGroup !== "Any age" && chatFilters?.ageGroup,
    chatFilters?.style !== "Any style" && chatFilters?.style,
    chatFilters?.country !== "Any" && chatFilters?.country,
    chatFilters?.hideCountry,
  ].filter(Boolean).length;
  const isFullscreenActive = isFullscreen || isFallbackFullscreen;

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

  const renderChatFilterPanel = () => (
    <ChatFiltersPanel
      showChatFilters={showChatFilters}
      setShowChatFilters={setShowChatFilters}
      hasActiveSubscription={hasActiveSubscription}
      onShowPaywall={onShowPaywall}
      filterGender={filterGender}
      setFilterGender={setFilterGender}
      filterStyle={filterStyle}
      setFilterStyle={setFilterStyle}
      filterHideCountry={filterHideCountry}
      setFilterHideCountry={setFilterHideCountry}
      subscriptionTier={subscriptionTier}
      filterAgeGroup={filterAgeGroup}
      setFilterAgeGroup={setFilterAgeGroup}
      filterCountryMenuRef={filterCountryMenuRef}
      filterCountryMenuOpen={filterCountryMenuOpen}
      setFilterCountryMenuOpen={setFilterCountryMenuOpen}
      filterSelectedCountryCode={filterSelectedCountryCode}
      CountryFlagIcon={CountryFlagIcon}
      filterCountry={filterCountry}
      setFilterCountry={setFilterCountry}
      COUNTRY_OPTIONS={COUNTRY_OPTIONS}
      getCountryLabel={getCountryLabel}
      handleApplyFilters={handleApplyFilters}
    />
  );

  const isNearBottom = (viewport: HTMLDivElement): boolean => {
    const distanceFromBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
    return distanceFromBottom <= 72;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as FullscreenCapableDocument;
      const hasNativeFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(hasNativeFullscreen);
      if (hasNativeFullscreen) {
        setIsFallbackFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);
    };
  }, []);

  const toggleFullscreen = async () => {
    const doc = document as FullscreenCapableDocument;

    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } catch {
        setIsFallbackFullscreen(false);
      }
      return;
    }

    if (isFallbackFullscreen) {
      setIsFallbackFullscreen(false);
      return;
    }

    const target = chatContainerRef.current as FullscreenCapableElement | null;
    try {
      if (target?.requestFullscreen) {
        await target.requestFullscreen();
        return;
      }

      if (target?.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
        return;
      }
    } catch {
      // Fallback below for environments that block Fullscreen API (common on iOS).
    }

    setIsFallbackFullscreen(true);
  };

  useEffect(() => {
    if (!isFallbackFullscreen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFallbackFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isFallbackFullscreen]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    window.requestAnimationFrame(() => {
      setShowScrollToLatestBubble(false);
      setUnreadReceivedCount(0);
    });
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

  const resetSwipeState = () => {
    swipeStateRef.current = {
      id: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      dragging: false,
      triggered: false,
    };
    setSwipePreview(null);
  };

  const handleMessagePointerDown = (messageId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    swipeStateRef.current = {
      id: messageId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      triggered: false,
    };
  };

  const handleMessagePointerMove = (messageId: string, authoredByCurrentUser: boolean, event: React.PointerEvent<HTMLDivElement>) => {
    const swipeState = swipeStateRef.current;
    if (swipeState.id !== messageId || swipeState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - swipeState.startX;
    const deltaY = event.clientY - swipeState.startY;
    const directionalDeltaX = authoredByCurrentUser ? -deltaX : deltaX;

    if (!swipeState.dragging) {
      if (Math.abs(directionalDeltaX) < 8 && Math.abs(deltaY) < 8) {
        return;
      }

      if (Math.abs(directionalDeltaX) <= Math.abs(deltaY) || directionalDeltaX <= 0) {
        resetSwipeState();
        return;
      }

      swipeState.dragging = true;
      setExpandedActionMsgId(null);
    }

    const clampedOffset = Math.max(0, Math.min(directionalDeltaX, SWIPE_REPLY_MAX_PX));
    setSwipePreview({ id: messageId, offset: authoredByCurrentUser ? -clampedOffset : clampedOffset });

    if (!swipeState.triggered && clampedOffset >= SWIPE_REPLY_TRIGGER_PX) {
      swipeState.triggered = true;
      suppressNextMessageTapRef.current = true;
      onReplyToMessage(messageId);
    }
  };

  const handleMessageTap = (messageId: string) => {
    if (suppressNextMessageTapRef.current) {
      suppressNextMessageTapRef.current = false;
      return;
    }

    setActiveEmojiPickerMsgId(null);
    setExpandedActionMsgId((current) => current === messageId ? null : messageId);
  };

  const handleMessagePointerEnd = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore pointer capture release races.
      }
    }

    resetSwipeState();
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
    if (!expandedActionMsgId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setExpandedActionMsgId((current) => current === expandedActionMsgId ? null : current);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [expandedActionMsgId]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
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
    });
  }, [messages]);

  /* ─── Stable vh for mobile keyboards ─── */
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty("--vh", `${vv.height * 0.01}px`);
      const keyboardOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--keyboard-offset");
    };
  }, []);

  useEffect(() => {
    const input = messageInputRef.current;
    if (!input) {
      return;
    }

    const ensureInputVisible = () => {
      window.setTimeout(() => {
        input.scrollIntoView({ block: "nearest", inline: "nearest" });
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }, 140);
    };

    input.addEventListener("focus", ensureInputVisible);
    return () => {
      input.removeEventListener("focus", ensureInputVisible);
    };
  }, [chatMode]);

  useEffect(() => {
    if (!isSendingMessage && !isConnecting) {
      messageInputRef.current?.focus({ preventScroll: true });
    }
  }, [isConnecting, isSendingMessage]);

  /* Split visual branches into dedicated components while keeping shared state/orchestration here. */
  const chatFiltersPanel = renderChatFilterPanel();

  if (chatMode === "video") {
    return (
      <ChatRoomVideoView
        chatContainerRef={chatContainerRef}
        remoteVideoRef={remoteVideoRef}
        localVideoRef={localVideoRef}
        isConnecting={isConnecting}
        hasResolvedStrangerProfile={hasResolvedStrangerProfile}
        remoteAudioEnabled={remoteAudioEnabled}
        hasRemoteVideo={hasRemoteVideo}
        connectingStatus={connectingStatus}
        showNextStrangerPrompt={showNextStrangerPrompt}
        localVideoEnabled={localVideoEnabled}
        showBackConfirm={showBackConfirm}
        setShowBackConfirm={setShowBackConfirm}
        onChangeMode={onChangeMode}
        strangerProfile={strangerProfile}
        CountryFlagIcon={CountryFlagIcon}
        subscriptionTier={subscriptionTier}
        showLeaveConfirm={showLeaveConfirm}
        setShowLeaveConfirm={setShowLeaveConfirm}
        chatFilters={chatFilters}
        onLeaveChat={onLeaveChat}
        onNextStranger={onNextStranger}
        setShowChatFilters={setShowChatFilters}
        hasActiveSubscription={hasActiveSubscription}
        chatFilterActiveCount={chatFilterActiveCount}
        showVideoChatOverlay={showVideoChatOverlay}
        setShowVideoChatOverlay={setShowVideoChatOverlay}
        messagesViewportRef={messagesViewportRef}
        handleMessagesScroll={handleMessagesScroll}
        messages={messages}
        messagesEndRef={messagesEndRef}
        replyingTo={replyingTo}
        clearReply={clearReply}
        messageInputRef={messageInputRef}
        text={text}
        setText={setText}
        isSendingMessage={isSendingMessage}
        sendMessage={sendMessage}
        toggleLocalAudio={toggleLocalAudio}
        localAudioEnabled={localAudioEnabled}
        toggleLocalVideo={toggleLocalVideo}
        switchCamera={switchCamera}
        videoError={videoError}
        chatFiltersPanel={chatFiltersPanel}
        onShowPaywall={onShowPaywall}
      />
    );
  }

  return (
    <ChatRoomTextView
      chatContainerRef={chatContainerRef}
      isFullscreenActive={isFullscreenActive}
      showBackConfirm={showBackConfirm}
      setShowBackConfirm={setShowBackConfirm}
      onChangeMode={onChangeMode}
      GenderIcon={GenderIcon}
      strangerProfile={strangerProfile}
      isConnecting={isConnecting}
      hasResolvedStrangerProfile={hasResolvedStrangerProfile}
      CountryFlagIcon={CountryFlagIcon}
      subscriptionTier={subscriptionTier}
      connectingStatus={connectingStatus}
      modeLabel={modeLabel}
      genderLabel={genderLabel}
      setShowChatFilters={setShowChatFilters}
      chatFilterActiveCount={chatFilterActiveCount}
      showNextStrangerPrompt={showNextStrangerPrompt}
      onNextStranger={onNextStranger}
      showLeaveConfirm={showLeaveConfirm}
      setShowLeaveConfirm={setShowLeaveConfirm}
      chatFilters={chatFilters}
      onLeaveChat={onLeaveChat}
      toggleFullscreen={toggleFullscreen}
      messagesViewportRef={messagesViewportRef}
      handleMessagesScroll={handleMessagesScroll}
      messages={messages}
      IMAGE_DELETED_NOTICE={IMAGE_DELETED_NOTICE}
      nowMs={nowMs}
      swipePreview={swipePreview}
      expandedActionMsgId={expandedActionMsgId}
      setExpandedActionMsgId={setExpandedActionMsgId}
      activeEmojiPickerMsgId={activeEmojiPickerMsgId}
      setActiveEmojiPickerMsgId={setActiveEmojiPickerMsgId}
      currentUserId={currentUserId}
      onReplyToMessage={onReplyToMessage}
      onDeleteMessage={onDeleteMessage}
      handleMessageTap={handleMessageTap}
      handleMessagePointerDown={handleMessagePointerDown}
      handleMessagePointerMove={handleMessagePointerMove}
      handleMessagePointerEnd={handleMessagePointerEnd}
      ChatMedia={ChatMedia}
      revealedTimedImageIds={revealedTimedImageIds}
      setRevealedTimedImageIds={setRevealedTimedImageIds}
      onRevealTimedImage={onRevealTimedImage}
      onReactToMessage={onReactToMessage}
      QUICK_REACTIONS={QUICK_REACTIONS}
      strangerIsTyping={strangerIsTyping}
      showScrollToLatestBubble={showScrollToLatestBubble}
      scrollToLatestMessage={scrollToLatestMessage}
      unreadReceivedCount={unreadReceivedCount}
      messagesEndRef={messagesEndRef}
      replyingTo={replyingTo}
      clearReply={clearReply}
      imagePreview={imagePreview}
      isGifFilename={isGifFilename}
      selectedFileName={selectedFileName}
      isSendingMessage={isSendingMessage}
      imageUploadProgress={imageUploadProgress}
      imageTimerSeconds={imageTimerSeconds}
      setImageTimerSeconds={setImageTimerSeconds}
      clearAttachment={clearAttachment}
      fileInputRef={fileInputRef}
      messageInputRef={messageInputRef}
      text={text}
      setText={setText}
      sendMessage={sendMessage}
      sendError={sendError}
      onSelectImage={onSelectImage}
      chatFiltersPanel={chatFiltersPanel}
    />
  );
}
