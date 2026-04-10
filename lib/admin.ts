import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AppUserRole = "admin" | "user";

export const getUserRole = async (uid: string): Promise<AppUserRole> => {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return "user";
  }

  const data = snapshot.data() as {
    role?: string;
    isAdmin?: boolean;
    roles?: string[];
  };

  const normalizedRole = typeof data.role === "string" ? data.role.trim().toLowerCase() : "";
  if (normalizedRole === "admin") {
    return "admin";
  }

  if (data.isAdmin === true) {
    return "admin";
  }

  if (Array.isArray(data.roles) && data.roles.some((role) => role?.trim().toLowerCase() === "admin")) {
    return "admin";
  }

  return "user";
};
