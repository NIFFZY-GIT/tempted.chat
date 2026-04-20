"use client";

import Image from "next/image";

export function PoweredBy() {
  const className = "w-full pointer-events-none flex items-center justify-center gap-1 text-[10px] text-white/30 select-none";

  const content = (
    <>
      Powered by
      <span className="inline-block h-3 w-auto opacity-70 cursor-default select-none">
        <Image
          src="/asstes/zevaronelogo/Asset 13.svg"
          alt="ZEVARONE"
          width={60}
          height={12}
          className="inline-block h-3 w-auto opacity-70 pointer-events-none select-none"
          unoptimized
        />
      </span>
    </>
  );

  return <span className={`${className} cursor-default`}>{content}</span>;
}

export function DevelopedBy({ disableLink = false }: { disableLink?: boolean } = {}) {
  const className = "w-full pointer-events-auto flex items-center justify-center gap-1 text-[10px] text-white/30 transition-colors duration-200 hover:text-white/50";

  const content = (
    <>
      Powered by
      <Image
        src="/asstes/zevaronelogo/Asset 13.svg"
        alt="ZEVARONE"
        width={60}
        height={12}
        className="inline-block h-3 w-auto opacity-70 pointer-events-none select-none"
        unoptimized
      />
    </>
  );

  if (disableLink) {
    return <span className={`${className} cursor-default select-none pointer-events-none`}>{content}</span>;
  }

  return (
    <a
      href="https://www.zevarone.com"
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
    </a>
  );
}
