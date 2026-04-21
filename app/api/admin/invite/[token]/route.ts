import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAuthToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const callerUid = await verifyAuthToken(request.headers.get("authorization"));
  if (!callerUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = getAdminDb();
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data() as { role?: string; isAdmin?: boolean } | undefined;
  const isCallerAdmin = callerData?.role === "admin" || callerData?.isAdmin === true;
  if (!isCallerAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }

  const inviteRef = adminDb.collection("adminInvites").doc(token);
  const inviteDoc = await inviteRef.get();
  if (!inviteDoc.exists) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  await inviteRef.delete();
  return NextResponse.json({ success: true });
}
