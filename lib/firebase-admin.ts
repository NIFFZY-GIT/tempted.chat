import { initializeApp, cert, getApps, getApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) return getApp();

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    let parsed: Record<string, unknown>;
    try {
      // Parse raw JSON first. For .env values that contain escaped newlines
      // (\n), normalize only the private_key field after parsing.
      parsed = JSON.parse(serviceAccount) as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_KEY is set but contains invalid JSON. ` +
        `Check that the value is a single-line JSON string. Original error: ${String(err)}`
      );
    }

    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }

    return initializeApp({ credential: cert(parsed) });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  throw new Error(
    "Firebase Admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env " +
    "or configure GOOGLE_APPLICATION_CREDENTIALS/Application Default Credentials."
  );
}

let _adminApp: ReturnType<typeof getAdminApp> | null = null;

function getAdminAppCached() {
  if (getApps().length > 0) return getApp();
  if (!_adminApp) _adminApp = getAdminApp();
  return _adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminAppCached());
}

export function getAdminDb() {
  return getFirestore(getAdminAppCached());
}

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
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (error) {
    console.error("verifyAuthToken failed:", error);

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes("firebase admin credentials") ||
        message.includes("contains invalid json") ||
        message.includes("private key") ||
        message.includes("application default credentials")
      ) {
        throw error;
      }
    }

    return null;
  }
}
