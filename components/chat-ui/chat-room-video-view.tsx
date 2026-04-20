"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
	ChevronLeft, X, MessageCircle, Mic, MicOff, Camera, VideoOff, 
	RefreshCw, Send, Settings2, ArrowRight, ShieldCheck, 
	Zap, Search, Globe, User
} from "lucide-react";
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
    
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);

	return (
		<section
			ref={chatContainerRef}
			className="fixed inset-0 z-50 flex flex-col bg-[#050505] touch-manipulation overscroll-contain overflow-hidden"
		>
			{/* ─── VIDEO GRID (CINEMATIC SPLIT) ─── */}
			<div className="flex h-[calc(var(--vh,1dvh)*100)] w-full flex-col sm:flex-row gap-1 p-1">
				
                {/* STRANGER PANEL */}
				<div className="relative flex-1 overflow-hidden rounded-3xl bg-white/[0.02] border border-white/5">
					<video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
					
                    {/* Status Overlays */}
					<AnimatePresence>
						{(isConnecting || !hasRemoteVideo) && (
							<motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-2xl"
                            >
								<div className="relative mb-8">
                                    <motion.div 
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute inset-0 rounded-full border-2 border-pink-500/50"
                                    />
                                    <div className="h-24 w-24 rounded-full border border-pink-500/30 flex items-center justify-center bg-pink-500/10">
                                        <Search className="text-pink-500 animate-pulse" size={32} />
                                    </div>
                                </div>
								<h3 className="text-xl font-black uppercase tracking-[0.2em] text-white">{isConnecting ? "Scanning..." : "Waiting"}</h3>
								<p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mt-3">{connectingStatus}</p>
							</motion.div>
						)}
					</AnimatePresence>

                    {/* Stranger Identity Pill */}
                    {!isConnecting && hasResolvedStrangerProfile && (
                        <div className="absolute top-6 left-6 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <CountryFlagIcon countryCode={strangerProfile.countryCode} className="h-3 w-4 rounded-sm" />
                            <span className="text-[11px] font-black text-white uppercase tracking-wider">
                                {strangerProfile.gender}, {strangerProfile.age}
                            </span>
                        </div>
                    )}
				</div>

				{/* YOU PANEL */}
				<div className="relative flex-1 overflow-hidden rounded-3xl bg-[#080808] border border-white/5">
					<video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover [transform:scaleX(-1)] opacity-60 grayscale-[0.2]" />
					{!localVideoEnabled && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
							<VideoOff size={48} className="text-white/10" />
						</div>
					)}
                    <div className="absolute bottom-6 right-6 px-3 py-1 rounded-lg bg-black/40 border border-white/10 text-[9px] font-black uppercase text-white/40 tracking-widest">You</div>
				</div>
			</div>

			{/* ─── TOP NAVIGATION ─── */}
			<header className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-8 pointer-events-none">
				<div className="pointer-events-auto">
                    {!showBackConfirm ? (
                        <button onClick={() => setShowBackConfirm(true)} className="h-12 w-12 rounded-full bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-all">
                            <ChevronLeft size={24} />
                        </button>
                    ) : (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded-full p-1 backdrop-blur-md">
                            <button onClick={() => onChangeMode()} className="px-4 py-1.5 text-[10px] font-black uppercase text-rose-400">Leave</button>
                            <button onClick={() => setShowBackConfirm(false)} className="px-4 py-1.5 text-[10px] font-black uppercase text-white/40">No</button>
                        </motion.div>
                    )}
                </div>

                <div className="pointer-events-auto">
                    <button 
                        onClick={() => setShowChatFilters(true)}
                        className="h-12 px-5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md flex items-center gap-3 text-white/60 hover:text-white transition-all"
                    >
                        <Settings2 size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
                        {chatFilterActiveCount > 0 && <span className="h-5 w-5 rounded-full bg-pink-500 text-white text-[9px] flex items-center justify-center font-black">{chatFilterActiveCount}</span>}
                    </button>
                </div>
			</header>

			{/* ─── OVERLAY CHAT DRAWER ─── */}
            <AnimatePresence>
                {showVideoChatOverlay && (
                    <motion.div 
                        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="absolute inset-x-4 bottom-32 top-20 z-50 bg-black/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden shadow-2xl"
                    >
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Encrypted Chat</span>
                            <button onClick={() => setShowVideoChatOverlay(false)}><X size={20} className="text-white/20" /></button>
                        </div>
                        
                        <div 
                            ref={messagesViewportRef} onScroll={handleMessagesScroll}
                            className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar"
                        >
                            {messages.map((msg: any) => (
                                <div key={msg.id} className={`flex ${msg.author === 'you' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-[14px] leading-relaxed shadow-xl ${msg.author === 'you' ? 'bg-pink-600 text-white rounded-tr-none' : 'bg-white/10 border border-white/10 text-white rounded-tl-none'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-black/40 border-t border-white/10 flex gap-3 items-center">
                            <input 
                                ref={messageInputRef} value={text} onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                placeholder="Message..." 
                                className="flex-1 bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm outline-none focus:border-pink-500/50" 
                            />
                            <button onClick={sendMessage} className="h-14 w-14 rounded-2xl bg-pink-600 flex items-center justify-center shadow-lg active:scale-90 transition-all">
                                <Send size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

			{/* ─── DOCK CONTROLS (FLOATING PILL) ─── */}
			<div className="absolute inset-x-0 bottom-8 z-40 flex flex-col items-center gap-4 px-6">
                
                {/* Video/Audio Indicators (Floating Toasts) */}
                <div className="flex gap-2">
                    {!remoteAudioEnabled && <div className="px-3 py-1 bg-rose-500/20 border border-rose-500/30 rounded-full text-[9px] font-black text-rose-400 uppercase tracking-widest backdrop-blur-md">Stranger Muted</div>}
                    {!hasRemoteVideo && <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-[9px] font-black text-amber-400 uppercase tracking-widest backdrop-blur-md">Stranger Camera Off</div>}
                </div>

                <div className="flex items-center gap-4 bg-black/40 border border-white/10 backdrop-blur-3xl p-3 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    <RoundButton onClick={() => setShowVideoChatOverlay(!showVideoChatOverlay)} icon={<MessageCircle />} active={showVideoChatOverlay} color="pink" />
                    <RoundButton onClick={toggleLocalAudio} icon={localAudioEnabled ? <Mic /> : <MicOff />} active={!localAudioEnabled} color="rose" />
                    
                    {/* THE NEXT/SKIP BUTTON */}
                    <div className="min-w-[120px] flex justify-center">
                        <AnimatePresence mode="wait">
                            {showNextStrangerPrompt ? (
                                <motion.button 
                                    key="next" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    onClick={onNextStranger}
                                    className="h-16 px-10 rounded-[1.5rem] bg-white text-black font-black uppercase tracking-tighter shadow-2xl hover:scale-105 active:scale-95 transition-all"
                                >
                                    Next
                                </motion.button>
                            ) : !isConnecting && (
                                !showSkipConfirm ? (
                                    <motion.button 
                                        key="skip" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        onClick={() => setShowSkipConfirm(true)}
                                        className="h-16 px-10 rounded-[1.5rem] bg-white/5 border border-white/10 text-white font-black uppercase tracking-tighter hover:bg-white/10 active:scale-95 transition-all"
                                    >
                                        Skip
                                    </motion.button>
                                ) : (
                                    <motion.div key="confirm" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-1">
                                        <button onClick={() => { setShowSkipConfirm(false); onNextStranger(); }} className="px-5 py-3 text-[10px] font-black uppercase text-rose-400 hover:bg-rose-500/20 rounded-xl">Yes</button>
                                        <button onClick={() => setShowSkipConfirm(false)} className="px-5 py-3 text-[10px] font-black uppercase text-white/40 hover:bg-white/5 rounded-xl">No</button>
                                    </motion.div>
                                )
                            )}
                        </AnimatePresence>
                    </div>

                    <RoundButton onClick={toggleLocalVideo} icon={localVideoEnabled ? <Camera /> : <VideoOff />} active={!localVideoEnabled} color="rose" />
                    <RoundButton onClick={switchCamera} icon={<RefreshCw />} color="white" />
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

			{chatFiltersPanel}
		</section>
	);
}

// ─── LOCAL UI HELPERS ───

function RoundButton({ icon, active, color, onClick }: any) {
	const base = "h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90 border";
    const styles: any = {
        pink: active ? "bg-pink-600 border-pink-400 text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white",
        rose: active ? "bg-rose-600 border-rose-400 text-white" : "bg-white/5 border-white/10 text-white/40 hover:text-white",
        white: "bg-white/5 border-white/10 text-white/40 hover:text-white"
    };

	return (
		<button onClick={onClick} className={`${base} ${styles[color]}`}>
			{React.cloneElement(icon, { size: 22 })}
		</button>
	);
}