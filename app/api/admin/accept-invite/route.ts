import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, verifyAuthToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const callerUid = await verifyAuthToken(request.headers.get("authorization"));
  if (!callerUid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let token: string | undefined;
  try {
    const body = (await request.json()) as { token?: unknown };
    if (typeof body.token === "string") token = body.token.trim();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const adminDb = getAdminDb();
  const inviteRef = adminDb.collection("adminInvites").doc(token);
  const inviteDoc = await inviteRef.get();

  if (!inviteDoc.exists) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
  }

  const data = inviteDoc.data() as { email: string; expiresAt: number; used: boolean };

  if (data.used || data.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Invite has expired or already been used" }, { status: 400 });
  }

  let callerEmail: string | null = null;
  try {
    const callerRecord = await getAdminAuth().getUser(callerUid);
    callerEmail = callerRecord.email?.trim().toLowerCase() ?? null;
  } catch {
    return NextResponse.json({ error: "Failed to verify invited account" }, { status: 500 });
  }

  const invitedEmail = data.email.trim().toLowerCase();
  if (!callerEmail || callerEmail !== invitedEmail) {
    return NextResponse.json({ error: "This invite is only valid for the invited email address" }, { status: 403 });
  }

  // Grant admin role to the accepting user
  await adminDb.collection("users").doc(callerUid).set(
    {
      role: "admin",
      isAdmin: true,
      adminGrantedAt: Date.now(),
      adminGrantedViaInvite: token,
      adminInviteEmail: invitedEmail,
    },
    { merge: true }
  );

  // Mark invite as used
  await inviteRef.update({ used: true, usedBy: callerUid, usedAt: Date.now() });

  return NextResponse.json({ success: true });
}
