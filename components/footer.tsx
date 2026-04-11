"use client";

import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-6 w-full px-3 pb-4 sm:mt-8 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-white/[0.04] bg-[#0a0a10]/80 px-5 py-6 backdrop-blur-md sm:rounded-3xl sm:px-8 sm:py-8">
          {/* Top row */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-3">
              <Link href="/" className="transition-opacity hover:opacity-80">
                <Image
                  src="/asstes/logo/logologoheartandtempetedchat.png"
                  alt="Tempted.Chat"
                  width={140}
                  height={28}
                  className="h-5 w-auto object-contain sm:h-6"
                  priority
                />
              </Link>
              <p className="max-w-xs text-[13px] leading-relaxed text-white/35">
                Anonymous. Encrypted. Instant.
              </p>
            </div>

            <div className="flex gap-10 sm:gap-14">
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Platform</span>
                <nav className="flex flex-col gap-1.5 text-[13px] font-medium text-white/40">
                  <Link href="/" className="transition-all duration-150 hover:text-white/80">Home</Link>
                  <Link href="/about" className="transition-all duration-150 hover:text-white/80">About</Link>
                </nav>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Legal</span>
                <nav className="flex flex-col gap-1.5 text-[13px] font-medium text-white/40">
                  <Link href="/safety" className="transition-all duration-150 hover:text-white/80">Safety</Link>
                  <Link href="/privacy" className="transition-all duration-150 hover:text-white/80">Privacy</Link>
                  <Link href="/terms" className="transition-all duration-150 hover:text-white/80">Terms</Link>
                </nav>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-5 border-t border-white/[0.04] sm:my-6" />

          {/* Bottom row */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="text-[11px] text-white/25">
              &copy; {year} tempted.chat
            </span>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-white/20">Built by</span>
              <a href="https://zevarone.com" target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-70">
                <Image
                  src="/asstes/zevaronelogo/Asset%202.svg"
                  alt="Zevarone"
                  width={72}
                  height={16}
                  className="h-3 w-auto object-contain brightness-0 invert opacity-40"
                  unoptimized
                />
              </a>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-white/25">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Online
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}