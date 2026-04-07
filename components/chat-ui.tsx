"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";

export type ChatMessage = {
  id: number;
  author: "you" | "stranger";
  text?: string;
  image?: string;
  sentAt: string;
};

export type ProfileGender = "Male" | "Female" | "Other";
export type UserProfile = { gender: ProfileGender; age: number; country?: string; countryCode?: string };
export type ChatMode = "text" | "video" | "group";
export type GenderFilter = "Any" | ProfileGender;
export type AgeGroupFilter = "Any age" | "Under 18" | "18-25" | "25+";
export type ChatStyleFilter = "Any style" | "Casual" | "Intimate";
export type CountryFilter = "Any" | "US" | "GB" | "IN" | "DE" | "FR" | "ES" | "IT" | "BR" | "CA" | "AU" | "JP" | "KR";
export type ChatFilters = {
  gender: GenderFilter;
  ageGroup: AgeGroupFilter;
  style: ChatStyleFilter;
  country: CountryFilter;
};

export const starterMessages: ChatMessage[] = [
  { id: 1, author: "stranger", text: "Hey! What music are you into?", sentAt: "10:14 PM" },
  { id: 2, author: "you", text: "Mostly electronic. You?", sentAt: "10:15 PM" },
];

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
];

const getCountryLabel = (countryCode: CountryFilter): string => {
  if (countryCode === "Any") {
    return "Any country";
  }

  return COUNTRY_OPTIONS.find((option) => option.code === countryCode)?.label ?? countryCode;
};

const pickRandomCountryCode = (): string => {
  const countryCodes = COUNTRY_OPTIONS.map((option) => option.code);
  return countryCodes[Math.floor(Math.random() * countryCodes.length)];
};

const toFlagEmoji = (countryCode?: string): string => {
  if (!countryCode || countryCode.length !== 2) {
    return "🌐";
  }

  return String.fromCodePoint(
    ...countryCode.toUpperCase().split("").map((char) => 127397 + char.charCodeAt(0)),
  );
};

const FLAG_EMOJI_STYLE = {
  fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
} as const;

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
    <section className="grid w-full max-w-5xl gap-4 md:grid-cols-[1.05fr_1fr]">
      <article className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1320] to-[#0e0d14] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.26em] text-pink-300/80">Tempted.Chat</p>
        <h1 className="mt-4 max-w-[12ch] text-4xl font-black leading-[0.95] text-white md:text-6xl">
          Meet someone new in seconds.
        </h1>
        <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-white/60 md:text-base">
          Start anonymous, continue with Google, or use email and password. Clean flow, fast matching, image sharing.
        </p>

        <div className="mt-6 grid gap-2 text-sm text-white/70">
          <p>Anonymous guest entry</p>
          <p>Google sign in</p>
          <p>Email and password</p>
          <p>Reset password support</p>
        </div>
      </article>

      <article className="rounded-3xl border border-white/10 bg-black/35 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md md:p-8">
        <h2 className="text-xl font-bold text-white">Continue to Chat</h2>
        <p className="mt-1 text-sm text-white/55">Choose one login method.</p>

        <div className="mt-5 grid gap-3">
          <button
            onClick={loginAnonymously}
            disabled={authBusy}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 font-semibold transition ${authMethod === "anonymous" ? "border-emerald-300/60 bg-gradient-to-r from-emerald-400/20 to-cyan-400/15 text-white shadow-[0_10px_28px_rgba(52,211,153,0.2)]" : "border-white/20 bg-white/[0.04] text-white/80 hover:border-emerald-200/40 hover:bg-emerald-300/10"}`}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/10 text-[11px] font-black">A</span>
            <span>Sign in Anonymously</span>
            <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[10px] font-extrabold text-black">FAST</span>
          </button>

          <button
            onClick={loginWithGoogle}
            disabled={authBusy}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 font-bold transition ${authMethod === "google" ? "border-blue-300 bg-white text-slate-900 ring-2 ring-blue-300/60" : "border-white/40 bg-white text-slate-900 hover:border-blue-200 hover:bg-white/95"}`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-1.9 3l3 2.3c1.8-1.7 2.8-4.1 2.8-7 0-.6-.1-1.2-.2-1.8H12z" />
              <path fill="#34A853" d="M12 21c2.5 0 4.7-.8 6.3-2.2l-3-2.3c-.8.6-1.9 1-3.3 1-2.5 0-4.6-1.7-5.3-4H3.6v2.4C5.2 19 8.3 21 12 21z" />
              <path fill="#FBBC05" d="M6.7 13.5c-.2-.6-.3-1.1-.3-1.7s.1-1.2.3-1.7V7.7H3.6C2.9 9 2.5 10.3 2.5 11.8s.4 2.8 1.1 4.1l3.1-2.4z" />
              <path fill="#4285F4" d="M12 6.1c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.7 3 14.5 2 12 2 8.3 2 5.2 4 3.6 7.7l3.1 2.4c.7-2.3 2.8-4 5.3-4z" />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={() => {
              setAuthMethod("email");
              setAuthError(null);
              emailInputRef.current?.focus();
            }}
            disabled={authBusy}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${authMethod === "email" ? "border-fuchsia-300/70 bg-gradient-to-r from-fuchsia-400/20 to-pink-400/15 text-white shadow-[0_10px_26px_rgba(217,70,239,0.2)]" : "border-white/20 bg-white/[0.04] text-white/75 hover:border-fuchsia-200/40 hover:bg-fuchsia-300/10 hover:text-white"}`}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/10 text-[11px] font-black">@</span>
            Use Email and Password
          </button>
        </div>

        {authMethod === "email" && (
          <div className="mt-5 grid gap-3">
            <label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Email</label>
            <input
              id="email"
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-pink-400/70"
            />

            <label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              placeholder="At least 6 characters"
              className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-pink-400/70"
            />

            <button
              type="button"
              onClick={loginWithEmail}
              disabled={authBusy}
              className="rounded-xl bg-gradient-to-r from-fuchsia-400 to-pink-400 px-4 py-3 font-extrabold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {authMode === "signup" ? "Create Account" : "Login"}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={resetPassword}
                disabled={authBusy}
                className="font-semibold text-pink-300 transition hover:text-pink-200"
              >
                Forgot Password?
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "signin" ? "signup" : "signin");
                  setAuthError(null);
                }}
                className="font-semibold text-white/75 transition hover:text-white"
              >
                {authMode === "signin" ? "New user? Create account" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        )}

        {authError && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">{authError}</p>}
        {authNotice && <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200">{authNotice}</p>}
      </article>
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
}) {
  const countryFlag =
    profileCountryCode && profileCountryCode.length === 2
      ? String.fromCodePoint(...profileCountryCode.toUpperCase().split("").map((char) => 127397 + char.charCodeAt(0)))
      : "🌐";
  const normalizedCountryName = /^[A-Z]{2}$/.test(profileCountry) ? "" : profileCountry;

  return (
    <section className="w-full max-w-[640px] rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1320] to-[#0f0d16] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.26em] text-pink-300/80">Profile Setup</p>
      <h2 className="mt-3 text-3xl font-black text-white">Tell us about you</h2>
      <p className="mt-2 text-sm text-white/60">We use this for better matching. Only basic profile data is shown.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(["Male", "Female", "Other"] as ProfileGender[]).map((gender) => (
          <button
            key={gender}
            type="button"
            className={`flex items-center justify-center rounded-2xl border px-4 py-3 font-semibold transition ${profileGender === gender ? "border-pink-400/70 bg-pink-400/10 text-white ring-2 ring-pink-400/25" : "border-white/15 bg-white/[0.04] text-white/80 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08]"}`}
            onClick={() => setProfileGender(gender)}
          >
            <span className="flex items-center gap-2">
              <span className={`gender-icon ${gender.toLowerCase()}`}><GenderIcon gender={gender} /></span>
              <span>{gender}</span>
            </span>
          </button>
        ))}
      </div>

      <label htmlFor="profile-age" className="mt-5 block text-xs font-bold uppercase tracking-[0.14em] text-white/60">Age</label>
      <input
        id="profile-age"
        type="number"
        min={13}
        max={99}
        value={profileAge}
        onChange={(event) => setProfileAge(event.target.value)}
        placeholder="Enter your age"
        className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-pink-400/70"
      />

      <label htmlFor="profile-country" className="mt-4 block text-xs font-bold uppercase tracking-[0.14em] text-white/60">Country</label>
      <input
        id="profile-country"
        type="text"
        value={profileCountry ? `${countryFlag}${normalizedCountryName ? ` ${normalizedCountryName}` : ""}` : "🌐 Detecting..."}
        readOnly
        className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-white/90 outline-none"
      />
      <p className="mt-1 text-[11px] text-white/45">Auto-detected from your browser locale.</p>

      {profileError && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">{profileError}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white/80 transition hover:border-white/35 hover:text-white" onClick={onBack}>
          Back
        </button>
        <button type="button" className="rounded-xl bg-pink-500 px-4 py-3 font-extrabold text-black transition hover:brightness-110" onClick={onContinue}>
          Continue
        </button>
      </div>
    </section>
  );
}

export function ModeSelectionView({
  onChooseMode,
  onBack,
}: {
  onChooseMode: (mode: ChatMode) => void;
  onBack: () => void;
}) {
  return (
    <section className="w-full max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#14111b] to-[#0d0b13] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.26em] text-pink-300/80">Chat Mode</p>
      <h2 className="mt-3 text-3xl font-black text-white">Choose your vibe</h2>
      <p className="mt-2 text-sm text-white/60">Pick one mode to start your next conversation.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { id: "text", title: "Text", sub: "Simple chat", color: "bg-blue-400" },
          { id: "video", title: "Video", sub: "Face to face", color: "bg-pink-400" },
          { id: "group", title: "Groups", sub: "Party room", color: "bg-yellow-400" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => onChooseMode(m.id as ChatMode)}
            className="group relative rounded-3xl border border-white/15 bg-white/[0.04] p-6 text-left transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08]"
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full ${m.color} font-bold text-black`}>
              {m.title[0]}
            </div>
            <h3 className="text-xl font-extrabold text-white">{m.title}</h3>
            <p className="text-sm text-white/40">{m.sub}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white/80 transition hover:border-white/35 hover:text-white"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    </section>
  );
}

export function FilterOptionsView({
  initialFilters,
  onApply,
  onBack,
}: {
  initialFilters: ChatFilters;
  onApply: (filters: ChatFilters) => void;
  onBack: () => void;
}) {
  const [gender, setGender] = useState<GenderFilter>(initialFilters.gender);
  const [ageGroup, setAgeGroup] = useState<AgeGroupFilter>(initialFilters.ageGroup);
  const [style, setStyle] = useState<ChatStyleFilter>(initialFilters.style);
  const [country, setCountry] = useState<CountryFilter>(initialFilters.country);

  const applyFilters = () => {
    onApply({ gender, ageGroup, style, country });
  };

  return (
    <section className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-black/45 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl md:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-pink-300/80">Filters</p>
      <h2 className="mt-3 text-3xl font-black text-white">Match preferences</h2>
      <p className="mt-2 max-w-[34ch] text-sm text-white/60">Choose who you want to see before entering chat.</p>

      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Age group</label>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Toggle one</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["Any age", "Under 18", "18-25", "25+"] as AgeGroupFilter[]).map((option) => {
              const isSelected = ageGroup === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAgeGroup((current) => (current === option ? "Any age" : option))}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${isSelected ? "border-pink-400/70 bg-pink-400/12 text-white shadow-[0_0_0_1px_rgba(255,77,163,0.15)]" : "border-white/10 bg-white/[0.04] text-white/78 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <span>{option}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-pink-400" : "bg-white/15"}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Chat style</label>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Toggle one</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["Any style", "Casual", "Intimate"] as ChatStyleFilter[]).map((option) => {
              const isSelected = style === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStyle((current) => (current === option ? "Any style" : option))}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${isSelected ? "border-pink-400/70 bg-pink-400/12 text-white shadow-[0_0_0_1px_rgba(255,77,163,0.15)]" : "border-white/10 bg-white/[0.04] text-white/78 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <span>{option}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-pink-400" : "bg-white/15"}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Gender</label>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Toggle one</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["Any", "Male", "Female", "Other"] as GenderFilter[]).map((option) => {
              const isSelected = gender === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGender((current) => (current === option ? "Any" : option))}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${isSelected ? "border-pink-400/70 bg-pink-400/12 text-white shadow-[0_0_0_1px_rgba(255,77,163,0.15)]" : "border-white/10 bg-white/[0.04] text-white/78 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <span>{option}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-pink-400" : "bg-white/15"}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label htmlFor="country-filter" className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Country</label>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">Any or specific</span>
          </div>
          <select
            id="country-filter"
            value={country}
            onChange={(event) => setCountry(event.target.value as CountryFilter)}
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-pink-400/60"
            style={FLAG_EMOJI_STYLE}
          >
            <option value="Any" className="bg-[#141722] text-white" style={FLAG_EMOJI_STYLE}>Any country</option>
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code} className="bg-[#141722] text-white" style={FLAG_EMOJI_STYLE}>
                {`${toFlagEmoji(option.code)} ${option.label}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5">
        <button
          type="button"
          className="rounded-xl border border-white/20 px-4 py-3 font-semibold text-white/80 transition hover:border-white/35 hover:text-white"
          onClick={onBack}
        >
          Back
        </button>
        <button
          type="button"
          className="rounded-xl bg-pink-500 px-4 py-3 font-extrabold text-black transition hover:brightness-110"
          onClick={applyFilters}
        >
          Start Chat
        </button>
      </div>
    </section>
  );
}

export function ChatRoomView({
  strangerProfile,
  chatMode,
  chatFilters,
  isConnecting,
  connectingStatus,
  messages,
  text,
  setText,
  sendMessage,
  onLeaveChat,
  onChangeMode,
  imagePreview,
  selectedFileName,
  fileInputRef,
  onSelectImage,
  clearAttachment,
}: {
  strangerProfile: UserProfile;
  chatMode: ChatMode;
  chatFilters: ChatFilters | null;
  isConnecting: boolean;
  connectingStatus: string;
  messages: ChatMessage[];
  text: string;
  setText: (value: string) => void;
  sendMessage: () => void;
  onLeaveChat: (filters: ChatFilters) => void;
  onChangeMode: () => void;
  imagePreview: string | null;
  selectedFileName: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSelectImage: (event: ChangeEvent<HTMLInputElement>) => void;
  clearAttachment: () => void;
}) {
  const chatContainerRef = useRef<HTMLElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  const modeLabel = chatMode === "text" ? "Text" : chatMode === "video" ? "Video" : "Group";
  const ageLabel = chatFilters?.ageGroup ?? "Any age";
  const genderLabel = chatFilters?.gender && chatFilters.gender !== "Any" ? chatFilters.gender : "Any gender";
  const styleLabel = chatFilters?.style ?? "Any style";
  const countryLabel = getCountryLabel(chatFilters?.country ?? "Any");
  const selectedStyle = chatFilters?.style && chatFilters.style !== "Any style" ? chatFilters.style : null;
  const strangerFlag = toFlagEmoji(strangerProfile.countryCode);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, strangerProfile]);

  return (
    <section
      ref={chatContainerRef}
      className={`${isFullscreen ? "fixed inset-0 z-50 mt-0 h-dvh rounded-none" : "mt-0 h-[calc(100dvh-8.75rem)] rounded-[28px]"} relative flex w-full max-w-none flex-col overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(16,18,26,0.95),rgba(8,9,14,0.95))] shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-sm`}
    >
      <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.12),transparent_42%),linear-gradient(180deg,rgba(18,20,28,0.95),rgba(14,15,21,0.9))] px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15">
              <GenderIcon gender={strangerProfile.gender} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-[0.18em] text-white/65">Stranger</span>
                <span style={FLAG_EMOJI_STYLE} className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-sm leading-none">{strangerFlag}</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/75">{`${strangerProfile.gender}, ${strangerProfile.age}`}</span>
                <span className="rounded-full border border-pink-400/25 bg-pink-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-pink-200">{modeLabel}</span>
                {selectedStyle && (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200">
                    {selectedStyle}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-white/42">
                <span className={`h-1.5 w-1.5 rounded-full ${isConnecting ? "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]" : "bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]"}`} />
                <span>{isConnecting ? "Connecting" : "Live session"}</span>
                <span className="text-white/20">•</span>
                <span>{isConnecting ? connectingStatus : "Matching preferences applied"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 lg:justify-end">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Filters</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">{ageLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">{genderLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">{styleLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">{countryLabel}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start gap-2">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center">
              <button
                onClick={() => setShowBackConfirm((current) => !current)}
                className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white/75 transition hover:border-white/30 hover:text-white"
                aria-label="Go to match preferences"
              >
                Back
              </button>
              <div
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${showBackConfirm ? "ml-1 max-w-xs opacity-100" : "ml-0 max-w-0 opacity-0 pointer-events-none"}`}
              >
                <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/85 px-2 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/70">Sure?</span>
                  <button
                    onClick={() => {
                      setShowBackConfirm(false);
                      onChangeMode();
                    }}
                    className="rounded bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-black transition hover:bg-white/90"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowBackConfirm(false)}
                    className="rounded border border-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/75 transition hover:text-white"
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowLeaveConfirm((current) => !current)}
                className="rounded-lg bg-rose-500 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-rose-400"
              >
                Leave
              </button>
              <div
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${showLeaveConfirm ? "ml-1 max-w-xs opacity-100" : "ml-0 max-w-0 opacity-0 pointer-events-none"}`}
              >
                <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/85 px-2 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/70">Sure?</span>
                  <button
                    onClick={() => {
                      setShowLeaveConfirm(false);
                      if (chatFilters) {
                        onLeaveChat(chatFilters);
                      }
                    }}
                    className="rounded bg-rose-500 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-rose-400"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="rounded border border-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/75 transition hover:text-white"
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_40%),linear-gradient(180deg,rgba(11,13,19,0.92),rgba(7,8,12,0.96))] px-3 py-4 md:px-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 md:gap-4">
          {isConnecting && (
            <div className="flex justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-amber-300/35 bg-amber-400/10 px-4 py-3 text-amber-100">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-200/70 border-t-transparent" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-[0.12em]">Connecting stranger...</span>
                  <span className="text-[11px] text-amber-100/85">{connectingStatus}</span>
                </div>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.author === "you" ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[88%] flex-col gap-1 ${msg.author === "you" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
                  msg.author === "you"
                    ? "rounded-br-sm bg-pink-500 text-black"
                    : "rounded-bl-sm border border-white/10 bg-white/[0.04] text-white/90"
                }`}>
                  {msg.text}
                  {msg.image && (
                    <Image src={msg.image} alt="Sent" width={300} height={200} className="mt-2 rounded-xl" unoptimized />
                  )}
                </div>
                <span className="px-1 text-[10px] text-white/25">{msg.sentAt}</span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <footer className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(10,11,15,0.92),rgba(6,7,10,0.98))] p-3 md:p-4">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {imagePreview && (
            <div className="relative inline-flex max-w-full items-center gap-3 rounded-2xl border border-pink-400/35 bg-pink-400/10 p-2.5">
              <Image src={imagePreview} alt="Attachment preview" width={56} height={56} className="rounded-xl object-cover" unoptimized />
              <div className="grid gap-1">
                <p className="max-w-[200px] truncate text-xs font-semibold text-pink-100">{selectedFileName ?? "Selected image"}</p>
                <button onClick={clearAttachment} className="text-left text-xs font-bold text-pink-200 hover:text-pink-100">Remove image</button>
              </div>
            </div>
          )}

          <div className="relative flex items-center gap-1 rounded-2xl border border-white/12 bg-white/[0.04] p-2 transition focus-within:border-white/30 focus-within:bg-white/[0.055]">
            <button
              disabled={isConnecting}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl p-2.5 text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            </button>

            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isConnecting && sendMessage()}
              placeholder={isConnecting ? "Finding an available stranger..." : "Write a message..."}
              disabled={isConnecting}
              className="flex-1 border-none bg-transparent px-2 py-2 text-white outline-none placeholder:text-white/30"
            />

            <button
              onClick={sendMessage}
              disabled={isConnecting || (!text.trim() && !imagePreview)}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-20"
            >
              Send
            </button>
          </div>
        </div>
      </footer>

      <button
        onClick={toggleFullscreen}
        className="absolute bottom-3 right-3 rounded-lg border border-white/15 bg-black/45 p-2.5 text-white/80 backdrop-blur-sm transition hover:border-white/30 hover:text-white"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
            <path d="m3 3 6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M21 15v6h-6" />
            <path d="M3 9 9 3M21 9l-6-6M3 15l6 6M21 15l-6 6" />
          </svg>
        )}
      </button>

      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={onSelectImage} />
    </section>
  );
}