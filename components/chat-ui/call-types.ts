/**
 * Shared call-session contract for in-chat video calling.
 *
 * A call lives on the room document (`rooms/{roomId}.call`) so both peers converge
 * even when the realtime WebSocket is unavailable. The WebSocket `chat` relay is used
 * as a low-latency accelerator that carries the exact same payload.
 */

export type CallStatus = "ringing" | "active" | "ended";
export type CallEndReason = "declined" | "cancelled" | "missed" | "hangup" | "failed";

export type CallSession = {
  id: string;
  from: string;
  to: string;
  status: CallStatus;
  startedAtMs: number;
  acceptedAtMs?: number;
  endedAtMs?: number;
  endedBy?: string;
  endReason?: CallEndReason;
};

export type CallOutcome = "completed" | "declined" | "cancelled" | "missed" | "failed";

export type CallEventSummary = {
  outcome: CallOutcome;
  direction: "outgoing" | "incoming";
  durationSeconds?: number;
};

/** How long an unanswered call keeps ringing before it is marked as missed. */
export const CALL_RING_TIMEOUT_MS = 45_000;

/** Extra grace the callee waits before self-ending, so the caller's write usually wins. */
export const CALL_RING_TIMEOUT_GRACE_MS = 4_000;

const CALL_STATUS_RANK: Record<CallStatus, number> = {
  ringing: 0,
  active: 1,
  ended: 2,
};

const isCallStatus = (value: unknown): value is CallStatus =>
  value === "ringing" || value === "active" || value === "ended";

const isCallEndReason = (value: unknown): value is CallEndReason =>
  value === "declined" || value === "cancelled" || value === "missed" || value === "hangup" || value === "failed";

/** Parses an untrusted room-document / websocket payload into a call session. */
export const normalizeCallSession = (value: unknown): CallSession | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.from !== "string" ||
    typeof raw.to !== "string" ||
    !isCallStatus(raw.status)
  ) {
    return null;
  }

  return {
    id: raw.id,
    from: raw.from,
    to: raw.to,
    status: raw.status,
    startedAtMs: typeof raw.startedAtMs === "number" ? raw.startedAtMs : 0,
    acceptedAtMs: typeof raw.acceptedAtMs === "number" ? raw.acceptedAtMs : undefined,
    endedAtMs: typeof raw.endedAtMs === "number" ? raw.endedAtMs : undefined,
    endedBy: typeof raw.endedBy === "string" ? raw.endedBy : undefined,
    endReason: isCallEndReason(raw.endReason) ? raw.endReason : undefined,
  };
};

/**
 * Decides whether an incoming call snapshot should replace the one already held.
 * Guards against out-of-order delivery between the websocket and Firestore paths.
 */
export const shouldApplyCallUpdate = (current: CallSession | null, next: CallSession): boolean => {
  if (!current) {
    return true;
  }

  if (current.id !== next.id) {
    // A newer call always wins; a late echo of an older call never does.
    return next.startedAtMs >= current.startedAtMs;
  }

  return CALL_STATUS_RANK[next.status] > CALL_STATUS_RANK[current.status];
};

export const formatCallDuration = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
};

/** Builds the chat-log summary shown after a call finishes. */
export const summarizeCallSession = (call: CallSession, currentUserId: string): CallEventSummary => {
  const direction = call.from === currentUserId ? "outgoing" : "incoming";
  const durationSeconds = call.acceptedAtMs && call.endedAtMs
    ? Math.max(0, Math.round((call.endedAtMs - call.acceptedAtMs) / 1000))
    : undefined;

  if (call.acceptedAtMs) {
    return {
      direction,
      outcome: call.endReason === "failed" ? "failed" : "completed",
      durationSeconds,
    };
  }

  if (call.endReason === "declined") {
    return { direction, outcome: "declined" };
  }

  if (call.endReason === "cancelled") {
    return { direction, outcome: "cancelled" };
  }

  if (call.endReason === "failed") {
    return { direction, outcome: "failed" };
  }

  return { direction, outcome: "missed" };
};

export const describeCallEvent = (event: CallEventSummary): string => {
  switch (event.outcome) {
    case "completed":
      return event.durationSeconds !== undefined
        ? `Video call · ${formatCallDuration(event.durationSeconds)}`
        : "Video call ended";
    case "declined":
      return "Video call declined";
    case "cancelled":
      return event.direction === "outgoing" ? "Video call cancelled" : "Missed video call";
    case "missed":
      return event.direction === "outgoing" ? "Video call · no answer" : "Missed video call";
    case "failed":
    default:
      return "Video call failed";
  }
};
