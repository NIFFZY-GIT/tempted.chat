"use client";

import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { 
  ShieldCheck, Zap, Timer, Eye, Globe, 
  MessageCircle, Video, ArrowRight, Sparkles,
  Lock, Ghost, Radio
} from "lucide-react";
import { ParticleBackground } from "./particle-background";

export function LandingPageSection() {
  const scrollToAuth = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="relative w-full text-white selection:bg-pink-500/30">
      <ParticleBackground />

      {/* ─── HERO SECTION: MASSIVE & BOLD ─── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 overflow-hidden">
        
        {/* Live Indicator */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500"></span>
          </span>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
            2,481 Strangers Online
          </p>
        </motion.div>

        {/* Main Headline */}
        <div className="relative text-center z-10">
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-6xl md:text-[120px] font-black leading-[0.85] tracking-tighter mb-8"
          >
            MEET <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-400 drop-shadow-2xl">
              ANYONE.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="max-w-xl mx-auto text-white/40 text-lg md:text-xl font-medium mb-12"
          >
            The internet’s most private social hub. Instant connections. No tracking. Pure anonymity.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={scrollToAuth}
              className="group relative px-10 py-5 bg-white text-black font-black rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
            >
              START CHATTING
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-violet-500/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
            </button>
            <button className="px-10 py-5 bg-white/5 border border-white/10 font-black rounded-2xl hover:bg-white/10 transition-all">
              LEARN PRIVACY
            </button>
          </motion.div>
        </div>

        {/* Floating "Chat Bubbles" Visuals */}
        <FloatingBubble delay={0} x="-25%" y="-10%" label="Hey! Where you from? 🌎" color="bg-blue-500/20" />
        <FloatingBubble delay={1} x="20%" y="-15%" label="Video chat is so fast lol ⚡" color="bg-pink-500/20" />
        <FloatingBubble delay={2} x="-20%" y="15%" label="Did you see that?? 😂" color="bg-violet-500/20" />
        <FloatingBubble delay={1.5} x="25%" y="10%" label="Encrypted & Safe. 🔒" color="bg-emerald-500/20" />
      </section>

      {/* ─── THE "WHY US" BENTO: FAST & DARK ─── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Card 1: E2EE */}
          <div className="md:col-span-2 p-8 rounded-[2rem] bg-[#0a0a0f] border border-white/5 flex flex-col justify-between group hover:border-pink-500/30 transition-all">
            <Lock className="text-pink-500 mb-20" size={40} />
            <div>
              <h3 className="text-2xl font-black mb-2">P2P ENCRYPTION</h3>
              <p className="text-white/40 text-sm">What happens in the chat, stays in the chat. We can't see your data.</p>
            </div>
          </div>

          {/* Card 2: Speed */}
          <div className="p-8 rounded-[2rem] bg-[#0a0a0f] border border-white/5 flex flex-col justify-between group hover:border-amber-500/30 transition-all">
            <Zap className="text-amber-400 mb-20" size={40} />
            <div>
              <h3 className="text-2xl font-black mb-2">INSTANT</h3>
              <p className="text-white/40 text-sm">Match in under 1 second.</p>
            </div>
          </div>

          {/* Card 3: Ghost Mode */}
          <div className="p-8 rounded-[2rem] bg-[#0a0a0f] border border-white/5 flex flex-col justify-between group hover:border-violet-500/30 transition-all">
            <Ghost className="text-violet-400 mb-20" size={40} />
            <div>
              <h3 className="text-2xl font-black mb-2">GHOST</h3>
              <p className="text-white/40 text-sm">No profiles. No history.</p>
            </div>
          </div>

          {/* Card 4: Global */}
          <div className="md:col-span-2 p-8 rounded-[2rem] bg-gradient-to-br from-blue-600/20 to-transparent border border-white/5 group">
             <div className="flex justify-between items-start mb-20">
                <Globe className="text-blue-400" size={40} />
                <div className="text-[10px] font-black bg-blue-500 text-white px-2 py-1 rounded">LIVE FEED</div>
             </div>
             <h3 className="text-3xl font-black mb-2">CONNECT GLOBALLY</h3>
             <p className="text-white/40 text-sm">Filter by 140+ countries and meet people you'd never meet in real life.</p>
          </div>

          {/* Card 5: Media */}
          <div className="md:col-span-2 p-8 rounded-[2rem] bg-[#0a0a0f] border border-white/5 flex items-center gap-8 group">
            <div className="h-24 w-24 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
               <Timer className="text-pink-500 animate-pulse" size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black mb-2">SELF-DESTRUCT MEDIA</h3>
              <p className="text-white/40 text-sm">Send images with timers. They vanish from existence after being seen.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ACTION STRIP ─── */}
      <section className="py-20 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex gap-12">
            <Stat label="CHATS TODAY" value="142k" />
            <Stat label="AVG WAIT" value="0.4s" />
            <Stat label="COUNTRIES" value="190" />
          </div>
          <div className="h-px w-full md:w-24 bg-white/10 hidden md:block" />
          <h2 className="text-xl font-bold text-center md:text-left">
            Ready to jump in? <br />
            <span className="text-white/30 font-medium">No account required for guest chat.</span>
          </h2>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-32 px-6 text-center relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="relative z-10"
        >
          <Radio className="mx-auto mb-6 text-pink-500 animate-pulse" size={48} />
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-10">
            START YOUR <br /> SESSION.
          </h2>
          <button 
            onClick={scrollToAuth}
            className="px-12 py-6 bg-gradient-to-r from-pink-500 to-violet-600 rounded-2xl font-black text-lg hover:scale-110 transition-transform shadow-[0_0_50px_rgba(236,72,153,0.3)]"
          >
            CONNECT NOW <ArrowRight className="inline ml-2" />
          </button>
        </motion.div>
        
        {/* Decorative Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 bg-pink-500/20 blur-[120px] rounded-full pointer-events-none" />
      </section>

      <footer className="py-10 text-center border-t border-white/5">
        <p className="text-[10px] font-black text-white/20 tracking-[0.5em] uppercase">
          Tempted Chat &copy; 2024 • Privacy is a Human Right
        </p>
      </footer>
    </div>
  );
}

/* ─── HELPER COMPONENTS ─── */

function FloatingBubble({ label, x, y, delay, color }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ 
        opacity: [0, 1, 0], 
        scale: [0.5, 1, 0.5],
        x: [0, 10, -10, 0],
        y: [0, -10, 10, 0]
      }}
      transition={{ 
        duration: 8, 
        repeat: Infinity, 
        delay,
        ease: "easeInOut" 
      }}
      className={`absolute hidden lg:flex items-center px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md text-[13px] font-bold ${color}`}
      style={{ left: `calc(50% + ${x})`, top: `calc(50% + ${y})` }}
    >
      {label}
    </motion.div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="text-center md:text-left">
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">{label}</div>
    </div>
  );
}