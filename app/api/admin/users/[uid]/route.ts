import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, verifyAuthToken } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { buildAccountBlockedEmail, buildAccountWarningEmail, sendMail } from "@/lib/email";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ uid: string }>;
};

async function requireAdmin(callerUid: string) {
  const adminDb = getAdminDb();
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data() as { role?: string; isAdmin?: boolean } | undefined;
  if (callerData?.role !== "admin" && callerData?.isAdmin !== true) {
    return null;
  }
  return adminDb;
}

async function resolveTarget(adminDb: FirebaseFirestore.Firestore, uid: string) {
  const targetDoc = await adminDb.collection("users").doc(uid).get();
  if (!targetDoc.exists) {
    return null;
  }

  const targetData = targetDoc.data() as { role?: string; isAdmin?: boolean; email?: string | null } | undefined;
  let targetEmail = typeof targetData?.email === "string" ? targetData.email : null;

  if (!targetEmail) {
    try {
      const authRecord = await getAdminAuth().getUser(uid);
      targetEmail = authRecord.email ?? null;
    } catch {
      targetEmail = null;
    }
  }

  return { targetDoc, targetData, targetEmail };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const callerUid = await verifyAuthToken(request.headers.get("authorization"));
  if (!callerUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uid } = await context.params;
  if (!uid) {
    return NextResponse.json({ error: "User id is required" }, { status: 400 });
  }

  let blocked: boolean | null = null;
  try {
    const body = (await request.json()) as { blocked?: unknown };
    blocked = typeof body.blocked === "boolean" ? body.blocked : null;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (blocked === null) {
    return NextResponse.json({ error: "Blocked flag is required" }, { status: 400 });
  }

  if (uid === callerUid && blocked) {
    return NextResponse.json({ error: "You cannot block your own account" }, { status: 400 });
  }

  const adminDb = await requireAdmin(callerUid);
  if (!adminDb) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await resolveTarget(adminDb, uid);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { targetData, targetEmail } = target;
  if (blocked && (targetData?.role === "admin" || targetData?.isAdmin === true)) {
    return NextResponse.json({ error: "Admin accounts cannot be blocked here" }, { status: 400 });
  }

  try {
    await getAdminAuth().updateUser(uid, { disabled: blocked });
  } catch (error) {
    console.error("[admin-users] failed updating auth user", error);
    return NextResponse.json({ error: "Failed to update auth user" }, { status: 500 });
  }

  await adminDb.collection("users").doc(uid).set(
    blocked
      ? {
          isBlocked: true,
          blockedAt: Date.now(),
          blockedBy: callerUid,
          updatedAt: Date.now(),
        }
      : {
          isBlocked: false,
          blockedAt: null,
          blockedBy: null,
          unblockedAt: Date.now(),
          unblockedBy: callerUid,
          updatedAt: Date.now(),
        },
    { merge: true },
  );

  if (blocked && targetEmail) {
    try {
      await sendMail(targetEmail, "Tempted Chat account restricted", buildAccountBlockedEmail());
    } catch (error) {
      console.error("[admin-users] failed sending block warning email", error);
    }
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const callerUid = await verifyAuthToken(request.headers.get("authorization"));
  if (!callerUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uid } = await context.params;
  if (!uid) {
    return NextResponse.json({ error: "User id is required" }, { status: 400 });
  }

  const adminDb = await requireAdmin(callerUid);
  if (!adminDb) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await resolveTarget(adminDb, uid);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { targetDoc, targetEmail } = target;

  await targetDoc.ref.set({
    warningCount: FieldValue.increment(1),
    lastWarnedAt: Date.now(),
    lastWarnedBy: callerUid,
    updatedAt: Date.now(),
  }, { merge: true });

  let emailed = false;
  if (targetEmail) {
    try {
      await sendMail(targetEmail, "Tempted Chat warning notice", buildAccountWarningEmail());
      emailed = true;
    } catch (error) {
      console.error("[admin-users] failed sending warning email", error);
    }
  }

  return NextResponse.json({ success: true, emailed });
}

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
    return NextResponse.json({ error: "You cannot delete your own account here" }, { status: 400 });
  }

  const adminDb = await requireAdmin(callerUid);
  if (!adminDb) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await resolveTarget(adminDb, uid);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.targetData?.role === "admin" || target.targetData?.isAdmin === true) {
    return NextResponse.json({ error: "Admin accounts cannot be deleted here" }, { status: 400 });
  }

  try {
    await getAdminAuth().deleteUser(uid);
  } catch (error) {
    console.error("[admin-users] failed deleting auth user", error);
    return NextResponse.json({ error: "Failed to delete auth user" }, { status: 500 });
  }

  await Promise.allSettled([
    adminDb.collection("users").doc(uid).delete(),
    adminDb.collection("subscriptions").doc(uid).delete(),
    adminDb.collection("waitingUsers").doc(uid).delete(),
  ]);

  return NextResponse.json({ success: true });
}
