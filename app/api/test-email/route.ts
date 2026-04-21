import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/email";

export const dynamic = "force-dynamic";

// TEMPORARY debug endpoint — remove after confirming email works.
// Usage: POST /api/test-email  { "to": "you@example.com" }
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const expectedSecret = process.env.TEST_EMAIL_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "Test email endpoint is not configured" }, { status: 503 });
  }

  const secret = request.headers.get("x-test-secret");
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let to: string | undefined;
  try {
    const body = (await request.json()) as { to?: unknown };
    if (typeof body.to === "string") to = body.to;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!to) return NextResponse.json({ error: "Missing 'to' field" }, { status: 400 });

  try {
    await sendMail(to, "Tempted Chat — SMTP test", `<p style="font-family:sans-serif;">SMTP is working ✅<br/>Sent at: ${new Date().toISOString()}</p>`);
    return NextResponse.json({ success: true, to });
  } catch (err) {
    console.error("[test-email] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
