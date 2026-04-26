"use client";

import * as React from "react";
import Image from "next/image";
import { TierLogo } from "@/components/tier-logo";
import type { ChatFilters, ProfileGender } from "@/components/chat-ui";

type CountryFlagIconProps = { countryCode?: string | null; className?: string };
type GenderIconProps = { gender?: ProfileGender | null; className?: string };

type ChatMessage = {
  id: string;
  author: "you" | "stranger";
  text?: string;
  sentAt: string;
  deletedForEveryone?: boolean;
  imageDeleted?: boolean;
  image?: string | null;
  imageMimeType?: string;
  imageViewTimerSeconds?: number;
  imageExpiresAtMs?: number;
  imageRevealAtMs?: number;
  linkImageUrl?: string | null;
  linkImageMimeType?: string;
  imageUnavailable?: boolean;
  imageDecrypting?: boolean;
  isPending?: boolean;
  reactions?: Record<string, string[]>;
  createdAtMs?: number;
  replyToId?: string;
  replyToText?: string;
  replyToAuthor?: "you" | "stranger";
};

type ChatMediaProps = {
  src: string;
  alt: string;
  mimeType?: string;
  className?: string;
};

type ReplyTarget = {
  author: "you" | "stranger";
  text?: string;
  image?: string | null;
};

type ChatRoomTextViewProps = {
  chatContainerRef: React.RefObject<HTMLElement | null>;
  isFullscreenActive: boolean;
  showBackConfirm: boolean;
  setShowBackConfirm: (value: boolean) => void;
  onChangeMode: () => void;
  GenderIcon: React.ComponentType<GenderIconProps>;
  strangerProfile: { gender?: ProfileGender | null; age?: string | number; countryCode?: string | null };
  isConnecting: boolean;
  hasResolvedStrangerProfile: boolean;
  CountryFlagIcon: React.ComponentType<CountryFlagIconProps>;
  subscriptionTier?: "vip" | "vvip" | null;
  connectingStatus: string;
  modeLabel: string;
  genderLabel: string;
  setShowChatFilters: (value: boolean) => void;
  chatFilterActiveCount: number;
  showNextStrangerPrompt: boolean;
  onNextStranger: () => void;
  showLeaveConfirm: boolean;
  setShowLeaveConfirm: (value: boolean) => void;
  chatFilters: ChatFilters | null;
  onLeaveChat: (filters: ChatFilters) => void;
  toggleFullscreen: () => void;
  messagesViewportRef: React.RefObject<HTMLDivElement | null>;
  handleMessagesScroll: () => void;
  messages: ChatMessage[];
  IMAGE_DELETED_NOTICE: string;
  nowMs: number;
  swipePreview: { id: string; offset: number } | null;
  expandedActionMsgId: string | null;
  setExpandedActionMsgId: (value: string | null | ((current: string | null) => string | null)) => void;
  activeEmojiPickerMsgId: string | null;
  setActiveEmojiPickerMsgId: (value: string | null) => void;
  currentUserId: string;
  onReplyToMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  handleMessageTap: (messageId: string) => void;
  handleMessagePointerDown: (messageId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  handleMessagePointerMove: (messageId: string, authoredByCurrentUser: boolean, event: React.PointerEvent<HTMLDivElement>) => void;
  handleMessagePointerEnd: (event?: React.PointerEvent<HTMLDivElement>) => void;
  ChatMedia: React.ComponentType<ChatMediaProps>;
  revealedTimedImageIds: Set<string>;
  setRevealedTimedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onRevealTimedImage: (messageId: string, seconds: number) => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  QUICK_REACTIONS: string[];
  strangerIsTyping: boolean;
  showScrollToLatestBubble: boolean;
  scrollToLatestMessage: () => void;
  unreadReceivedCount: number;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  replyingTo: ReplyTarget | null;
  clearReply: () => void;
  imagePreview: string | null;
  isGifFilename: (filename?: string | null) => boolean;
  selectedFileName: string | null;
  isSendingMessage: boolean;
  imageUploadProgress: number | null;
  imageTimerSeconds: number;
  setImageTimerSeconds?: (seconds: number) => void;
  clearAttachment: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  messageInputRef: React.RefObject<HTMLInputElement | null>;
  text: string;
  setText: (value: string) => void;
  sendMessage: () => void;
  sendError: string | null;
  onSelectImage: React.ChangeEventHandler<HTMLInputElement>;
  chatFiltersPanel: React.ReactNode;
};

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
  setShowChatFilters,
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
}: ChatRoomTextViewProps) {
  const [showImageSourcePicker, setShowImageSourcePicker] = React.useState(false);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const imageSourceSheetRef = React.useRef<HTMLDivElement | null>(null);

  const preventSendButtonFocus = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  React.useEffect(() => {
    if (!showImageSourcePicker) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowImageSourcePicker(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showImageSourcePicker]);

  const openImageSourcePicker = () => {
    setShowImageSourcePicker(true);
  };

  const openGalleryPicker = () => {
    setShowImageSourcePicker(false);
    fileInputRef.current?.click();
  };

  const openCameraPicker = () => {
    setShowImageSourcePicker(false);
    cameraInputRef.current?.click();
  };

  const handleSelectImage: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    setShowImageSourcePicker(false);
    onSelectImage(event);
  };

  return (
    <section
      ref={chatContainerRef}
      className={`${isFullscreenActive ? "fixed inset-0 z-50 mt-0 h-dvh rounded-none bg-[#08080c] shadow-none" : "mt-0 h-[calc(var(--vh,1dvh)*100-5.5rem)] rounded-2xl bg-[#08080c] shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out sm:h-[calc(var(--vh,1dvh)*100-6rem)] md:rounded-3xl"} relative flex w-full max-w-none flex-col overflow-hidden border border-white/[0.04] overscroll-contain touch-manipulation`}
    >
      <header className={`${isFullscreenActive ? "bg-[#0d0d14]" : "bg-[#0d0d14]/40 backdrop-blur-2xl transition-all duration-300 ease-out"} flex items-center gap-1.5 border-b border-white/[0.04] px-2 py-2 overflow-x-auto sm:gap-2 sm:px-3 sm:py-2.5 sm:px-5 sm:py-3.5 will-change-auto`}>
        {!showBackConfirm ? (
          <button
            onClick={() => setShowBackConfirm(true)}
            className="group flex h-10 items-center justify-center rounded-xl bg-white/[0.03] px-3.5 text-xs font-bold text-white/50 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 animate-pop-in">
            <button onClick={() => { setShowBackConfirm(false); onChangeMode(); }} className="h-9 rounded-xl bg-rose-500/20 px-3.5 text-xs font-bold text-rose-400 border border-rose-500/20 hover:bg-rose-500/30 transition-all">Exit?</button>
            <button onClick={() => setShowBackConfirm(false)} className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.05] text-white/60 hover:bg-white/[0.1] transition-all"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
          </div>
        )}

        <div className="flex-1 flex items-center gap-3 ml-1">
          <div className="relative flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-white/[0.08] to-transparent text-white/80 ring-1 ring-white/[0.05] shadow-inner">
              <GenderIcon gender={strangerProfile.gender} className="h-5 w-5" />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2.5px] border-[#0d0d14] ${isConnecting ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"}`} style={isConnecting ? { animation: "ripple 1.5s ease-out infinite" } : {}} />
          </div>
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-2">
              {hasResolvedStrangerProfile ? (
                <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-white/95">
                  <CountryFlagIcon countryCode={strangerProfile.countryCode} className="h-3.5 w-[1.35rem] rounded-[3px] object-cover shadow-sm" />
                  {strangerProfile.gender}, {strangerProfile.age}
                </span>
              ) : (
                <span className="text-sm font-bold text-white/30 tracking-tight">Searching...</span>
              )}
              {subscriptionTier && (
                <TierLogo
                  tier={subscriptionTier}
                  size="xs"
                  className={`rounded-lg px-2 py-0.5 ring-1 ${subscriptionTier === "vvip" ? "bg-amber-400/5 ring-amber-400/10 text-amber-200" : "bg-pink-500/5 ring-pink-500/10 text-pink-200"}`}
                />
              )}
            </div>
            <div className="flex items-center gap-1.5 opacity-40">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/80">
                {isConnecting ? connectingStatus : modeLabel}
              </span>
              <span className="h-0.5 w-0.5 rounded-full bg-white/40" />
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/80">
                {genderLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-lg sm:rounded-2xl bg-white/[0.03] text-white/40 transition-all duration-200 hover:bg-white/[0.06] hover:text-white active:scale-95 flex-shrink-0"
            aria-label={isFullscreenActive ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreenActive ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreenActive ? (
              <svg className="h-4 sm:h-4.5 w-4 sm:w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            ) : (
              <svg className="h-4 sm:h-4.5 w-4 sm:w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowChatFilters(true)}
            className="group relative flex h-9 sm:h-10 items-center gap-1 sm:gap-2 rounded-lg sm:rounded-2xl bg-white/[0.03] px-2.5 sm:px-4 border border-white/[0.03] transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.08] active:scale-95 flex-shrink-0"
          >
            <svg className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-white/40 group-hover:text-white/80 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
            <span className="hidden sm:inline text-xs font-bold text-white/60 group-hover:text-white/90">Filters</span>
            {chatFilterActiveCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-lg bg-pink-500 text-[10px] font-black text-white shadow-lg shadow-pink-500/20">{chatFilterActiveCount}</span>
            )}
          </button>

          {showNextStrangerPrompt ? (
            <button
              onClick={onNextStranger}
              className="animate-pop-in flex h-9 sm:h-10 items-center justify-center rounded-lg sm:rounded-2xl bg-emerald-500 px-3 sm:px-5 text-[11px] sm:text-xs font-black uppercase tracking-widest text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all duration-200 hover:bg-emerald-400 hover:scale-[1.02] active:scale-95 flex-shrink-0"
            >
              Next
            </button>
          ) : !isConnecting ? (
            <div className="flex items-center gap-1 sm:gap-2">
              {!showLeaveConfirm ? (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-lg sm:rounded-2xl bg-white/[0.03] text-rose-400 transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-300 active:scale-95 flex-shrink-0"
                >
                  <svg className="h-4 sm:h-5 w-4 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                </button>
              ) : (
                <div className="flex items-center gap-1 animate-pop-in">
                  <button onClick={() => { setShowLeaveConfirm(false); if (chatFilters) onLeaveChat(chatFilters); }} className="h-9 sm:h-10 rounded-lg sm:rounded-2xl bg-rose-500 px-2.5 sm:px-4 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-rose-500/20 transition-all duration-200 hover:bg-rose-400">Leave</button>
                  <button onClick={() => setShowLeaveConfirm(false)} className="h-9 sm:h-10 w-9 sm:w-10 flex items-center justify-center rounded-lg sm:rounded-2xl bg-white/[0.05] text-white/60 hover:bg-white/[0.1] transition-all duration-200"><svg className="h-3.5 sm:h-4 w-3.5 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <div
        ref={messagesViewportRef}
        onScroll={handleMessagesScroll}
        className={`${isFullscreenActive ? "px-3 py-4 sm:px-4 md:px-8" : "px-4 py-6 md:px-8"} relative min-h-0 flex-1 overflow-y-auto overscroll-contain`}
        style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "auto", contain: "layout paint style" }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {isConnecting && (
            <div className="animate-fade-in flex flex-col items-center justify-center py-20">
              <div className="relative h-44 w-44">
                {/* Slow outer halo */}
                <div className="absolute -inset-4 animate-[spin_12s_linear_infinite] rounded-full border border-white/[0.03]" />

                {/* Ring 1 – wide orbit */}
                <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full border border-dashed border-white/[0.06]">
                  <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
                </div>

                {/* Ring 2 – mid orbit, reverse */}
                <div className="absolute inset-6 animate-[spin_4s_linear_infinite_reverse] rounded-full border border-white/[0.08]">
                  <div className="absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                </div>

                {/* Ring 3 – tight orbit */}
                <div className="absolute inset-12 animate-[spin_2.5s_linear_infinite] rounded-full border border-white/[0.1]">
                  <div className="absolute -top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white/60 shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                </div>

                {/* Core */}
                <div className="absolute inset-[38%]">
                  <div className="relative h-full w-full">
                    <div className="absolute -inset-1 animate-ping rounded-full bg-white/[0.06]" />
                    <div className="absolute inset-0 rounded-full bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.25)]" />
                    <div className="absolute inset-[3px] rounded-full bg-[#08080c]" />
                    <div className="absolute inset-[6px] rounded-full bg-white/80" />
                  </div>
                </div>
              </div>

              <div className="mt-14 flex flex-col items-center gap-4">
                <div className="flex gap-[6px]">
                  <span className="h-[3px] w-[3px] animate-[bounce_1s_infinite_-0.32s] rounded-full bg-white/50" />
                  <span className="h-[3px] w-[3px] animate-[bounce_1s_infinite_-0.16s] rounded-full bg-white/50" />
                  <span className="h-[3px] w-[3px] animate-[bounce_1s_infinite] rounded-full bg-white/50" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/25">{connectingStatus}</p>
              </div>
            </div>
          )}

          {hasResolvedStrangerProfile && (
            <div className="animate-fade-in flex justify-center py-4">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/10 bg-emerald-500/[0.03] px-4 py-1.5 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400/80">Stranger Connected</span>
              </div>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.deletedForEveryone) {
              return (
                <div key={msg.id} className={`flex ${msg.author === "you" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex items-center gap-1.5 rounded-2xl border px-4 py-2.5 ${msg.author === "you" ? "border-pink-600/15 bg-pink-600/[0.08]" : "border-blue-900/25 bg-blue-900/[0.14]"}`}>
                    <svg className={`h-3.5 w-3.5 ${msg.author === "you" ? "text-pink-500/40" : "text-blue-600/50"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                    <span className={`text-[13px] italic ${msg.author === "you" ? "text-pink-400/50" : "text-blue-500/60"}`}>{msg.author === "you" ? "You deleted this message" : "This message was deleted"}</span>
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
            
            // Image is revealed if: already in Set OR imageRevealAtMs is in the past
            const isTimedImageRevealed = revealedTimedImageIds.has(msg.id) || 
              (typeof msg.imageRevealAtMs === "number" && nowMs >= msg.imageRevealAtMs && (!msg.imageExpiresAtMs || nowMs < msg.imageExpiresAtMs));

            const isYou = msg.author === "you";
            const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
            const canDeleteForEveryone = isYou && typeof msg.createdAtMs === "number" && (nowMs - msg.createdAtMs) < 30000;
            const swipeOffset = swipePreview?.id === msg.id ? swipePreview.offset : 0;
            const showActionRail = !msg.isPending && !isConnecting;
            const isActionRailExpanded = expandedActionMsgId === msg.id;
            const replyTargetsYou = msg.replyToAuthor === "you";
            const replyAccentClass = replyTargetsYou
              ? "border-pink-600/25 bg-pink-600/15 text-white/75"
              : "border-blue-900/35 bg-blue-900/20 text-white/75";
            const replyLabelClass = replyTargetsYou ? "text-pink-400/90" : "text-blue-500/90";
            const replyHighlightRing = replyTargetsYou ? "ring-pink-600/50" : "ring-blue-900/50";
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
                <div className="group/msg relative flex max-w-[86%] items-end sm:max-w-[74%]" style={{ WebkitTouchCallout: "none" }}>
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
                    className={`relative overflow-hidden rounded-[1.5rem] border px-4.5 py-3.5 text-[15px] leading-[1.6] break-words shadow-[0_12px_40px_rgba(0,0,0,0.15)] transition-all [overflow-wrap:anywhere] touch-pan-y select-none ${
                    isYou
                      ? "rounded-br-sm border-pink-500/20 bg-gradient-to-b from-pink-700/95 to-pink-800/98 text-white/95"
                      : "rounded-bl-sm border-blue-900/35 bg-gradient-to-b from-blue-900/95 to-blue-950/98 text-white/90"
                  } ${msg.isPending ? "opacity-40" : ""}`}>
                    <div className={`pointer-events-none absolute inset-0 opacity-40 ${isYou ? "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" : "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_60%)]"}`} />
                    {!msg.isPending && (
                      <span
                        className={`pointer-events-none absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur-md transition ${swipeIndicatorPositionClass}`}
                        style={{ opacity: Math.abs(swipeOffset) > 10 ? 1 : 0, transform: `translateY(-50%) scale(${Math.abs(swipeOffset) > 10 ? 1 : 0.8})` }}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 14-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg>
                      </span>
                    )}
                    <div className="relative z-[1] drop-shadow-sm font-medium">
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
                      msg.imageViewTimerSeconds && msg.imageViewTimerSeconds > 0 && !isTimedImageRevealed ? (
                        <div className="group relative z-[1] mt-2 block w-full overflow-hidden rounded-xl">
                          <ChatMedia
                            src={msg.image}
                            alt="Timed image"
                            mimeType={msg.imageMimeType}
                            className="max-w-full rounded-xl blur-lg brightness-50 transition"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setRevealedTimedImageIds((current) => {
                                const next = new Set(current);
                                next.add(msg.id);
                                return next;
                              });
                              onRevealTimedImage(msg.id, msg.imageViewTimerSeconds ?? 0);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerMove={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onPointerCancel={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white pointer-events-auto cursor-pointer z-20"
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
                      {Object.entries(msg.reactions ?? {}).map(([emoji, senderIds]) => {
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
                                  ? "border border-pink-600/50 bg-pink-600/20 text-white/85"
                                  : "border border-blue-900/65 bg-blue-900/35 text-white/85"
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
            <div className="pointer-events-none sticky bottom-3 z-10 flex justify-center transition-all duration-300 ease-out">
              <button
                type="button"
                onClick={scrollToLatestMessage}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2 text-xs font-medium text-white/60 shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-white/[0.12] hover:text-white/80"
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
        className={`${isFullscreenActive ? "bg-[#0c0c14]" : "bg-[#0c0c14]/60 backdrop-blur-3xl transition-all duration-300 ease-out"} border-t border-white/[0.03] px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 md:px-6 md:pt-4 flex-shrink-0`}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), calc(0.75rem + var(--keyboard-offset, 0px)))" }}
      >
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {replyingTo && (
            <div className={`animate-fade-in flex items-center gap-3 rounded-[1.25rem] border px-4 py-2.5 backdrop-blur-xl transition-all duration-300 ease-out ${replyingTo.author === "you" ? "border-pink-600/20 bg-pink-600/[0.08]" : "border-blue-900/35 bg-blue-900/[0.18]"}`}>
              <div className={`min-w-0 flex-1 border-l-[3px] pl-3.5 ${replyingTo.author === "you" ? "border-pink-600/40" : "border-blue-900/55"}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${replyingTo.author === "you" ? "text-pink-500" : "text-blue-600"}`}>{replyingTo.author === "you" ? "You" : "Stranger"}</p>
                <p className="truncate text-[13px] text-white/50 font-medium">{replyingTo.text || (replyingTo.image ? "Photo" : "Message")}</p>
              </div>
              <button
                type="button"
                onClick={clearReply}
                className="flex-shrink-0 rounded-xl p-2 text-white/20 transition hover:bg-white/[0.04] hover:text-white/50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {imagePreview && (
            <div className="animate-fade-in relative flex items-center gap-4 rounded-[1.5rem] border border-white/[0.04] bg-white/[0.02] p-4 shadow-2xl backdrop-blur-2xl transition-all duration-300 ease-out">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-white/[0.06] shadow-inner">
                {isGifFilename(selectedFileName) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Image src={imagePreview} alt="Preview" width={64} height={64} className="h-full w-full object-cover" unoptimized />
                )}
                {isSendingMessage && imageUploadProgress !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                    <span className="text-[10px] font-black text-white">{Math.round(imageUploadProgress)}%</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="truncate text-xs font-bold text-white/40" title={selectedFileName ?? "Selected image"}>
                    {selectedFileName ?? "Selected image"}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5">
                  {[0, 3, 5, 10, 15].map((seconds) => {
                    const isActive = imageTimerSeconds === seconds;
                    return (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => setImageTimerSeconds?.(seconds)}
                        disabled={isSendingMessage}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all ${isActive ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20" : "bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-white/50"} disabled:opacity-30`}
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
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/[0.03] text-white/20 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          <div className="flex items-end gap-2.5">
            <button
              disabled={isSendingMessage || !hasResolvedStrangerProfile}
              onClick={openImageSourcePicker}
              aria-label="Add image or GIF"
              title="Add image or GIF"
              className="flex h-[3.25rem] w-[3.25rem] flex-shrink-0 items-center justify-center rounded-[1.25rem] bg-white/[0.03] border border-white/[0.02] text-white/20 transition-all duration-200 hover:bg-white/[0.08] hover:text-white active:scale-95 disabled:opacity-10"
            >
              <svg className="h-5.5 w-5.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14m7-7H5" /></svg>
            </button>

            <div className="relative flex min-h-[3.25rem] flex-1 items-center rounded-[1.25rem] border border-white/[0.04] bg-white/[0.02] shadow-inner transition-all duration-300 ease-out focus-within:border-pink-500/20 focus-within:bg-white/[0.03]" style={{ WebkitTouchCallout: "none" }}>
              <input
                ref={messageInputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSendingMessage && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isConnecting ? "Finding someone..." : !hasResolvedStrangerProfile ? "Waiting for someone..." : "Type a message..."}
                disabled={isSendingMessage || !hasResolvedStrangerProfile}
                className="h-full w-full bg-transparent px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-[15px] font-medium text-white outline-none placeholder:text-white/10 resize-none overflow-hidden"
                style={{ WebkitUserSelect: "text", fontSize: "16px" }}
              />
            </div>

            <button
              onPointerDown={preventSendButtonFocus}
              onClick={sendMessage}
              disabled={isSendingMessage || (!text.trim() && !imagePreview) || !hasResolvedStrangerProfile}
              className={`group relative flex h-[3.25rem] w-[3.25rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] bg-pink-500 text-white shadow-[0_8px_20px_rgba(236,72,153,0.3)] transition-all duration-200 hover:bg-pink-400 hover:scale-[1.02] active:scale-95 disabled:opacity-10 disabled:grayscale disabled:scale-100 ${isSendingMessage ? "animate-[send-pulse_1.5s_ease-in-out_infinite]" : ""}`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {isSendingMessage ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-[2.5px] border-white/30 border-t-white" />
              ) : (
                <svg className="relative z-10 h-5 w-5 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              )}
            </button>
          </div>

          {sendError && (
            <p className="animate-fade-in px-2 text-[11px] font-bold uppercase tracking-wider text-rose-400/80 transition-all duration-300 ease-out">{sendError}</p>
          )}
        </div>
      </footer>

      <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.gif" onChange={handleSelectImage} />
      <input ref={cameraInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={handleSelectImage} />

      {showImageSourcePicker && (
        <div
          className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
          onClick={() => setShowImageSourcePicker(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Choose image source"
        >
          <div
            ref={imageSourceSheetRef}
            className="animate-pop-in w-full max-w-md rounded-[1.75rem] border border-white/[0.06] bg-[#101018]/96 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/10 sm:hidden" />

            <div className="mb-3 flex items-start justify-between gap-3 px-1 sm:mb-4">
              <div>
                <h3 className="text-base font-black tracking-tight text-white">Add a photo</h3>
                <p className="mt-1 text-sm text-white/45">Choose from your gallery or open the camera.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImageSourcePicker(false)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] text-white/40 transition-all duration-200 hover:bg-white/[0.08] hover:text-white/70"
                aria-label="Close image source picker"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={openGalleryPicker}
                className="group flex min-h-[4.75rem] items-center gap-3 rounded-[1.35rem] border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-left transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.09] active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-white/80 transition-colors group-hover:bg-white/[0.1] group-hover:text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 7a2 2 0 0 1 2-2h3l1.2 1.5H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3" /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-white">Choose image</span>
                  <span className="mt-0.5 block text-xs text-white/40">Photos, screenshots, and GIFs</span>
                </span>
              </button>

              <button
                type="button"
                onClick={openCameraPicker}
                className="group flex min-h-[4.75rem] items-center gap-3 rounded-[1.35rem] border border-pink-500/15 bg-pink-500/10 px-4 py-3 text-left transition-all duration-200 hover:bg-pink-500/16 hover:border-pink-500/25 active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-100 transition-colors group-hover:bg-pink-500/25">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 8a2 2 0 0 1 2-2h2l1.25-1.5h5.5L16 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-white">Take photo</span>
                  <span className="mt-0.5 block text-xs text-pink-100/70">Open the camera and send right away</span>
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowImageSourcePicker(false)}
              className="mt-2 flex w-full items-center justify-center rounded-[1.2rem] px-4 py-3 text-sm font-bold text-white/45 transition-all duration-200 hover:bg-white/[0.04] hover:text-white/70 sm:mt-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {chatFiltersPanel}
    </section>
  );
}