"use client";

import Image from "next/image";

export type SubscriptionTierLogo = "vip" | "vvip";

const TIER_LOGO_META: Record<SubscriptionTierLogo, { src: string; alt: string; label: string }> = {
  vip: {
    src: "/asstes/vip/viplogo.png",
    alt: "VIP logo",
    label: "VIP",
  },
  vvip: {
    src: "/asstes/vvip/vviplogo.png",
    alt: "VVIP logo",
    label: "VVIP",
  },
};

const TIER_LOGO_SIZE: Record<"xs" | "sm" | "md", { width: number; height: number; className: string }> = {
  xs: { width: 48, height: 20, className: "h-5 w-auto" },
  sm: { width: 64, height: 26, className: "h-6 w-auto sm:h-7" },
  md: { width: 88, height: 36, className: "h-8 w-auto sm:h-9" },
};

type TierLogoProps = {
  tier: SubscriptionTierLogo;
  size?: "xs" | "sm" | "md";
  className?: string;
  imageClassName?: string;
  withLabel?: boolean;
  labelClassName?: string;
};

export function TierLogo({
  tier,
  size = "sm",
  className,
  imageClassName,
  withLabel = false,
  labelClassName,
}: TierLogoProps) {
  const meta = TIER_LOGO_META[tier];
  const dimensions = TIER_LOGO_SIZE[size];

  return (
    <span className={["inline-flex items-center", withLabel ? "gap-2" : "", className].filter(Boolean).join(" ")}>
      <Image
        src={meta.src}
        alt={meta.alt}
        width={dimensions.width}
        height={dimensions.height}
        className={[dimensions.className, imageClassName].filter(Boolean).join(" ")}
      />
      {withLabel ? (
        <span className={["text-xs font-extrabold uppercase tracking-[0.24em]", labelClassName].filter(Boolean).join(" ")}>
          {meta.label}
        </span>
      ) : null}
    </span>
  );
}