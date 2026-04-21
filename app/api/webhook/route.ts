import { NextRequest, NextResponse } from "next/server";
import { stripe, getPlanById, type PlanId } from "@/lib/stripe";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { sendMail, buildInvoiceEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const adminDb = getAdminDb();
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

    // Send invoice email — awaited so it completes before the serverless function exits.
    try {
      // Email priority: stored in metadata at checkout → Stripe customer_details → Firebase Auth lookup
      let userEmail: string | null =
        (session.metadata?.userEmail || null) ??
        session.customer_details?.email ??
        null;

      if (!userEmail) {
        try {
          const userRecord = await getAdminAuth().getUser(uid);
          userEmail = userRecord.email ?? null;
        } catch (authErr) {
          console.error("[webhook] getUser failed:", authErr);
        }
      }

      console.log(`[webhook] email resolved: ${userEmail ?? "NONE"} for uid=${uid}`);

      if (userEmail) {
        const plan = getPlanById(planId as PlanId);
        const planName = plan?.name ?? planId;
        const durationLabel = plan?.description ?? "";
        const amountCents = session.amount_total ?? (plan?.price ?? 0);

        const html = buildInvoiceEmail({
          orderId: session.id,
          planName,
          tier: tier as "vip" | "vvip",
          durationLabel,
          amountCents,
          activatedAt: now,
          expiresAt: startFrom + durationMs,
        });

        await sendMail(userEmail, `Your tempted.chat ${tier.toUpperCase()} Invoice`, html);
        console.log(`Invoice email sent to ${userEmail} for plan ${planId}`);
      }
    } catch (emailErr) {
      // Log but don't fail the webhook — Stripe will retry on non-200 responses.
      console.error("Failed to send invoice email:", emailErr);
    }
  }

  return NextResponse.json({ received: true });
}
