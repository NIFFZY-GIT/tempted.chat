"use client";

import { TierLogo } from "@/components/tier-logo";
import type { AgeGroupFilter, ChatStyleFilter, CountryFilter, GenderFilter } from "@/components/chat-ui";

type CountryOption = { code: string; label: string };

type ChatFiltersPanelProps = {
  showChatFilters: boolean;
  setShowChatFilters: (value: boolean) => void;
  hasActiveSubscription: boolean;
  onShowPaywall?: () => void;
  filterGender: GenderFilter;
  setFilterGender: React.Dispatch<React.SetStateAction<GenderFilter>>;
  filterStyle: ChatStyleFilter;
  setFilterStyle: React.Dispatch<React.SetStateAction<ChatStyleFilter>>;
  filterHideCountry: boolean;
  setFilterHideCountry: React.Dispatch<React.SetStateAction<boolean>>;
  subscriptionTier: "vip" | "vvip" | null;
  filterAgeGroup: AgeGroupFilter;
  setFilterAgeGroup: React.Dispatch<React.SetStateAction<AgeGroupFilter>>;
  filterCountryMenuRef: React.RefObject<HTMLDivElement | null>;
  filterCountryMenuOpen: boolean;
  setFilterCountryMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  filterSelectedCountryCode?: string;
  CountryFlagIcon: React.ComponentType<{ countryCode?: string; className?: string }>;
  filterCountry: CountryFilter;
  setFilterCountry: React.Dispatch<React.SetStateAction<CountryFilter>>;
  COUNTRY_OPTIONS: CountryOption[];
  getCountryLabel: (countryCode: string) => string;
  handleApplyFilters: () => void;
};

export function ChatFiltersPanel({
  showChatFilters,
  setShowChatFilters,
  hasActiveSubscription,
  onShowPaywall,
  filterGender,
  setFilterGender,
  filterStyle,
  setFilterStyle,
  filterHideCountry,
  setFilterHideCountry,
  subscriptionTier,
  filterAgeGroup,
  setFilterAgeGroup,
  filterCountryMenuRef,
  filterCountryMenuOpen,
  setFilterCountryMenuOpen,
  filterSelectedCountryCode,
  CountryFlagIcon,
  filterCountry,
  setFilterCountry,
  COUNTRY_OPTIONS,
  getCountryLabel,
  handleApplyFilters,
}: ChatFiltersPanelProps) {
  if (!showChatFilters) {
    return null;
  }

  const chip = (active: boolean) =>
    `rounded-2xl px-4 py-2.5 text-[12px] font-semibold text-center transition-all duration-300 cursor-pointer select-none border ${
      active
        ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.15)]"
        : "bg-white/[0.10] text-white/80 border-white/[0.18] hover:border-white/30 hover:text-white hover:bg-white/[0.14]"
    }`;

  return (
    <>
      <div
        className="animate-fade-in fixed inset-0 z-[60] bg-black/50 backdrop-blur-xl"
        onClick={() => setShowChatFilters(false)}
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={() => setShowChatFilters(false)}>
        <div
          className="animate-filter-slide-in flex w-full max-w-[440px] max-h-[85dvh] flex-col rounded-[28px] border border-white/[0.22] bg-[#0b0b14]/90 shadow-[0_32px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.08] ring-1 ring-white/[0.12]">
                <svg className="h-[18px] w-[18px] text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-white tracking-tight">Filters</h2>
                <p className="text-[11px] text-white/65 mt-0.5">Customize your match preferences</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowChatFilters(false)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-white/50 transition-all duration-200 hover:bg-white/[0.12] hover:text-white active:scale-90">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-7 pb-6 space-y-7">
            {/* VIP Section */}
            <div>
              <div className="mb-5 flex items-center gap-2.5">
                <TierLogo tier="vip" size="sm" className="rounded-xl bg-pink-500/10 px-2 py-1 ring-1 ring-pink-500/15" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-pink-400/80">VIP filters</span>
                {!hasActiveSubscription && (
                  <button type="button" onClick={() => { setShowChatFilters(false); onShowPaywall?.(); }} className="pointer-events-auto ml-auto rounded-xl bg-white px-4 py-1.5 text-[10px] font-bold text-black transition-all hover:shadow-[0_4px_16px_rgba(255,255,255,0.2)] active:scale-95">Get VIP</button>
                )}
              </div>
              {!hasActiveSubscription && (
                <div className="mb-4 flex items-center gap-2 text-[11px] text-white/70">
                  <span>Upgrade to</span>
                  <TierLogo tier="vip" size="xs" />
                  <span>to use these filters.</span>
                </div>
              )}
              <div className={`space-y-5 transition-opacity duration-300 ${!hasActiveSubscription ? "opacity-75" : ""}`}>
                <div>
                  <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Match with</label>
                  <div className="flex flex-wrap gap-2">
                    {(["Any", "Male", "Female", "Other"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (!hasActiveSubscription) {
                            onShowPaywall?.();
                            return;
                          }
                          setFilterGender((c: string) => (c === opt ? "Any" : opt));
                        }}
                        className={chip(filterGender === opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Chat type</label>
                  <div className="flex flex-wrap gap-2">
                    {(["Any style", "Casual", "Intimate"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (!hasActiveSubscription) {
                            onShowPaywall?.();
                            return;
                          }
                          setFilterStyle((c: string) => (c === opt ? "Any style" : opt));
                        }}
                        className={chip(filterStyle === opt)}
                      >
                        {opt === "Any style" ? "Any type" : opt}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasActiveSubscription) {
                      onShowPaywall?.();
                      return;
                    }
                    setFilterHideCountry((v: boolean) => !v);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/[0.16] bg-white/[0.08] px-5 py-3.5 transition-all duration-200 hover:bg-white/[0.12]"
                >
                  <span className="flex items-center gap-3 text-[13px] font-medium text-white/80"><span className="text-[15px]">🙈</span>Hide my country</span>
                  <span className={`relative flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${filterHideCountry ? "bg-white" : "bg-white/15"}`}>
                    <span className={`absolute h-5.5 w-5.5 rounded-full shadow-md transition-transform duration-300 ${filterHideCountry ? "translate-x-[22px] bg-black" : "translate-x-[3px] bg-white/60"}`} />
                  </span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />

            {/* VVIP Section */}
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <TierLogo tier="vvip" size="sm" className="rounded-xl bg-amber-500/10 px-2 py-1 ring-1 ring-amber-400/20" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-400/80">VVIP filters</span>
                </div>
                {subscriptionTier !== "vvip" && (
                  <button type="button" onClick={() => { setShowChatFilters(false); onShowPaywall?.(); }} className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-4 py-1.5 text-[10px] font-bold text-black transition-all duration-200 hover:shadow-[0_4px_16px_rgba(245,158,11,0.3)] active:scale-95">
                    <span>Get VVIP</span>
                    <TierLogo tier="vvip" size="xs" imageClassName="brightness-0" />
                  </button>
                )}
              </div>
              {subscriptionTier !== "vvip" && (
                <div className="mb-4 flex items-center gap-2 text-[11px] text-white/70">
                  <span>Upgrade to</span>
                  <TierLogo tier="vvip" size="xs" />
                  <span>to set age and country preferences.</span>
                </div>
              )}
              <div className={`space-y-5 transition-opacity duration-300 ${subscriptionTier !== "vvip" ? "opacity-75" : ""}`}>
                <div>
                  <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Age range</label>
                  <div className="flex flex-wrap gap-2">
                    {(["Any age", "Under 18", "18-25", "25+"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (subscriptionTier !== "vvip") {
                            onShowPaywall?.();
                            return;
                          }
                          setFilterAgeGroup((c: string) => (c === opt ? "Any age" : opt));
                        }}
                        className={chip(filterAgeGroup === opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Country</label>
                  <div className="relative" ref={filterCountryMenuRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (subscriptionTier !== "vvip") {
                          onShowPaywall?.();
                          return;
                        }
                        setFilterCountryMenuOpen((c: boolean) => !c);
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/[0.16] bg-white/[0.08] px-5 py-3.5 text-sm text-white/80 transition-all duration-200 hover:bg-white/[0.12]"
                    >
                      <span className="inline-flex items-center gap-3">
                        <CountryFlagIcon countryCode={filterSelectedCountryCode} className="h-4 w-5.5 rounded-sm object-cover" />
                        {filterCountry === "Any" ? "Any country" : getCountryLabel(filterCountry)}
                      </span>
                      <svg className={`h-4 w-4 text-white/30 transition-transform duration-300 ${filterCountryMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    {filterCountryMenuOpen && (
                      <div className="absolute z-30 mt-2 max-h-48 w-full overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#1a1a2e]/95 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                        <button type="button" onClick={() => { setFilterCountry("Any"); setFilterCountryMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors ${filterCountry === "Any" ? "bg-white/15 text-white font-medium" : "text-white/50 hover:bg-white/[0.08] hover:text-white/70"}`}>
                          <CountryFlagIcon className="h-4 w-5.5 rounded-sm object-cover" /> Any country
                        </button>
                        {COUNTRY_OPTIONS.map((opt: { code: string; label: string }) => (
                          <button key={opt.code} type="button" onClick={() => { setFilterCountry(opt.code); setFilterCountryMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors ${filterCountry === opt.code ? "bg-white/15 text-white font-medium" : "text-white/50 hover:bg-white/[0.08] hover:text-white/70"}`}>
                            <CountryFlagIcon countryCode={opt.code} className="h-4 w-5.5 rounded-sm object-cover" /> {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="border-t border-white/[0.08] px-7 py-6">
            <button type="button" onClick={handleApplyFilters} className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-white py-4 text-[14px] font-bold text-black transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,255,255,0.2)] active:scale-[0.97]">
              <span className="relative flex items-center gap-2">
                Find match
                <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
