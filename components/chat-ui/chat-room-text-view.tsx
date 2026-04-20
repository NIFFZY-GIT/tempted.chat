"use client";

import Image from "next/image";
import { TierLogo } from "@/components/tier-logo";

export function ChatRoomTextView({
  chatContainerRef,
  isFullscreenActive,
  showBackConfirm,
  setShowBackConfirm,
  onChangeMode,
  GenderIcon,
  strangerProfile,
  isConnecting,
  hasResolvedStrangerProfile,
  CountryFlagIcon,
  subscriptionTier,
  connectingStatus,
  modeLabel,
  genderLabel,
  ageLabel,
  setShowChatFilters,
  hasActiveSubscription,
  chatFilterActiveCount,
  showNextStrangerPrompt,
  onNextStranger,
  showLeaveConfirm,
  setShowLeaveConfirm,
  chatFilters,
  onLeaveChat,
  toggleFullscreen,
  messagesViewportRef,
  handleMessagesScroll,
  messages,
  IMAGE_DELETED_NOTICE,
  nowMs,
  swipePreview,
  expandedActionMsgId,
  setExpandedActionMsgId,
  activeEmojiPickerMsgId,
  setActiveEmojiPickerMsgId,
  currentUserId,
  onReplyToMessage,
  onDeleteMessage,
  handleMessageTap,
  handleMessagePointerDown,
  handleMessagePointerMove,
  handleMessagePointerEnd,
  ChatMedia,
  revealedTimedImageIds,
  setRevealedTimedImageIds,
  onRevealTimedImage,
  onReactToMessage,
  QUICK_REACTIONS,
  strangerIsTyping,
  showScrollToLatestBubble,
  scrollToLatestMessage,
  unreadReceivedCount,
  messagesEndRef,
  replyingTo,
  clearReply,
  imagePreview,
  isGifFilename,
  selectedFileName,
  isSendingMessage,
  imageUploadProgress,
  imageTimerSeconds,
  setImageTimerSeconds,
  clearAttachment,
  fileInputRef,
  messageInputRef,
  text,
  setText,
  sendMessage,
  sendError,
  onSelectImage,
  chatFiltersPanel,
}: any) {
  return (
    <section
      ref={chatContainerRef}
      className={`${isFullscreenActive ? "fixed inset-0 z-50 mt-0 h-dvh rounded-none" : "mt-0 h-[calc(var(--vh,1dvh)*100-5.5rem)] rounded-2xl sm:h-[calc(var(--vh,1dvh)*100-6rem)] md:rounded-3xl"} relative flex w-full max-w-none flex-col overflow-hidden border border-white/[0.06] bg-[#0a0a10] shadow-[0_8px_40px_rgba(0,0,0,0.5)] overscroll-contain touch-manipulation`}
    >
      <header className="flex items-center gap-2 border-b border-white/[0.06] bg-[#0d0d14]/90 px-2.5 py-2 backdrop-blur-md sm:px-4 sm:py-2.5">
        {!showBackConfirm ? (
          <button
            onClick={() => setShowBackConfirm(true)}
            className="btn-action btn-action-ghost flex h-10 items-center gap-1.5 rounded-xl bg-white/[0.08] px-3.5 text-xs font-semibold text-white/80 transition-all duration-150 hover:bg-white/[0.14] hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
        ) : (
          <div className="flex items-center gap-1.5 animate-pop-in">
            <span className="text-xs font-semibold text-white/60">Sure?</span>
            <button onClick={() => { setShowBackConfirm(false); onChangeMode(); }} className="btn-action btn-action-pink h-9 rounded-xl bg-pink-500 px-3.5 text-xs font-bold text-white transition-all duration-150 hover:bg-pink-400">Yes</button>
            <button onClick={() => setShowBackConfirm(false)} className="btn-action btn-action-ghost h-9 rounded-xl bg-white/[0.1] px-3.5 text-xs font-semibold text-white/85 transition-all duration-150 hover:bg-white/[0.16]">No</button>
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
              <TierLogo
                tier={subscriptionTier}
                size="xs"
                className={`rounded-full px-1.5 py-1 ring-1 ${subscriptionTier === "vvip" ? "bg-amber-400/10 ring-amber-400/15" : "bg-pink-500/10 ring-pink-500/15"}`}
              />
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
                {strangerProfile.interests.map((tag: string) => (
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
          <button
            type="button"
            onClick={() => setShowChatFilters(true)}
            className="relative flex h-10 flex-shrink-0 items-center gap-2 rounded-xl px-3 text-white/65 transition hover:bg-white/[0.1] hover:text-white active:scale-[0.95]"
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
                  className="btn-action btn-action-rose flex h-10 items-center rounded-xl bg-rose-500 px-4 text-xs font-bold text-white transition-all duration-150 hover:bg-rose-400"
                >
                  Leave
                </button>
              ) : (
                <div className="flex items-center gap-1.5 animate-pop-in">
                  <span className="text-xs font-semibold text-white/60">Sure?</span>
                  <button onClick={() => { setShowLeaveConfirm(false); if (chatFilters) onLeaveChat(chatFilters); }} className="btn-action btn-action-pink h-9 rounded-xl bg-pink-500 px-3.5 text-xs font-bold text-white transition-all duration-150 hover:bg-pink-400">Yes</button>
                  <button onClick={() => setShowLeaveConfirm(false)} className="btn-action btn-action-ghost h-9 rounded-xl bg-white/[0.1] px-3.5 text-xs font-semibold text-white/85 transition-all duration-150 hover:bg-white/[0.16]">No</button>
                </div>
              )}
            </>
          ) : null}
          <button
            onClick={toggleFullscreen}
            className="flex h-10 min-w-[5.75rem] flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-xs font-semibold text-white/80 transition hover:bg-white/[0.12] hover:text-white active:scale-[0.95]"
            aria-label={isFullscreenActive ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreenActive ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreenActive ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            )}
            <span>{isFullscreenActive ? "Exit" : "Full"}</span>
          </button>
        </div>
      </header>

      <div
        ref={messagesViewportRef}
        onScroll={handleMessagesScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5 overscroll-contain will-change-scroll [transform:translateZ(0)]"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
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

          {messages.map((msg: any) => {
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
            const canDeleteForEveryone = isYou && typeof msg.createdAtMs === "number" && (nowMs - msg.createdAtMs) < 30000;
            const swipeOffset = swipePreview?.id === msg.id ? swipePreview.offset : 0;
            const showActionRail = !msg.isPending && !isConnecting;
            const isActionRailExpanded = expandedActionMsgId === msg.id;
            const replyTargetsYou = msg.replyToAuthor === "you";
            const replyAccentClass = replyTargetsYou
              ? "border-pink-400/16 bg-pink-400/12 text-white/72"
              : "border-sky-400/16 bg-sky-400/12 text-white/72";
            const replyLabelClass = replyTargetsYou ? "text-pink-300/80" : "text-blue-300/80";
            const replyHighlightRing = replyTargetsYou ? "ring-pink-400/50" : "ring-blue-400/50";
            const swipeIndicatorPositionClass = isYou ? "right-2.5" : "left-2.5";
            const actionRailPositionClass = isYou
              ? "right-full mr-2 top-1/2 -translate-y-1/2"
              : "left-full ml-2 top-1/2 -translate-y-1/2";
            const bubbleStyleWithDirection = {
              transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
              userSelect: "none" as const,
              WebkitUserSelect: "none" as const,
              WebkitTouchCallout: "none" as const,
            };

            return (
              <div key={msg.id} className={`flex ${isYou ? "justify-end" : "justify-start"} ${isYou ? "animate-slide-in-right" : "animate-slide-in-left"}`}>
                <div className="group/msg relative flex max-w-[86%] items-end sm:max-w-[74%]">
                  <div className={`absolute z-10 flex flex-col gap-1 ${actionRailPositionClass}`}>
                    {showActionRail && (
                      <div className={`flex flex-col items-center gap-1 rounded-full border border-white/[0.06] bg-[#12121a]/92 px-1.5 py-2 shadow-[0_14px_32px_rgba(0,0,0,0.34)] backdrop-blur-md transition-all duration-200 ${isActionRailExpanded ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95 sm:pointer-events-auto sm:opacity-0 sm:scale-95 sm:group-hover/msg:opacity-100 sm:group-hover/msg:scale-100 sm:group-focus-within/msg:opacity-100 sm:group-focus-within/msg:scale-100"}`}>
                        <button
                          type="button"
                          onClick={() => onReplyToMessage(msg.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-white/80 active:scale-[0.94]"
                          aria-label="Reply"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 14-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedActionMsgId(msg.id);
                            setActiveEmojiPickerMsgId(activeEmojiPickerMsgId === msg.id ? null : msg.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-white/80 active:scale-[0.94]"
                          aria-label="React"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8.5 14s1.2 2 3.5 2 3.5-2 3.5-2"/><path d="M9 10h.01M15 10h.01"/></svg>
                        </button>
                        {canDeleteForEveryone && (
                          <button
                            type="button"
                            onClick={() => onDeleteMessage(msg.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-rose-300/80 transition hover:bg-rose-500/15 hover:text-rose-200 active:scale-[0.94]"
                            aria-label="Delete for everyone"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`flex min-w-0 flex-1 flex-col gap-1 ${isYou ? "items-end" : "items-start"}`}>
                  {msg.replyToId && msg.replyToText && (
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`msg-${msg.replyToId}`);
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                          el.classList.add("ring-2", replyHighlightRing);
                          setTimeout(() => { el.classList.remove("ring-2", "ring-pink-400/50", "ring-blue-400/50"); }, 1500);
                        }
                      }}
                      className={`max-w-full truncate rounded-2xl border px-3 py-1.5 text-[12px] leading-snug backdrop-blur-sm ${replyAccentClass} ${isYou ? "text-right" : "text-left"}`}
                    >
                      <span className={`block text-[10px] font-semibold ${replyLabelClass}`}>{msg.replyToAuthor === "you" ? "You" : "Stranger"}</span>
                      <span className="block truncate">{msg.replyToText}</span>
                    </button>
                  )}

                  <div
                    id={`msg-${msg.id}`}
                    onDoubleClick={() => setActiveEmojiPickerMsgId(activeEmojiPickerMsgId === msg.id ? null : msg.id)}
                    onClick={() => handleMessageTap(msg.id)}
                    onPointerDown={(event) => handleMessagePointerDown(msg.id, event)}
                    onPointerMove={(event) => handleMessagePointerMove(msg.id, isYou, event)}
                    onPointerUp={(event) => handleMessagePointerEnd(event)}
                    onPointerCancel={(event) => handleMessagePointerEnd(event)}
                    onContextMenu={(event) => event.preventDefault()}
                    onDragStart={(event) => event.preventDefault()}
                    style={bubbleStyleWithDirection}
                    className={`relative overflow-hidden rounded-[1.35rem] border px-4 py-3 text-[14px] leading-relaxed break-words shadow-[0_18px_36px_rgba(0,0,0,0.18)] transition-all [overflow-wrap:anywhere] touch-pan-y select-none sm:text-[15px] ${
                    isYou
                      ? "rounded-br-md border-pink-300/10 bg-[linear-gradient(180deg,rgba(131,24,67,0.94),rgba(88,17,45,0.96))] text-rose-50"
                      : `rounded-bl-md border-sky-200/10 bg-[linear-gradient(180deg,rgba(18,44,86,0.96),rgba(10,28,60,0.98))] text-sky-50`
                  } ${msg.isPending ? "opacity-50" : ""}`}>
                    <div className={`pointer-events-none absolute inset-0 opacity-60 ${isYou ? "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_42%)]" : "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_42%)]"}`} />
                    {!msg.isPending && (
                      <span
                        className={`pointer-events-none absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/18 text-white/60 backdrop-blur-sm transition ${swipeIndicatorPositionClass}`}
                        style={{ opacity: Math.abs(swipeOffset) > 10 ? 1 : 0, transform: `translateY(-50%) scale(${Math.abs(swipeOffset) > 10 ? 1 : 0.92})` }}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 14-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg>
                      </span>
                    )}
                    <div className="relative z-[1]">
                      {msg.text}
                    </div>
                    {msg.image && isYou && !msg.imageDeleted && !senderImageExpired && (
                      <div className="relative z-[1] mt-2 space-y-1">
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
                      <div className="relative z-[1] mt-2">
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
                        <div className="group relative z-[1] mt-2 block w-full overflow-hidden rounded-xl">
                          <ChatMedia
                            src={msg.image}
                            alt="Timed image"
                            mimeType={msg.imageMimeType}
                            className="max-w-full rounded-xl blur-lg brightness-50 transition"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRevealedTimedImageIds((current: Set<string>) => {
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
                        <div className="relative z-[1] mt-2 space-y-1">
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

                  {activeEmojiPickerMsgId === msg.id && (
                    <div className={`animate-pop-in flex gap-1 rounded-full border border-white/[0.08] bg-[#14141d]/96 px-2 py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl ${isYou ? "self-end" : "self-start"}`}>
                      {QUICK_REACTIONS.map((emoji: string) => {
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

                  {hasReactions && (
                    <div className={`flex flex-wrap gap-1 ${isYou ? "justify-end" : "justify-start"}`}>
                      {Object.entries(msg.reactions!).map(([emoji, senderIds]: [string, any]) => {
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

                  <span className={`px-1 text-[10px] font-medium tracking-[0.08em] ${isYou ? "text-pink-200/28" : "text-sky-200/28"}`}>{msg.sentAt}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {!isConnecting && strangerIsTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white/[0.06] px-4 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" style={{ animation: "typing-bounce 1.2s ease-in-out infinite" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-white/30" style={{ animation: "typing-bounce 1.2s ease-in-out 0.15s infinite" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-white/20" style={{ animation: "typing-bounce 1.2s ease-in-out 0.3s infinite" }} />
              </div>
            </div>
          )}

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

      <footer
        className="border-t border-white/[0.06] bg-[#0a0a10] px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:px-4 md:pt-2.5 flex-shrink-0"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), calc(0.5rem + var(--keyboard-offset, 0px)))" }}
      >
        <div className="mx-auto w-full max-w-2xl space-y-2">
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
                className="h-full w-full bg-transparent px-4 py-3 text-base text-white outline-none placeholder:text-white/20 sm:text-sm"
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

      {chatFiltersPanel}
    </section>
  );
}
