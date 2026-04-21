import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, verifyAuthToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type UserRecord = {
  role?: string;
  isAdmin?: boolean;
  isAnonymous?: boolean;
  authProvider?: string;
};

async function requireAdmin(callerUid: string) {
  const adminDb = getAdminDb();
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data() as UserRecord | undefined;
  if (callerData?.role !== "admin" && callerData?.isAdmin !== true) {
    return null;
  }
  return adminDb;
}

export async function DELETE(request: NextRequest) {
  const callerUid = await verifyAuthToken(request.headers.get("authorization"));
  if (!callerUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = await requireAdmin(callerUid);
  if (!adminDb) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [anonFlagSnap, anonProviderSnap] = await Promise.all([
    adminDb.collection("users").where("isAnonymous", "==", true).get(),
    adminDb.collection("users").where("authProvider", "==", "anonymous").get(),
  ]);

  const targets = new Map<string, UserRecord>();
  anonFlagSnap.forEach((doc) => targets.set(doc.id, doc.data() as UserRecord));
  anonProviderSnap.forEach((doc) => targets.set(doc.id, doc.data() as UserRecord));

  let deletedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const [uid, data] of targets) {
    const isAdmin = data.role === "admin" || data.isAdmin === true;
    if (uid === callerUid || isAdmin) {
      skippedCount += 1;
      continue;
    }

    try {
      try {
        await getAdminAuth().deleteUser(uid);
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (code !== "auth/user-not-found") {
          throw error;
        }
      }

      await Promise.allSettled([
        adminDb.collection("users").doc(uid).delete(),
        adminDb.collection("subscriptions").doc(uid).delete(),
        adminDb.collection("waitingUsers").doc(uid).delete(),
      ]);

      deletedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return NextResponse.json({
    success: true,
    deletedCount,
    skippedCount,
    failedCount,
  });
}
