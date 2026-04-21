import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendMail, buildPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function generateCode(): string {
  // Cryptographically random 6-digit code.
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

export async function POST(request: NextRequest) {
  let email: string | undefined;

  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email === "string" && body.email.includes("@")) {
      email = body.email.trim().toLowerCase();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Always return success to avoid leaking whether an email is registered (OWASP).
  try {
    const code = generateCode();
    const db = getAdminDb();
    await db.collection("passwordResetCodes").doc(email).set({
      code,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      used: false,
    });

    const html = buildPasswordResetEmail(code);
    await sendMail(email, "Your Tempted Chat reset code", html);
  } catch (err) {
    console.error("[reset-password] error:", err);
  }

  return NextResponse.json({ success: true });
}
