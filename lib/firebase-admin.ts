import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) return getApp();

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    // Normalize literal \n sequences produced by .env file readers
    const normalized = serviceAccount.replace(/\\n/g, "\n");
    let parsed: object;
    try {
      parsed = JSON.parse(normalized) as object;
    } catch (err) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_KEY is set but contains invalid JSON. ` +
        `Check that the value is a single-line JSON string. Original error: ${String(err)}`
      );
    }
    return initializeApp({ credential: cert(parsed) });
  }

  // No service account key — this will only work if Application Default
  // Credentials are configured (e.g. on Cloud Run / GCE). Locally you must
  // set FIREBASE_SERVICE_ACCOUNT_KEY in .env.
  return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}

let _adminApp: ReturnType<typeof getAdminApp> | null = null;

function getAdminAppCached() {
  if (getApps().length > 0) return getApp();
  if (!_adminApp) _adminApp = getAdminApp();
  return _adminApp;
}

export const adminAuth = getAuth(getAdminAppCached());
export const adminDb = getFirestore(getAdminAppCached());

/**
 * Extracts and verifies a Firebase ID token from the Authorization header.
 * Returns the decoded token's UID, or null if invalid/missing.
 */
export async function verifyAuthToken(
  authHeader: string | null,
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}
