"use client";

import { TierLogo } from "@/components/tier-logo";

export function ChatRoomVideoView({
  chatContainerRef,
  remoteVideoRef,
  localVideoRef,
  isConnecting,
  hasResolvedStrangerProfile,
  remoteAudioEnabled,
  hasRemoteVideo,
  connectingStatus,
  showNextStrangerPrompt,
  localVideoEnabled,
  showBackConfirm,
  setShowBackConfirm,
  onChangeMode,
  GenderIcon,
  strangerProfile,
  CountryFlagIcon,
  subscriptionTier,
  showLeaveConfirm,
  setShowLeaveConfirm,
  chatFilters,
  onLeaveChat,
  onNextStranger,
  setShowChatFilters,
  hasActiveSubscription,
  chatFilterActiveCount,
  showVideoChatOverlay,
  setShowVideoChatOverlay,
  messagesViewportRef,
  handleMessagesScroll,
  messages,
  messagesEndRef,
  replyingTo,
  clearReply,
  messageInputRef,
  text,
  setText,
  isSendingMessage,
  sendMessage,
  toggleLocalAudio,
  localAudioEnabled,
  toggleLocalVideo,
  switchCamera,
  videoError,
  chatFiltersPanel,
}: any) {
  return (
    <section
      ref={chatContainerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black touch-manipulation overscroll-contain"
    >
      <div className="flex h-[calc(var(--vh,1dvh)*100)] w-full flex-col sm:flex-row">
        <div className="relative h-[calc(var(--vh,1dvh)*50)] w-full shrink-0 overflow-hidden border-b border-white/10 sm:h-full sm:w-1/2 sm:shrink sm:border-b-0 sm:border-r">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          {!isConnecting && hasResolvedStrangerProfile && (!remoteAudioEnabled || !hasRemoteVideo) && (
            <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
              {!remoteAudioEnabled && (
                <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/45 bg-rose-500/30 px-3 py-1.5 text-[11px] font-bold text-rose-100 shadow-[0_6px_18px_rgba(244,63,94,0.35)] backdrop-blur-md">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 4 16 16" /><path d="M9 9v3a3 3 0 0 0 5.14 2.14" /><path d="M15 6a3 3 0 0 0-5.08-2.2" /></svg>
                  Stranger muted
                </span>
              )}
              {!hasRemoteVideo && (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/45 bg-amber-500/28 px-3 py-1.5 text-[11px] font-bold text-amber-100 shadow-[0_6px_18px_rgba(245,158,11,0.35)] backdrop-blur-md">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 2 20 20" /><rect x="3" y="7" width="12" height="10" rx="2" /></svg>
                  Stranger camera off
                </span>
              )}
            </div>
          )}
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
                  <p className="text-sm font-medium text-white/35">
                    {showNextStrangerPrompt ? "Stranger has left. Tap Next to continue." : "Waiting for stranger&apos;s camera..."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative h-[calc(var(--vh,1dvh)*50)] w-full shrink-0 overflow-hidden sm:h-full sm:w-1/2 sm:shrink">
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover [transform:scaleX(-1)]" />
          {!localVideoEnabled && (
            <div className="absolute inset-0 grid place-items-center bg-black/85">
              <svg className="h-8 w-8 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m2 2 20 20" /><rect x="3" y="7" width="12" height="10" rx="2" /><path d="m15 10 6-3v10l-6-3" /></svg>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/60 backdrop-blur-md sm:top-auto sm:bottom-3">You</span>
        </div>
      </div>

      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-gradient-to-b from-black/80 via-black/50 to-transparent px-3 pb-4 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-4">
        {!showBackConfirm ? (
          <button
            onClick={() => setShowBackConfirm(true)}
            className="btn-action btn-action-ghost flex h-11 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-full bg-black/55 px-4 text-xs font-semibold text-white/90 backdrop-blur-md transition hover:bg-black/65"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
        ) : (
          <div className="flex items-center gap-2 animate-pop-in">
            <span className="text-xs font-semibold text-white/60">Leave?</span>
            <button onClick={() => { setShowBackConfirm(false); onChangeMode(); }} className="btn-action btn-action-pink h-11 rounded-full bg-pink-500 px-4 text-xs font-bold text-white backdrop-blur-md">Yes</button>
            <button onClick={() => setShowBackConfirm(false)} className="btn-action btn-action-ghost h-11 rounded-full bg-black/55 px-4 text-xs font-semibold text-white/90 backdrop-blur-md">No</button>
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
              <TierLogo
                tier={subscriptionTier}
                size="xs"
                className={`ml-1 rounded-full px-1.5 py-1 ring-1 ${subscriptionTier === "vvip" ? "bg-amber-400/10 ring-amber-400/15" : "bg-pink-500/10 ring-pink-500/15"}`}
              />
            )}
          </p>

          {hasResolvedStrangerProfile && strangerProfile.interests && strangerProfile.interests.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {strangerProfile.interests.map((tag: string) => (
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
                  className="btn-action btn-action-rose flex h-11 items-center rounded-full bg-rose-500/90 px-6 text-xs font-bold text-white backdrop-blur-md"
                >
                  Leave
                </button>
              ) : (
                <div className="flex items-center gap-2 animate-pop-in">
                  <span className="text-xs font-semibold text-white/60">Sure?</span>
                  <button onClick={() => { setShowLeaveConfirm(false); if (chatFilters) onLeaveChat(chatFilters); }} className="btn-action btn-action-pink h-11 rounded-full bg-pink-500 px-4 text-xs font-bold text-white backdrop-blur-md">Yes</button>
                  <button onClick={() => setShowLeaveConfirm(false)} className="btn-action btn-action-ghost h-11 rounded-full bg-black/55 px-4 text-xs font-semibold text-white/90 backdrop-blur-md">No</button>
                </div>
              )}
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setShowChatFilters(true)}
            className="relative flex h-10 items-center gap-2 rounded-full bg-black/50 px-3 text-white/70 backdrop-blur-md transition hover:bg-black/60 active:scale-[0.96]"
            aria-label={!hasActiveSubscription ? "Unlock filters" : "Filters"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
            <span className="text-[11px] font-semibold">{!hasActiveSubscription ? "Unlock filters" : "Filters"}</span>
            {!hasActiveSubscription ? (
              <TierLogo tier="vvip" size="xs" className="rounded-full bg-amber-400/10 px-1.5 py-1 ring-1 ring-amber-400/15" />
            ) : subscriptionTier ? (
              <TierLogo
                tier={subscriptionTier}
                size="xs"
                className={`rounded-full px-1.5 py-1 ring-1 ${subscriptionTier === "vvip" ? "bg-amber-400/10 ring-amber-400/15" : "bg-pink-500/10 ring-pink-500/15"}`}
              />
            ) : null}
            {chatFilterActiveCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[9px] font-bold text-white">{chatFilterActiveCount}</span>
            )}
          </button>
        </div>
      </header>

      {showVideoChatOverlay && (
        <div className="absolute inset-x-0 bottom-20 z-20 mx-2 flex max-h-[55%] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-black/70 backdrop-blur-xl sm:mx-4 sm:max-h-[60%]">
          <div
            ref={messagesViewportRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto px-3 py-3 overscroll-contain will-change-scroll [transform:translateZ(0)]"
          >
            <div className="flex flex-col gap-2">
              {messages.map((msg: any) => {
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
              className="h-9 flex-1 rounded-lg bg-white/[0.06] px-3 text-base text-white outline-none placeholder:text-white/25 sm:text-sm"
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

      {!showVideoChatOverlay && (() => {
        const recentStrangerMsgs = messages
          .filter((m: any) => m.author === "stranger" && !m.deletedForEveryone && m.text)
          .slice(-3);
        if (recentStrangerMsgs.length === 0) return null;
        return (
          <div className="pointer-events-none absolute bottom-20 left-2 z-20 flex max-w-[60%] flex-col gap-1.5 sm:left-4 sm:max-w-[40%]">
            {recentStrangerMsgs.map((msg: any) => (
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

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-6">
        <button
          type="button"
          onClick={() => setShowVideoChatOverlay((v: boolean) => !v)}
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

      {chatFiltersPanel}
    </section>
  );
}
