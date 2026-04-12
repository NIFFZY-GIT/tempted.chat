import { NextRequest, NextResponse } from "next/server";
import { getApps } from "firebase-admin/app";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const adminDb = getFirestore();

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");

  if (!uid) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }

  try {
    const doc = await adminDb.collection("subscriptions").doc(uid).get();

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
