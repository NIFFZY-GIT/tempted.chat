"use client";

import Image from "next/image";

export function DevelopedBy() {
  return (
    <a
      href="https://www.zevarone.com"
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-1 left-0 z-0 w-full pointer-events-auto flex items-center justify-center gap-1 text-[10px] text-white/30 transition-colors duration-200 hover:text-white/50"
    >
      Developed by
      <Image
        src="/asstes/zevaronelogo/Asset 13.svg"
        alt="ZEVARONE"
        width={60}
        height={12}
        className="inline-block h-3 w-auto opacity-70"
        unoptimized
      />
    </a>
  );
}
