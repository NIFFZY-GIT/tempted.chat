import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAuthToken, getAdminAuth } from "@/lib/firebase-admin";
import { sendMail, buildAdminInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  // Verify caller is an admin
  const callerUid = await verifyAuthToken(request.headers.get("authorization"));
  if (!callerUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role via Firestore (server-side check)
  const adminDb = getAdminDb();
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data() as { role?: string; isAdmin?: boolean } | undefined;
  const isAdmin =
    callerData?.role === "admin" || callerData?.isAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email === "string" && body.email.includes("@")) {
      email = body.email.trim().toLowerCase();
    }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Look up inviter display name
  let inviterName = "An admin";
  try {
    const inviterRecord = await getAdminAuth().getUser(callerUid);
    inviterName = inviterRecord.displayName ?? inviterRecord.email ?? "An admin";
  } catch { /* non-fatal */ }

  const token = generateToken();
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

  await adminDb.collection("adminInvites").doc(token).set({
    email,
    invitedBy: callerUid,
    inviterName,
    expiresAt,
    used: false,
    createdAt: Date.now(),
  });

  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://tempted.chat"}/admin/accept-invite?token=${token}`;

  try {
    const html = buildAdminInviteEmail(inviterName, inviteLink);
    await sendMail(email, "You've been invited to manage tempted.chat", html);
  } catch (err) {
    console.error("[invite-admin] email error:", err);
    // Don't fail — the invite token is stored, they can be resent
  }

  return NextResponse.json({ success: true });
}

// GET: list all pending/active admin invites + current admins
export async function GET(request: NextRequest) {
  const callerUid = await verifyAuthToken(request.headers.get("authorization"));
  if (!callerUid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminDb = getAdminDb();
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data() as { role?: string; isAdmin?: boolean } | undefined;
  if (callerData?.role !== "admin" && !callerData?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get current admins
  const usersSnap = await adminDb.collection("users").where("role", "==", "admin").get();
  const admins = usersSnap.docs.map((d) => {
    const data = d.data() as { email?: string; displayName?: string; role?: string };
    return { uid: d.id, email: data.email ?? "", displayName: data.displayName ?? "" };
  });

  // Get pending invites (not used, not expired)
  const invitesSnap = await adminDb.collection("adminInvites")
    .where("used", "==", false)
    .get();
  const now = Date.now();
  const pendingInvites = invitesSnap.docs
    .filter((d) => (d.data() as { expiresAt: number }).expiresAt > now)
    .map((d) => {
      const data = d.data() as { email: string; inviterName: string; expiresAt: number; createdAt: number };
      return { token: d.id, email: data.email, inviterName: data.inviterName, expiresAt: data.expiresAt, createdAt: data.createdAt };
    });

  return NextResponse.json({ admins, pendingInvites });
}
