"use client";

import Image from "next/image";
import Link from "next/link";
import { Globe, MessageSquare, ShieldCheck } from "lucide-react";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 w-full px-4 pb-6 sm:px-8 sm:pb-8">
      {/* Main Container with Glassmorphism */}
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0c]/80 shadow-2xl backdrop-blur-2xl">
        
        {/* Background Accents (Glows) */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-pink-500/10 blur-[80px]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px]" aria-hidden="true" />

        <div className="relative grid gap-12 px-6 py-10 lg:grid-cols-12 lg:px-12 lg:py-14">
          
          {/* Brand Section */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <Image
                src="/asstes/logo/logologoheartandtempetedchat.png"
                alt="Tempted.Chat"
                width={180}
                height={40}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>
            <p className="max-w-md text-[15px] leading-relaxed text-white/60">
              Experience random conversations refined for the modern web. 
              Instant matching, end-to-end speed, and a community built on connection.
            </p>
            
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                Network Online
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white">Platform</h4>
              <nav className="flex flex-col gap-2 text-[14px] text-white/50">
                <Link href="/" className="transition hover:text-pink-400">Home</Link>
                <Link href="/chat" className="transition hover:text-pink-400">Start Chatting</Link>
                <Link href="/features" className="transition hover:text-pink-400">Features</Link>
              </nav>
            </div>
            
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white">Safety</h4>
              <nav className="flex flex-col gap-2 text-[14px] text-white/50">
                <Link href="/rules" className="transition hover:text-blue-400">Community Rules</Link>
                <Link href="/privacy" className="transition hover:text-blue-400">Privacy Policy</Link>
                <Link href="/terms" className="transition hover:text-blue-400">Terms of Service</Link>
              </nav>
            </div>

            <div className="col-span-2 flex flex-col gap-4 sm:col-span-1">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white">Connect</h4>
              <div className="flex gap-4">
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-white/5 transition hover:bg-white/10 hover:text-pink-400">
                   <Globe size={18} />
                </a>
                <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/5 bg-white/5 transition hover:bg-white/10 hover:text-blue-400">
                   <MessageSquare size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 bg-black/20 px-6 py-6 lg:px-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex flex-col items-center gap-2 md:items-start">
              <span className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                &copy; {year} Tempted Chat &bull; All Rights Reserved
              </span>
            </div>

            {/* Developer Credit */}
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Crafted by</span>
              <a href="https://zevarone.com" target="_blank" rel="noopener noreferrer" className="transition hover:opacity-70">
                <Image
                  src="/asstes/zevaronelogo/Asset%202.svg"
                  alt="Zevarone"
                  width={80}
                  height={18}
                  className="h-3.5 w-auto object-contain brightness-0 invert"
                  unoptimized
                />
              </a>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-widest text-white/40">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500/50" />
                v1.2.0 Stable
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}