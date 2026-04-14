import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAuthToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authenticatedUid = await verifyAuthToken(
    request.headers.get("authorization"),
  );
  if (!authenticatedUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = authenticatedUid;

  try {
    const doc = await getAdminDb().collection("subscriptions").doc(uid).get();

    if (!doc.exists) {
      return NextResponse.json({ active: false, expiresAt: null });
    }

    const data = doc.data() as { expiresAt?: number; tier?: string };
    const active = typeof data.expiresAt === "number" && data.expiresAt > Date.now();

    return NextResponse.json({
      active,
      expiresAt: data.expiresAt ?? null,
      tier: active ? (data.tier ?? null) : null,
    });
  } catch (error) {
    console.error("Subscription status check error:", error);
    return NextResponse.json({ error: "Failed to check subscription" }, { status: 500 });
  }
}
