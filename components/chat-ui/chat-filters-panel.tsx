"use client";

import { TierLogo } from "@/components/tier-logo";

export function ChatFiltersPanel({
  showChatFilters,
  setShowChatFilters,
  hasActiveSubscription,
  onShowPaywall,
  filterGender,
  setFilterGender,
  chatFilterChip,
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
}: any) {
  if (!showChatFilters) {
    return null;
  }

  return (
    <>
      <div
        className="animate-fade-in fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
        onClick={() => setShowChatFilters(false)}
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={() => setShowChatFilters(false)}>
        <div
          className="animate-filter-slide-in flex w-full max-w-[420px] max-h-[80dvh] flex-col rounded-3xl border border-white/[0.08] bg-[#0f0f17]/95 shadow-[0_32px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">
                <svg className="h-4 w-4 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-white">Filters</h2>
                <p className="text-[11px] text-white/25">Choose your preferences, then find a new match</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowChatFilters(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/30 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/60 active:scale-90">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <div className={!hasActiveSubscription ? "pointer-events-none opacity-40" : ""}>
              <div className="mb-4 flex items-center gap-2.5">
                <TierLogo tier="vip" size="sm" className="rounded-xl bg-pink-500/10 px-2 py-1 ring-1 ring-pink-500/15" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-pink-400/60">VIP filters</span>
                {!hasActiveSubscription && (
                  <button type="button" onClick={() => { setShowChatFilters(false); onShowPaywall?.(); }} className="pointer-events-auto ml-auto rounded-lg bg-pink-500 px-3 py-1 text-[10px] font-bold text-white transition hover:bg-pink-400 active:scale-95">Unlock</button>
                )}
              </div>
              {!hasActiveSubscription && (
                <div className="mb-3 flex items-center gap-2 text-[11px] text-white/30">
                  <span>Unlock</span>
                  <TierLogo tier="vip" size="xs" />
                  <span>to use these filters.</span>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Who you want to match with</label>
                  <div className="flex flex-wrap gap-2">
                    {(["Any", "Male", "Female", "Other"] as const).map((opt) => (
                      <button key={opt} type="button" onClick={() => setFilterGender((c: string) => (c === opt ? "Any" : opt))} className={chatFilterChip(filterGender === opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Chat type</label>
                  <div className="flex flex-wrap gap-2">
                    {(["Any style", "Casual", "Intimate"] as const).map((opt) => (
                      <button key={opt} type="button" onClick={() => setFilterStyle((c: string) => (c === opt ? "Any style" : opt))} className={chatFilterChip(filterStyle === opt)}>{opt === "Any style" ? "Any type" : opt}</button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => setFilterHideCountry((v: boolean) => !v)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:bg-white/[0.04]">
                  <span className="flex items-center gap-2.5 text-[13px] font-medium text-white/40"><span className="text-[14px]">🙈</span>Hide my country from others</span>
                  <span className={`relative flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${filterHideCountry ? "bg-pink-500" : "bg-white/10"}`}>
                    <span className={`absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${filterHideCountry ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
                  </span>
                </button>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            <div className={subscriptionTier !== "vvip" ? "pointer-events-none" : ""}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <TierLogo tier="vvip" size="sm" className="rounded-xl bg-amber-500/10 px-2 py-1 ring-1 ring-amber-400/20" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400/60">VVIP filters</span>
                </div>
                {subscriptionTier !== "vvip" && (
                  <button type="button" onClick={() => { setShowChatFilters(false); onShowPaywall?.(); }} className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3.5 py-1.5 text-[10px] font-bold text-black transition-all duration-200 hover:shadow-[0_4px_16px_rgba(245,158,11,0.3)] active:scale-95">
                    <span>Get</span>
                    <TierLogo tier="vvip" size="xs" imageClassName="brightness-0" />
                  </button>
                )}
              </div>
              {subscriptionTier !== "vvip" && (
                <div className="mb-3 flex items-center gap-2 text-[11px] text-white/30">
                  <span>Upgrade to</span>
                  <TierLogo tier="vvip" size="xs" />
                  <span>to set age and country preferences.</span>
                </div>
              )}
              <div className={`space-y-4 transition-opacity duration-300 ${subscriptionTier !== "vvip" ? "opacity-30" : ""}`}>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Preferred age range</label>
                  <div className="flex flex-wrap gap-2">
                    {(["Any age", "Under 18", "18-25", "25+"] as const).map((opt) => (
                      <button key={opt} type="button" onClick={() => { if (subscriptionTier === "vvip") setFilterAgeGroup((c: string) => (c === opt ? "Any age" : opt)); }} className={chatFilterChip(filterAgeGroup === opt)}>{opt === "Any age" ? "Any age" : opt}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-white/25">Preferred country</label>
                  <div className="relative" ref={filterCountryMenuRef}>
                    <button type="button" onClick={() => { if (subscriptionTier === "vvip") setFilterCountryMenuOpen((c: boolean) => !c); }} className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/40 transition-all duration-200 hover:bg-white/[0.04]">
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
                        {COUNTRY_OPTIONS.map((opt: { code: string; label: string }) => (
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

          <div className="border-t border-white/[0.06] px-6 py-5">
            <button type="button" onClick={handleApplyFilters} className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-pink-500 py-3.5 text-[14px] font-bold text-white transition-all duration-300 hover:bg-pink-400 active:scale-[0.97]">
              <span className="relative flex items-center gap-2">
                Save filters and find match
                <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
