import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin if not already done.
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const adminDb = getFirestore();

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    const planId = session.metadata?.planId;
    const tier = session.metadata?.tier;
    const durationMs = Number(session.metadata?.durationMs);

    if (!uid || !planId || !tier || !Number.isFinite(durationMs)) {
      console.error("Missing metadata in checkout session:", session.id);
      return NextResponse.json({ received: true });
    }

    const now = Date.now();
    const subscriptionRef = adminDb.collection("subscriptions").doc(uid);

    // Extend existing subscription if still active AND same tier, otherwise start fresh.
    const existingDoc = await subscriptionRef.get();
    const existingData = existingDoc.data() as { expiresAt?: number; tier?: string } | undefined;
    const sameTier = existingData?.tier === tier;
    const startFrom =
      sameTier && existingData?.expiresAt && existingData.expiresAt > now
        ? existingData.expiresAt
        : now;

    await subscriptionRef.set(
      {
        uid,
        planId,
        tier,
        activatedAt: now,
        expiresAt: startFrom + durationMs,
        stripeSessionId: session.id,
        paymentStatus: session.payment_status,
        updatedAt: now,
      },
      { merge: true },
    );

    console.log(`Subscription activated: uid=${uid}, plan=${planId}, expires=${new Date(startFrom + durationMs).toISOString()}`);
  }

  return NextResponse.json({ received: true });
}
