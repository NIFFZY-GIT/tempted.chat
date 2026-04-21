import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAuthToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ uid: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const callerUid = await verifyAuthToken(request.headers.get("authorization"));
  if (!callerUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uid } = await context.params;
  if (!uid) {
    return NextResponse.json({ error: "User id is required" }, { status: 400 });
  }

  if (uid === callerUid) {
    return NextResponse.json({ error: "You cannot remove your own admin access." }, { status: 400 });
  }

  const adminDb = getAdminDb();
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data() as { role?: string; isAdmin?: boolean } | undefined;
  const isCallerAdmin = callerData?.role === "admin" || callerData?.isAdmin === true;
  if (!isCallerAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetRef = adminDb.collection("users").doc(uid);
  const targetDoc = await targetRef.get();
  if (!targetDoc.exists) {
    return NextResponse.json({ error: "Admin user not found." }, { status: 404 });
  }

  const targetData = targetDoc.data() as { role?: string; isAdmin?: boolean } | undefined;
  const isTargetAdmin = targetData?.role === "admin" || targetData?.isAdmin === true;
  if (!isTargetAdmin) {
    return NextResponse.json({ error: "Target user is not an admin." }, { status: 400 });
  }

  const adminsSnapshot = await adminDb.collection("users").where("role", "==", "admin").get();
  if (adminsSnapshot.size <= 1) {
    return NextResponse.json({ error: "At least one admin must remain." }, { status: 400 });
  }

  await targetRef.set({
    role: "user",
    isAdmin: false,
    adminRevokedAt: Date.now(),
    adminRevokedBy: callerUid,
    updatedAt: Date.now(),
  }, { merge: true });

  return NextResponse.json({ success: true });
}
