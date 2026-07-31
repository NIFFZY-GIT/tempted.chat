"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  ChevronDown,
  Maximize2,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
} from "lucide-react";

import { CALL_RING_TIMEOUT_MS, formatCallDuration, type CallSession } from "./call-types";

type FlagIconProps = { countryCode?: string | null; className?: string };
type GenderIconProps = { gender?: "Male" | "Female" | "Other" | null; className?: string };

export type CallConnectionState = "connecting" | "connected" | "reconnecting";

export type CallOverlayProps = {
  call: CallSession;
  currentUserId: string;
  strangerProfile: { gender?: "Male" | "Female" | "Other" | null; age?: number | string; countryCode?: string | null };
  CountryFlagIcon: React.ComponentType<FlagIconProps>;
  GenderIcon: React.ComponentType<GenderIconProps>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  remoteAudioEnabled: boolean;
  remoteVideoEnabled: boolean;
  connectionState: CallConnectionState;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  /** Chat is running fullscreen, so the docked card sits higher up the viewport. */
  isFullscreenActive?: boolean;
  callError: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onHangUp: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
};

/* ─────────────────────────────────────────────────────────────
   Synthesized ring tones — no audio assets required.
   Falls back silently when autoplay policy blocks the context.
   ───────────────────────────────────────────────────────────── */
function useCallTone(pattern: "incoming" | "outgoing" | null) {
  React.useEffect(() => {
    if (!pattern) {
      return;
    }

    type WebAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    let context: AudioContext;
    try {
      context = new AudioContextCtor();
    } catch {
      return;
    }

    void context.resume().catch(() => {
      // Autoplay policy may keep the context suspended until the next gesture.
    });

    let disposed = false;
    let timeoutId: number | null = null;

    const beep = (frequency: number, startOffsetMs: number, durationMs: number, gainValue: number) => {
      window.setTimeout(() => {
        if (disposed || context.state === "closed") {
          return;
        }

        try {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(gainValue, context.currentTime + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + durationMs / 1000 + 0.02);
        } catch {
          // Ignore transient audio graph failures.
        }
      }, startOffsetMs);
    };

    const playCycle = () => {
      if (disposed) {
        return;
      }

      if (pattern === "incoming") {
        beep(523.25, 0, 380, 0.16);
        beep(659.25, 190, 380, 0.16);
        beep(523.25, 620, 380, 0.16);
        beep(659.25, 810, 380, 0.16);
        timeoutId = window.setTimeout(playCycle, 2600);
        return;
      }

      beep(425, 0, 700, 0.055);
      timeoutId = window.setTimeout(playCycle, 3400);
    };

    playCycle();

    if (pattern === "incoming" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate([420, 260, 420, 1400]);
      } catch {
        // Vibration is best-effort only.
      }
    }

    return () => {
      disposed = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(0);
        } catch {
          // Ignore vibration teardown failures.
        }
      }
      void context.close().catch(() => {
        // Ignore double-close races.
      });
    };
  }, [pattern]);
}

/** Live seconds counter for an accepted call. */
function useCallElapsedSeconds(acceptedAtMs?: number): number {
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!acceptedAtMs) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - acceptedAtMs) / 1000)));
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [acceptedAtMs]);

  return elapsedSeconds;
}

/** Countdown shown while a call is still ringing. */
function useRingSecondsLeft(startedAtMs: number, active: boolean): number {
  const [secondsLeft, setSecondsLeft] = React.useState(() => Math.ceil(CALL_RING_TIMEOUT_MS / 1000));

  React.useEffect(() => {
    if (!active) {
      return;
    }

    const tick = () => {
      const remainingMs = startedAtMs + CALL_RING_TIMEOUT_MS - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [active, startedAtMs]);

  return secondsLeft;
}

function CallerAvatar({
  strangerProfile,
  GenderIcon,
  CountryFlagIcon,
  pulsing,
  size = "lg",
}: Pick<CallOverlayProps, "strangerProfile" | "GenderIcon" | "CountryFlagIcon"> & {
  pulsing: boolean;
  size?: "lg" | "md";
}) {
  const dimension = size === "lg" ? "h-28 w-28" : "h-16 w-16";
  const iconSize = size === "lg" ? "h-12 w-12" : "h-7 w-7";

  return (
    <div className="relative flex items-center justify-center">
      {pulsing && (
        <>
          <span className="absolute inset-0 rounded-full bg-pink-500/20" style={{ animation: "call-ripple 2s ease-out infinite" }} />
          <span className="absolute inset-0 rounded-full bg-pink-500/15" style={{ animation: "call-ripple 2s ease-out 0.6s infinite" }} />
          <span className="absolute inset-0 rounded-full bg-pink-500/10" style={{ animation: "call-ripple 2s ease-out 1.2s infinite" }} />
        </>
      )}
      <div
        className={`relative ${dimension} flex items-center justify-center rounded-full bg-gradient-to-br from-white/[0.14] to-white/[0.02] text-white/85 ring-1 ring-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.5)]`}
      >
        <GenderIcon gender={strangerProfile.gender} className={iconSize} />
        {strangerProfile.countryCode && (
          <span className="absolute -bottom-1 right-0 rounded-md bg-[#0d0d14] p-[3px] ring-1 ring-white/10">
            <CountryFlagIcon countryCode={strangerProfile.countryCode} className="h-3 w-[1.1rem] rounded-[2px] object-cover" />
          </span>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  showLabel = false,
  active,
  tone = "neutral",
  children,
  size = "md",
}: {
  onClick: () => void;
  label: string;
  /** Renders the label under the button (expanded stage). */
  showLabel?: boolean;
  active?: boolean;
  tone?: "neutral" | "danger" | "accept";
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const dimension = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const toneClass =
    tone === "danger"
      ? "bg-rose-500 text-white shadow-[0_10px_30px_rgba(244,63,94,0.35)] hover:bg-rose-400"
      : tone === "accept"
        ? "bg-emerald-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.35)] hover:bg-emerald-400"
        : active
          ? // "active" means the feature is switched OFF — surface it loudly.
            "bg-white text-black shadow-[0_10px_24px_rgba(255,255,255,0.18)] hover:bg-white/90"
          : "bg-white/[0.09] text-white/85 ring-1 ring-white/[0.1] hover:bg-white/[0.16] hover:text-white";

  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`${dimension} ${toneClass} flex flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90`}
    >
      {children}
    </button>
  );

  if (!showLabel) {
    return button;
  }

  return (
    <span className="flex flex-col items-center gap-1.5">
      {button}
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</span>
    </span>
  );
}

export function CallOverlay(props: CallOverlayProps) {
  const {
    call,
    currentUserId,
    strangerProfile,
    CountryFlagIcon,
    GenderIcon,
    localVideoRef,
    remoteVideoRef,
    localAudioEnabled,
    localVideoEnabled,
    remoteAudioEnabled,
    remoteVideoEnabled,
    connectionState,
    expanded,
    setExpanded,
    isFullscreenActive = false,
    callError,
    onAccept,
    onDecline,
    onCancel,
    onHangUp,
    onToggleMic,
    onToggleCamera,
    onSwitchCamera,
  } = props;

  const isOutgoing = call.from === currentUserId;
  const isRinging = call.status === "ringing";
  const isActive = call.status === "active";
  const elapsedSeconds = useCallElapsedSeconds(call.acceptedAtMs);
  const ringSecondsLeft = useRingSecondsLeft(call.startedAtMs, isRinging);

  useCallTone(isRinging ? (isOutgoing ? "outgoing" : "incoming") : null);

  React.useEffect(() => {
    if (!isRinging || isOutgoing) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDecline();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOutgoing, isRinging, onDecline]);

  const identityLabel = strangerProfile.age
    ? `${strangerProfile.gender ?? "Stranger"}, ${strangerProfile.age}`
    : "Stranger";

  const statusLabel = connectionState === "connected"
    ? formatCallDuration(elapsedSeconds)
    : connectionState === "reconnecting"
      ? "Reconnecting…"
      : "Connecting…";

  const ringProgressPercent = Math.max(0, Math.min(100, (ringSecondsLeft / (CALL_RING_TIMEOUT_MS / 1000)) * 100));

  // Park the docked card just below the chat header in either layout mode.
  const dockedPositionClass = isFullscreenActive
    ? "top-[3.9rem] sm:top-[4.75rem]"
    : "top-[7.9rem] sm:top-[9.1rem]";

  return (
    <>
      {/* ── Ringing sheet (incoming + outgoing) ── */}
      <AnimatePresence>
        {isRinging && (
          <motion.div
            key="call-ringing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-3 backdrop-blur-xl sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={isOutgoing ? "Outgoing video call" : "Incoming video call"}
          >
            <motion.div
              initial={{ y: 40, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 40, scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#0d0d14]/95 px-6 pb-7 pt-9 text-center shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
            >
              <div className="flex justify-center">
                <CallerAvatar
                  strangerProfile={strangerProfile}
                  GenderIcon={GenderIcon}
                  CountryFlagIcon={CountryFlagIcon}
                  pulsing
                />
              </div>

              <p className="mt-6 text-[11px] font-black uppercase tracking-[0.28em] text-pink-400">
                {isOutgoing ? "Outgoing video call" : "Incoming video call"}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">{identityLabel}</h2>
              <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-white/40">
                <Video size={14} />
                <span>{isOutgoing ? "Waiting for an answer" : "wants to video call you"}</span>
              </p>

              <div className="mx-auto mt-5 h-1 w-40 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${ringProgressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                {ringSecondsLeft}s left
              </p>

              {isOutgoing ? (
                <div className="mt-7 flex flex-col items-center gap-2.5">
                  <ControlButton onClick={onCancel} label="Cancel call" tone="danger" size="lg">
                    <PhoneOff size={24} />
                  </ControlButton>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">Cancel</span>
                </div>
              ) : (
                <div className="mt-7 flex items-start justify-center gap-12">
                  <div className="flex flex-col items-center gap-2.5">
                    <ControlButton onClick={onDecline} label="Decline call" tone="danger" size="lg">
                      <PhoneOff size={24} />
                    </ControlButton>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">Decline</span>
                  </div>
                  <div className="flex flex-col items-center gap-2.5">
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <ControlButton onClick={onAccept} label="Accept call" tone="accept" size="lg">
                        <Video size={24} />
                      </ControlButton>
                    </motion.div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/70">Accept</span>
                  </div>
                </div>
              )}

              {callError && (
                <p className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-2.5 text-[12px] font-semibold text-rose-300">
                  {callError}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active call: docked card ⇄ full stage (one mounted video element) ── */}
      {isActive && (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          <AnimatePresence>
            {expanded && (
              <motion.div
                key="call-stage-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-auto absolute inset-0 bg-[#05050a]"
              />
            )}
          </AnimatePresence>

          <motion.div
            layout
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className={
              expanded
                ? "pointer-events-auto absolute inset-0 flex flex-col overflow-hidden bg-[#05050a]"
                : `pointer-events-auto absolute left-1/2 ${dockedPositionClass} w-[min(94vw,26rem)] -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0d0d14]/92 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl`
            }
          >
            {/* ── Remote video surface ── */}
            <div className={expanded ? "relative min-h-0 flex-1 bg-black" : "relative aspect-video w-full bg-black"}>
              {/* Remote audio plays through this element; it is never unmounted mid-call. */}
              <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />

              {!remoteVideoEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a12]">
                  <CallerAvatar
                    strangerProfile={strangerProfile}
                    GenderIcon={GenderIcon}
                    CountryFlagIcon={CountryFlagIcon}
                    pulsing={false}
                    size={expanded ? "lg" : "md"}
                  />
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30">
                    {connectionState === "connected" ? "Camera off" : statusLabel}
                  </p>
                </div>
              )}

              {/* Local preview */}
              <div
                className={`absolute overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg ${
                  expanded ? "bottom-4 right-4 h-40 w-28 sm:h-48 sm:w-36" : "bottom-2.5 right-2.5 h-20 w-14"
                }`}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover [transform:scaleX(-1)]"
                />
                {!localVideoEnabled && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/85">
                    <VideoOff size={expanded ? 20 : 14} className="text-white/40" />
                    {expanded && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Off</span>
                    )}
                  </div>
                )}
                {!localAudioEnabled && (
                  <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow">
                    <MicOff size={11} />
                  </span>
                )}
              </div>

              {/* Top status strip */}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 py-2.5">
                <span className="flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white/90 backdrop-blur-md">
                  <CountryFlagIcon countryCode={strangerProfile.countryCode} className="h-3 w-[1.1rem] rounded-[2px] object-cover" />
                  {identityLabel}
                  {!remoteAudioEnabled && connectionState === "connected" && (
                    <span className="flex items-center gap-1 text-rose-300">
                      <MicOff size={11} />
                    </span>
                  )}
                </span>
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white/90 backdrop-blur-md">
                  {statusLabel}
                </span>
              </div>
            </div>

            {/* ── Control dock ── */}
            <div
              className={
                expanded
                  ? "flex flex-shrink-0 flex-col items-center gap-4 border-t border-white/[0.05] bg-[#0b0b12] px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-5"
                  : "flex items-center justify-center gap-2 px-3 py-2.5"
              }
            >
              {callError && (
                <p className="w-full max-w-sm rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-rose-300">
                  {callError}
                </p>
              )}

              <div className={expanded ? "flex items-start gap-4 sm:gap-6" : "flex items-center gap-2"}>
                <ControlButton
                  onClick={onToggleMic}
                  label={localAudioEnabled ? "Mute mic" : "Unmute mic"}
                  showLabel={expanded}
                  active={!localAudioEnabled}
                  size={expanded ? "lg" : "md"}
                >
                  {localAudioEnabled ? <Mic size={expanded ? 21 : 18} /> : <MicOff size={expanded ? 21 : 18} />}
                </ControlButton>

                <ControlButton
                  onClick={onToggleCamera}
                  label={localVideoEnabled ? "Stop video" : "Start video"}
                  showLabel={expanded}
                  active={!localVideoEnabled}
                  size={expanded ? "lg" : "md"}
                >
                  {localVideoEnabled ? <Camera size={expanded ? 21 : 18} /> : <VideoOff size={expanded ? 21 : 18} />}
                </ControlButton>

                <ControlButton
                  onClick={onSwitchCamera}
                  label="Flip camera"
                  showLabel={expanded}
                  size={expanded ? "lg" : "md"}
                >
                  <RefreshCw size={expanded ? 21 : 18} />
                </ControlButton>

                <ControlButton
                  onClick={onHangUp}
                  label="End call"
                  showLabel={expanded}
                  tone="danger"
                  size={expanded ? "lg" : "md"}
                >
                  <PhoneOff size={expanded ? 21 : 18} />
                </ControlButton>
              </div>

              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className={
                  expanded
                    ? "flex items-center gap-1.5 rounded-full bg-white/[0.05] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white/45 transition hover:bg-white/[0.09] hover:text-white/75"
                    : "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.09] text-white/85 ring-1 ring-white/[0.1] transition hover:bg-white/[0.16] active:scale-90"
                }
                aria-label={expanded ? "Back to chat" : "Expand call"}
                title={expanded ? "Back to chat" : "Expand call"}
              >
                {expanded ? (
                  <>
                    <ChevronDown size={14} />
                    Back to chat
                  </>
                ) : (
                  <Maximize2 size={18} />
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
