"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type TopNavProps = {
isAuthenticated: boolean;
onLogin: () => void;
onLogout: () => void;
isWorking: boolean; // This is important to prevent the "Sign In" flicker
isAdmin?: boolean;
onGoToAdmin?: () => void;
};

export function TopNav({
isAuthenticated,
onLogin,
onLogout,
isWorking,
isAdmin = false,
onGoToAdmin,
}: TopNavProps) {
const [isMenuOpen, setIsMenuOpen] = useState(false);
const [scrollProgress, setScrollProgress] = useState(0);
const pathname = usePathname();
const menuRef = useRef<HTMLDivElement | null>(null);
const hamburgerRef = useRef<HTMLButtonElement | null>(null);

useEffect(() => {
const onScroll = () => {
setScrollProgress(Math.min(window.scrollY / 80, 1));
};
window.addEventListener("scroll", onScroll, { passive: true });
return () => window.removeEventListener("scroll", onScroll);
}, []);

// Close menu on click outside (exclude the hamburger button itself)
useEffect(() => {
const handleOutsideClick = (event: MouseEvent) => {
if (
menuRef.current && !menuRef.current.contains(event.target as Node) &&
hamburgerRef.current && !hamburgerRef.current.contains(event.target as Node)
) {
setIsMenuOpen(false);
}
};
document.addEventListener("mousedown", handleOutsideClick);
return () => document.removeEventListener("mousedown", handleOutsideClick);
}, []);

const navLinks = [
{ href: "/", label: "Home" },
{ href: "/plans", label: "Plans" },
{ href: "/lost-found", label: "Lost & Found" },
{ href: "/safety", label: "Safety" },
{ href: "/about", label: "About" },
{ href: "/feedback", label: "Feedback" },
];

return (
<header
className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 py-3 pointer-events-none"
style={{
backgroundColor: `rgba(6, 6, 12, ${scrollProgress * 0.85})`,
backdropFilter: `blur(${scrollProgress * 16}px)`,
WebkitBackdropFilter: `blur(${scrollProgress * 16}px)`,
borderBottom: `1px solid rgba(255,255,255,${scrollProgress * 0.07})`,
}}
>
<nav
className={`
pointer-events-auto
transition-all duration-500 ease-in-out
flex items-center justify-between
h-14 w-full max-w-6xl px-4
rounded-2xl
!bg-transparent !shadow-none !backdrop-blur-0 !border-transparent
`}
>
{/* Left: Logo */}
<div className="flex-shrink-0">
<Link href="/" className="flex items-center transition-transform active:scale-95">
<Image
src="/asstes/logo/logologoheartandtempetedchat.png"
alt="TEMPTED.CHAT"
width={110}
height={22}
className="h-6 w-auto sm:h-7"
priority
/>
</Link>
</div>

{/* Center: Desktop Links */}
<div className="hidden md:flex items-center gap-1">
{navLinks.map((link) => {
const isActive = pathname === link.href;
return (
<Link
key={link.href}
href={link.href}
className={`
relative px-3 py-1.5 text-[13px] font-medium transition-all duration-200 rounded-lg
${isActive ? "text-white" : "text-white/40 hover:text-white/80 hover:bg-white/5"}
`}
>
{isActive && (
<span className="absolute inset-0 bg-white/10 rounded-lg -z-10" />
)}
{link.label}
</Link>
);
})}
</div>

{/* Right: Auth (desktop only) */}
<div className="flex items-center gap-2">
{!isWorking && (
<>
{isAuthenticated ? (
<div className="hidden md:flex items-center gap-2">
{isAdmin && (
<button
onClick={onGoToAdmin}
className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white/60 hover:bg-white/5 hover:text-white transition-all"
>
Admin
</button>
)}
<button
onClick={onLogout}
className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-[12px] font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"
>
Log out
</button>
</div>
) : (
<button
onClick={onLogin}
className="hidden md:flex relative group overflow-hidden px-5 py-1.5 text-[12px] font-bold text-white transition-all active:scale-95"
>
<div className="absolute inset-0 bg-white rounded-full" />
<div className="absolute inset-0 rounded-full ring-1 ring-white/25 group-hover:ring-white/40 transition-all" />
<span className="relative z-10 text-black">Sign In</span>
</button>
)}
</>
)}

{/* Mobile: logout button next to hamburger */}
{!isWorking && isAuthenticated && (
<button
onClick={onLogout}
className="md:hidden text-[12px] font-semibold text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/[0.08] transition-all"
>
Log out
</button>
)}

{/* Mobile Hamburger */}
<button
ref={hamburgerRef}
onClick={() => setIsMenuOpen((prev) => !prev)}
className="md:hidden p-2 text-white/50 hover:text-white"
>
<div className="w-5 h-4 relative">
<span className={`absolute w-full h-0.5 bg-current transition-all duration-300 ${isMenuOpen ? "rotate-45 top-2" : "top-0"}`} />
<span className={`absolute w-full h-0.5 bg-current top-1.5 transition-all duration-300 ${isMenuOpen ? "opacity-0" : "opacity-100"}`} />
<span className={`absolute w-full h-0.5 bg-current transition-all duration-300 ${isMenuOpen ? "-rotate-45 top-2" : "top-3"}`} />
</div>
</button>
</div>

{/* Mobile Menu */}
<div
ref={menuRef}
className={`
absolute top-full left-4 right-4 mt-2 p-2 md:hidden
bg-[#03030a] border border-white/[0.06] rounded-2xl shadow-2xl backdrop-blur-2xl
transition-all duration-300 origin-top
${isMenuOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"}
`}
>
{navLinks.map((link) => (
<Link
key={link.href}
href={link.href}
onClick={() => setIsMenuOpen(false)}
className={`block px-4 py-3 rounded-xl text-[14px] font-medium ${
pathname === link.href ? "bg-white/[0.06] text-white" : "text-white hover:bg-white/[0.04]"
}`}
>
{link.label}
</Link>
))}

{/* Auth buttons inside mobile menu */}
{!isWorking && (
<div className="mt-2 pt-2 border-t border-white/[0.06]">
{isAuthenticated ? (
<>
{isAdmin && (
<button
onClick={() => { onGoToAdmin?.(); setIsMenuOpen(false); }}
className="w-full text-left px-4 py-3 rounded-xl text-[14px] font-medium text-white/60 hover:bg-white/[0.04]"
>
Admin
</button>
)}
<button
onClick={() => { onLogout(); setIsMenuOpen(false); }}
className="w-full text-left px-4 py-3 rounded-xl text-[14px] font-medium text-rose-400 hover:bg-rose-500/[0.06]"
>
Log out
</button>
</>
) : (
<button
onClick={() => { onLogin(); setIsMenuOpen(false); }}
className="w-full text-left px-4 py-3 rounded-xl text-[14px] font-medium text-white hover:bg-white/[0.04]"
>
Sign In
</button>
)}
</div>
)}
</div>
</nav>
</header>
);
}