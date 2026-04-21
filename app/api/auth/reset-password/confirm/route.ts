import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let email: string | undefined;
  let code: string | undefined;
  let newPassword: string | undefined;

  try {
    const body = (await request.json()) as { email?: unknown; code?: unknown; newPassword?: unknown };
    if (typeof body.email === "string" && body.email.includes("@")) {
      email = body.email.trim().toLowerCase();
    }
    if (typeof body.code === "string") code = body.code.trim();
    if (typeof body.newPassword === "string") newPassword = body.newPassword;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const db = getAdminDb();
  const codeDoc = await db.collection("passwordResetCodes").doc(email).get();

  if (!codeDoc.exists) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  const data = codeDoc.data() as { code: string; expiresAt: number; used: boolean };

  if (data.used || data.code !== code || Date.now() > data.expiresAt) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  try {
    const adminAuth = getAdminAuth();
    const userRecord = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(userRecord.uid, { password: newPassword });

    // Mark code as used so it cannot be replayed.
    await db.collection("passwordResetCodes").doc(email).update({ used: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reset-password/confirm] error:", err);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
