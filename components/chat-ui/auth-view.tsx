"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Lock, Users, Eye, EyeOff, Mail, KeyRound } from "lucide-react";

const SectionWrapper = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="w-full max-w-sm mx-auto px-4"
  >
    {children}
  </motion.div>
);

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 5.82-4.53z" />
    </svg>
  );
}

function AuthButton({ onClick, icon, title, sub }: { onClick: () => void; icon: ReactNode; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-5 rounded-[2rem] bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/20 transition-all active:scale-[0.98] group"
    >
      <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="text-left flex-1">
        <div className="text-[15px] font-bold">{title}</div>
        <div className="text-[10px] text-white/30 font-black uppercase tracking-widest">{sub}</div>
      </div>
      <svg className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}

export function AuthView({
  authBusy,
  loginAnonymously,
  loginWithGoogle,
  authMethod,
  setAuthMethod,
  email,
  setEmail,
  password,
  setPassword,
  loginWithEmail,
  setAuthMode,
  authMode,
  resetPassword,
  authError,
  authNotice,
  renderRecaptcha,
}: any) {
  const captchaRendered = useRef(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!showCaptcha || captchaRendered.current) return;
    const tryRender = (attempts: number) => {
      if (typeof window !== "undefined" && window.grecaptcha) {
        renderRecaptcha("recaptcha-container");
        captchaRendered.current = true;
      } else if (attempts > 0) {
        setTimeout(() => tryRender(attempts - 1), 500);
      }
    };
    tryRender(20);
  }, [showCaptcha, renderRecaptcha]);

  return (
    <SectionWrapper>
      <div className="text-center mb-10">
        <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 mb-6">
          <Lock className="text-pink-500" size={32} />
        </div>
        <h1 className="text-4xl font-black tracking-tighter">Enter the Chat</h1>
      </div>

      <div className="space-y-3">
        {!showCaptcha ? (
          <AuthButton
            onClick={() => setShowCaptcha(true)}
            icon={<Users className="text-emerald-400" />}
            title="Guest Session"
            sub="No account needed"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-3xl bg-emerald-500/5 border border-emerald-500/20"
          >
            <div id="recaptcha-container" className="flex justify-center mb-4" />
            <button
              onClick={loginAnonymously}
              disabled={authBusy}
              className="w-full py-4 bg-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 disabled:opacity-50"
            >
              {authBusy ? "Joining..." : "Verify & Join"}
            </button>
          </motion.div>
        )}

        <AuthButton
          onClick={loginWithGoogle}
          icon={<GoogleIcon />}
          title="Continue with Google"
          sub="Fast & Verified"
        />

        <div className="h-px bg-white/5 my-6" />

        {authMethod !== "email" ? (
          <button
            onClick={() => setAuthMethod("email")}
            className="w-full py-4 rounded-2xl border border-dashed border-white/10 text-xs font-black uppercase tracking-widest text-white/30 hover:text-white transition-all"
          >
            Or use Email Address
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-[#0c0c12]"
          >
            <div className="flex border-b border-white/[0.06]">
              {(["signin", "signup"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAuthMode(mode)}
                  className={`relative flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest transition-colors ${authMode === mode ? "text-white" : "text-white/25 hover:text-white/50"}`}
                >
                  {mode === "signin" ? "Sign In" : "Create Account"}
                  {authMode === mode && (
                    <motion.div
                      layoutId="email-tab-indicator"
                      className="absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-pink-500"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-3 p-5">
              <div className="group relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 transition-colors group-focus-within:text-pink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] py-4 pl-11 pr-4 text-base text-white placeholder:text-white/25 outline-none transition focus:border-pink-500/50 focus:bg-white/[0.06] sm:text-sm"
                />
              </div>

              <div className="group relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 transition-colors group-focus-within:text-pink-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] py-4 pl-11 pr-12 text-base text-white placeholder:text-white/25 outline-none transition focus:border-pink-500/50 focus:bg-white/[0.06] sm:text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <button
                onClick={loginWithEmail}
                disabled={authBusy}
                className={`relative w-full overflow-hidden rounded-2xl py-4 font-black text-[13px] uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 ${
                  authMode === "signin"
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-pink-600 text-white shadow-lg shadow-pink-900/30 hover:bg-pink-500"
                }`}
              >
                <span className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-white/10 transition-transform duration-700 group-hover:translate-x-[100%]" />
                <span className="relative">
                  {authBusy ? "Please wait..." : authMode === "signin" ? "Welcome Back" : "Create Account"}
                </span>
              </button>

              {authMode === "signin" && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={resetPassword}
                    disabled={authBusy}
                    className="text-[11px] text-white/25 transition hover:text-pink-400"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {authError && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-center text-sm text-red-300">
          {authError}
        </div>
      )}
      {authNotice && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-center text-sm text-emerald-300">
          {authNotice}
        </div>
      )}

      <div className="mt-5 text-center text-xs leading-relaxed text-white/45">
        By logging in or continuing as guest, you agree to our safety rules.{" "}
        <Link href="/safety" className="font-semibold text-pink-400 transition hover:text-pink-300">
          Read our rules
        </Link>
      </div>
    </SectionWrapper>
  );
}
