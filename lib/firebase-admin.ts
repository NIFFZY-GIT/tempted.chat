import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) return getApp();

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    try {
      // Normalize escaped newlines that may come from .env files
      const normalized = serviceAccount.replace(/\\n/g, "\n");
      return initializeApp({ credential: cert(JSON.parse(normalized)) });
    } catch {
      // Fall through to project-only init if JSON is malformed at build time
    }
  }
  return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}

function getAdminAppLazy() {
  if (getApps().length > 0) return getApp();
  return getAdminApp();
}

export const adminAuth = getAuth(getAdminAppLazy());
export const adminDb = getFirestore(getAdminAppLazy());

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
