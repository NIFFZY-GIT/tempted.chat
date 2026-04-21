import { NextRequest, NextResponse } from "next/server";
import { stripe, getPlanById, type PlanId } from "@/lib/stripe";
import { verifyAuthToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, idToken } = body as { planId?: string; idToken?: string };

    const authHeader = request.headers.get("authorization");
    const effectiveAuthHeader = authHeader ?? (idToken ? `Bearer ${idToken}` : null);

    const authenticatedUid = await verifyAuthToken(
      effectiveAuthHeader,
    );
    if (!authenticatedUid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!planId) {
      return NextResponse.json({ error: "Missing planId" }, { status: 400 });
    }

    const uid = authenticatedUid;

    const plan = getPlanById(planId as PlanId);
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://tempted.chat";

    // Fetch user email from Firebase Admin so Stripe can pre-fill it at checkout
    // and so the webhook always has it in session.customer_details.email.
    let customerEmail: string | undefined;
    try {
      const { getAdminAuth } = await import("@/lib/firebase-admin");
      const userRecord = await getAdminAuth().getUser(uid);
      if (userRecord.email) customerEmail = userRecord.email;
    } catch {
      // Non-fatal — checkout still works without it.
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: `${plan.name} — Tempted Chat`,
              description: plan.description,
            },
            unit_amount: plan.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        uid,
        planId: plan.id,
        tier: plan.tier,
        durationMs: String(plan.durationMs),
        userEmail: customerEmail ?? "",
      },
      success_url: `${origin}/?payment=success`,
      cancel_url: `${origin}/?payment=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
