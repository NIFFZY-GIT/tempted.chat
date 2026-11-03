"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatFilters, ChatMessage } from "@/components/chat-ui";
import { 
    ChevronLeft, X, MessageCircle, Mic, MicOff, Camera, VideoOff, 
    RefreshCw, Send, Settings2, Sparkles, ArrowRight, SkipForward
} from "lucide-react";
import { PoweredBy } from "@/components/developed-by";

type ChatRoomVideoViewProps = {
    chatContainerRef: React.RefObject<HTMLElement | null>;
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    localVideoRef: React.RefObject<HTMLVideoElement | null>;
    isConnecting: boolean;
    hasResolvedStrangerProfile: boolean;
    remoteAudioEnabled: boolean;
    hasRemoteVideo: boolean;
    connectingStatus: string;
    showNextStrangerPrompt: boolean;
    localVideoEnabled: boolean;
    showBackConfirm: boolean;
    setShowBackConfirm: (value: boolean) => void;
    onChangeMode: () => void;
    GenderIcon?: React.ComponentType<{ gender?: string | null; className?: string }>;
    strangerProfile: { gender?: string | null; age?: string | number; countryCode?: string | null };
    CountryFlagIcon: React.ComponentType<{ countryCode?: string | null; className?: string }>;
    subscriptionTier?: "vip" | "vvip" | null;
    showLeaveConfirm: boolean;
    setShowLeaveConfirm: (value: boolean) => void;
    chatFilters: ChatFilters | null;
    onLeaveChat: (filters: ChatFilters) => void;
    onNextStranger: () => void;
    setShowChatFilters: (value: boolean) => void;
    hasActiveSubscription?: boolean;
    chatFilterActiveCount: number;
    showVideoChatOverlay: boolean;
    setShowVideoChatOverlay: (value: boolean) => void;
    messagesViewportRef: React.RefObject<HTMLDivElement | null>;
    handleMessagesScroll: () => void;
    messages: ChatMessage[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    replyingTo?: ChatMessage | null;
    clearReply?: () => void;
    messageInputRef: React.RefObject<HTMLInputElement | null>;
    text: string;
    setText: (value: string) => void;
    isSendingMessage: boolean;
    sendMessage: () => void;
    toggleLocalAudio: () => void;
    localAudioEnabled: boolean;
    toggleLocalVideo: () => void;
    switchCamera: () => void;
    videoError: string | null;
    chatFiltersPanel: React.ReactNode;
    onShowPaywall?: () => void;
};

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
    onShowPaywall,
}: ChatRoomVideoViewProps) {
    void GenderIcon;
    void subscriptionTier;
    void showLeaveConfirm;
    void setShowLeaveConfirm;
    void chatFilters;
    void onLeaveChat;
    void hasActiveSubscription;
    void replyingTo;
    void clearReply;
    void onShowPaywall;

    const preventSendButtonFocus = (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    useEffect(() => {
        document.body.classList.add("video-chat-active");
        return () => {
            document.body.classList.remove("video-chat-active");
        };
    }, []);

	return (
		<section
			ref={chatContainerRef}
            className="fixed inset-0 z-[60] flex flex-col bg-[#050508] touch-manipulation overscroll-contain overflow-hidden select-none"
		>
			{/* ─── VIDEO GRID (ELEGANT CINEMATIC SPLIT) ─── */}
			<div className="flex h-[calc(var(--vh,1dvh)*100)] w-full flex-col sm:flex-row gap-2 p-2 sm:p-3">
				
                {/* STRANGER PANEL */}
				<div className="relative flex-1 overflow-hidden bg-[#0a0a12] rounded-2xl sm:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
					<video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover rounded-none" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
					
                    {/* Status Overlays */}
                    <AnimatePresence>
                        {(isConnecting || !hasRemoteVideo) && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#07070e]/92 backdrop-blur-2xl"
                            >
                                {/* MODERN PULSING ORBITAL RADAR */}
                                <div className="relative h-44 w-44 sm:h-52 sm:w-52 mb-6 flex items-center justify-center">
                                    {/* Outer ambient wave */}
                                    <div className="absolute inset-0 rounded-full border border-pink-500/20 animate-[ping_3.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
                                    
                                    {/* Concentric rotating rings */}
                                    <div className="absolute inset-0 rounded-full border border-white/10 animate-[spin_16s_linear_infinite]" />
                                    <div className="absolute inset-4 rounded-full border border-dashed border-pink-500/35 animate-[spin_9s_linear_infinite_reverse]">
                                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-pink-500 shadow-[0_0_14px_rgba(236,72,153,0.9)]" />
                                    </div>
                                    <div className="absolute inset-10 rounded-full border border-violet-500/30 animate-[spin_6s_linear_infinite]">
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />
                                    </div>
                                    
                                    {/* Radar sweep beam */}
                                    <div className="absolute inset-0 rounded-full animate-[spin_4s_linear_infinite] overflow-hidden pointer-events-none">
                                        <div className="h-1/2 w-1/2 ml-auto bg-gradient-to-br from-pink-500/25 via-pink-500/5 to-transparent rounded-tr-full origin-bottom-left" />
                                    </div>

                                    {/* Center glowing core */}
                                    <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-pink-500/25 via-violet-500/20 to-black/60 border border-pink-500/40 flex items-center justify-center shadow-[0_0_35px_rgba(236,72,153,0.4)]">
                                        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.8)] animate-pulse" />
                                    </div>
                                </div>

                                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-100 to-rose-300 drop-shadow-md">
                                    {isConnecting ? "Scanning..." : "Waiting"}
                                </h3>
                                
                                {/* High-visibility, crisp legible status */}
                                <p className="text-xs sm:text-sm font-semibold text-white/80 text-center max-w-xs mt-2.5 leading-relaxed tracking-wide drop-shadow-sm">
                                    {connectingStatus || "Looking for someone to match..."}
                                </p>

                                {/* Direct CTA button when stranger disconnects */}
                                {showNextStrangerPrompt && (
                                    <motion.button 
                                        initial={{ scale: 0.9, opacity: 0 }} 
                                        animate={{ scale: 1, opacity: 1 }} 
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={onNextStranger}
                                        className="mt-6 flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-extrabold uppercase tracking-wider text-xs shadow-[0_0_30px_rgba(244,63,94,0.45)] border border-pink-400/40 transition-all cursor-pointer"
                                    >
                                        <Sparkles size={15} />
                                        <span>Find Next Stranger</span>
                                        <ArrowRight size={15} />
                                    </motion.button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Stranger Identity Pill */}
                    {!isConnecting && hasResolvedStrangerProfile && (
						<motion.div 
                            initial={{ opacity: 0, y: -10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-20 left-4 z-30 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/65 border border-white/20 backdrop-blur-2xl shadow-xl"
                        >
                            <div className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </div>
                            <CountryFlagIcon countryCode={strangerProfile.countryCode} className="h-3.5 w-4.5 rounded-sm object-cover" />
                            <span className="text-[12px] font-bold text-white tracking-wide uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                {strangerProfile.gender || "Stranger"}
                                {strangerProfile.age ? ` • ${strangerProfile.age}` : ""}
                            </span>
                        </motion.div>
                    )}
				</div>

				{/* YOU PANEL */}
				<div className="relative flex-1 overflow-hidden bg-[#0a0a12] rounded-2xl sm:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
					<video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover [transform:scaleX(-1)] rounded-none" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 via-black/20 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
					
                    {!localVideoEnabled && (
						<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md">
							<div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                                <VideoOff size={28} className="text-white/40" />
                            </div>
                            <span className="text-xs font-semibold text-white/50 tracking-wider uppercase">Camera Off</span>
						</div>
					)}

                    {/* YOU Status Badge — placed at TOP-RIGHT so it NEVER collides with bottom dock controls */}
                    <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/65 border border-white/20 backdrop-blur-2xl text-[11px] font-bold text-white/90 shadow-xl">
                        <div className="h-2 w-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.7)]" />
                        <span>You</span>
                        {!localAudioEnabled && <MicOff size={13} className="text-rose-400 ml-0.5" />}
                    </div>
				</div>
			</div>

			{/* ─── TOP NAVIGATION ─── */}
			<header className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-4 sm:py-6 pointer-events-none">
				<div className="pointer-events-auto">
                    {!showBackConfirm ? (
						<button 
                            onClick={() => setShowBackConfirm(true)} 
                            className="h-11 w-11 rounded-full bg-black/65 border border-white/20 backdrop-blur-2xl flex items-center justify-center text-white/80 hover:text-white hover:bg-black/75 hover:border-white/30 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.4)] active:scale-95"
                            title="Exit video chat"
                        >
                            <ChevronLeft size={22} />
                        </button>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            className="flex items-center gap-1.5 bg-black/80 border border-rose-500/30 rounded-full p-1 backdrop-blur-2xl shadow-xl"
                        >
                            <button 
                                onClick={() => onChangeMode()} 
                                className="px-4 py-1.5 rounded-full bg-rose-600 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md hover:bg-rose-500 active:scale-95 transition-all"
                            >
                                Leave
                            </button>
                            <button 
                                onClick={() => setShowBackConfirm(false)} 
                                className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-white/50 hover:text-white/80 transition-all"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    )}
                </div>

                <div className="pointer-events-auto">
                    <button 
                        onClick={() => setShowChatFilters(true)}
						className="h-11 px-4 sm:px-5 rounded-full bg-black/65 border border-white/20 backdrop-blur-2xl flex items-center gap-2.5 text-white/80 hover:text-white hover:bg-black/75 hover:border-white/30 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.4)] active:scale-95"
                    >
                        <Settings2 size={16} className={chatFilterActiveCount > 0 ? "text-pink-400" : ""} />
                        <span className="text-[11px] font-bold uppercase tracking-widest">Filters</span>
                        {chatFilterActiveCount > 0 && (
                            <span className="h-5 min-w-5 px-1.5 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-black shadow-[0_0_12px_rgba(236,72,153,0.7)]">
                                {chatFilterActiveCount}
                            </span>
                        )}
                    </button>
                </div>
			</header>

			{/* ─── OVERLAY CHAT DRAWER ─── */}
            <AnimatePresence>
                {showVideoChatOverlay && (
                    <motion.div 
                        initial={{ opacity: 0, y: "100%" }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 260 }}
                        className="absolute inset-x-3 sm:inset-x-8 bottom-28 top-20 z-50 max-w-lg mx-auto bg-[#0a0a14]/92 border border-white/15 backdrop-blur-3xl rounded-3xl flex flex-col overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
                    >
                        <div className="px-5 py-4 border-b border-white/[0.08] flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white/70">In-Call Messages</span>
                            </div>
                            <button 
                                onClick={() => setShowVideoChatOverlay(false)}
                                className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div 
                            ref={messagesViewportRef} 
                            onScroll={handleMessagesScroll}
                            className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar"
                        >
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30">
                                    <MessageCircle size={32} className="mb-2 opacity-40" />
                                    <p className="text-xs font-medium">No messages yet. Send a message to break the ice!</p>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.author === 'you' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-lg ${
                                            msg.author === 'you' 
                                                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-br-xs' 
                                                : 'bg-white/10 border border-white/10 text-white rounded-bl-xs'
                                        }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-3 bg-black/50 border-t border-white/[0.08] flex gap-2 items-center">
                            <input 
                                ref={messageInputRef} 
                                value={text} 
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                placeholder="Type a message..." 
                                className="flex-1 bg-white/[0.07] border border-white/10 focus:border-pink-500/50 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/40 outline-none transition-all" 
                            />
                            <button 
                                onPointerDown={preventSendButtonFocus} 
                                onClick={sendMessage} 
                                disabled={!text.trim() || isSendingMessage}
                                className="h-11 w-11 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <Send size={17} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

			{/* ─── DOCK CONTROLS (FLOATING MODERN PILL) ─── */}
			<div className="absolute inset-x-0 bottom-8 z-40 flex flex-col items-center gap-3 px-4">
                
                {/* Stranger Muted / Camera Off Indicators — ONLY shown when a stranger is actually connected! */}
                {!isConnecting && hasResolvedStrangerProfile && (!remoteAudioEnabled || !hasRemoteVideo) && (
                    <div className="flex gap-2">
                        {!remoteAudioEnabled && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/25 border border-rose-500/40 rounded-full text-[10px] font-bold text-rose-300 uppercase tracking-wider backdrop-blur-2xl shadow-xl">
                                <MicOff size={12} />
                                <span>Stranger Muted</span>
                            </div>
                        )}
                        {!hasRemoteVideo && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/25 border border-amber-500/40 rounded-full text-[10px] font-bold text-amber-300 uppercase tracking-wider backdrop-blur-2xl shadow-xl">
                                <VideoOff size={12} />
                                <span>Stranger Camera Off</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Floating Action Pill */}
                <div className="flex items-center gap-2 sm:gap-3 bg-black/75 border border-white/20 backdrop-blur-3xl px-3 py-2 sm:px-4 sm:py-2.5 rounded-full shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
                    <ControlButton 
                        onClick={() => setShowVideoChatOverlay(!showVideoChatOverlay)} 
                        icon={<MessageCircle size={19} />} 
                        active={showVideoChatOverlay} 
                        accent="pink" 
                        tooltip="Chat"
                    />

                    <ControlButton 
                        onClick={toggleLocalAudio} 
                        icon={localAudioEnabled ? <Mic size={19} /> : <MicOff size={19} />} 
                        active={!localAudioEnabled} 
                        accent="rose" 
                        tooltip={localAudioEnabled ? "Mute" : "Unmute"}
                    />

                    {/* THE NEXT / SKIP ACTION BUTTON */}
                    <div className="flex items-center">
                        <AnimatePresence mode="wait">
                            {showNextStrangerPrompt ? (
                                <motion.button 
                                    key="next" 
                                    initial={{ scale: 0.85, opacity: 0 }} 
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.85, opacity: 0 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={onNextStranger}
                                    className="h-11 px-5 sm:px-6 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-black uppercase tracking-wider text-xs shadow-[0_0_24px_rgba(244,63,94,0.45)] flex items-center gap-1.5 border border-pink-400/30 transition-all cursor-pointer"
                                >
                                    <span>Next</span>
                                    <ArrowRight size={14} className="stroke-[2.5]" />
                                </motion.button>
                            ) : !isConnecting ? (
                                <motion.button 
                                    key="skip" 
                                    initial={{ opacity: 0 }} 
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={onNextStranger}
                                    className="h-11 px-5 sm:px-6 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 font-bold uppercase tracking-wider text-xs shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <span>Skip</span>
                                    <SkipForward size={14} className="stroke-[2.5]" />
                                </motion.button>
                            ) : (
                                <div className="h-11 px-4 rounded-full bg-white/5 border border-white/10 text-white/35 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-pink-500 animate-ping" />
                                    <span>Matching</span>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>

                    <ControlButton 
                        onClick={toggleLocalVideo} 
                        icon={localVideoEnabled ? <Camera size={19} /> : <VideoOff size={19} />} 
                        active={!localVideoEnabled} 
                        accent="rose" 
                        tooltip={localVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
                    />

                    <ControlButton 
                        onClick={switchCamera} 
                        icon={<RefreshCw size={18} />} 
                        tooltip="Switch Camera"
                    />
                </div>
			</div>

            {/* ERROR NOTIFICATIONS */}
            <AnimatePresence>
                {videoError && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-32 mx-auto max-w-sm px-4 z-50">
                        <p className="rounded-2xl bg-rose-500/20 border border-rose-500/30 px-6 py-3 text-center text-[10px] font-black uppercase tracking-widest text-rose-400 backdrop-blur-xl shadow-2xl">{videoError}</p>
                    </motion.div>
                )}
            </AnimatePresence>

			{/* ─── POWERED BY ZEVARONE ─── */}
			<div className="absolute left-0 right-0 bottom-2 z-40 flex justify-center pointer-events-none select-none">
                <PoweredBy />
			</div>

            {/* ─── FILTER PANEL ─── */}
            {chatFiltersPanel}
		</section>
	);
}

// ─── LOCAL UI HELPERS ───

type ControlButtonProps = {
    icon: React.ReactNode;
    active?: boolean;
    accent?: "pink" | "rose" | "default";
    onClick: () => void;
    tooltip?: string;
};

function ControlButton({ icon, active, accent = "default", onClick, tooltip }: ControlButtonProps) {
    let buttonStyle = "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20";
    if (accent === "pink" && active) {
        buttonStyle = "bg-pink-600/90 border-pink-400 text-white shadow-[0_0_18px_rgba(236,72,153,0.4)]";
    } else if (accent === "rose" && active) {
        buttonStyle = "bg-rose-600/90 border-rose-400 text-white shadow-[0_0_18px_rgba(244,63,94,0.4)]";
    }

    return (
        <button 
            onClick={onClick} 
            title={tooltip}
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all duration-200 border active:scale-90 ${buttonStyle}`}
        >
            {icon}
        </button>
    );
}
