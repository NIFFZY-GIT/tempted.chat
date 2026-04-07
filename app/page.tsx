"use client";

import { auth, googleProvider } from "@/lib/firebase";
import {
  AuthView,
  ChatFilters,
  ChatMode,
  ChatRoomView,
  FilterOptionsView,
  generateRandomStrangerProfile,
  ModeSelectionView,
  ProfileGender,
  ProfileSetupView,
  starterMessages,
  type ChatMessage,
  type UserProfile,
} from "@/components/chat-ui";
import { SiteFooter } from "@/components/footer";
import { TopNav } from "@/components/navbar";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authMethod, setAuthMethod] = useState<"email" | "google" | "anonymous">(
    "anonymous",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode | null>(null);
  const [chatFilters, setChatFilters] = useState<ChatFilters | null>(null);
  const [strangerProfile, setStrangerProfile] = useState<UserProfile>(
    generateRandomStrangerProfile(),
  );
  const [profileGender, setProfileGender] = useState<ProfileGender | null>(null);
  const [profileAge, setProfileAge] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setChatMode(null);
      setChatFilters(null);
      setProfileGender(null);
      setProfileAge("");
      setProfileError(null);
      return;
    }

    const storageKey = `profile_${user.uid}`;
    const rawProfile = window.localStorage.getItem(storageKey);

    if (!rawProfile) {
      setProfile(null);
      return;
    }

    try {
      const parsed = JSON.parse(rawProfile) as UserProfile;
      if (
        (parsed.gender === "Male" || parsed.gender === "Female" || parsed.gender === "Other") &&
        Number.isFinite(parsed.age)
      ) {
        setProfile(parsed);
      }
    } catch {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const onSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(URL.createObjectURL(file));
    setSelectedFileName(file.name);
  };

  const clearAttachment = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(null);
    setSelectedFileName(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sendMessage = () => {
    if (!text.trim() && !imagePreview) {
      return;
    }

    const now = new Date();
    const sentAt = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        author: "you",
        text: text.trim() || undefined,
        image: imagePreview ?? undefined,
        sentAt,
      },
    ]);

    setText("");
    setImagePreview(null);
    setSelectedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const loginAnonymously = async () => {
    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      await signInAnonymously(auth);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Guest login failed. Try again.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google login failed. Try again.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const loginWithEmail = async () => {
    if (!email || !password) {
      setAuthError("Enter email and password.");
      return;
    }

    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);

      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Email login failed. Try again.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email) {
      setAuthError("Enter your email above, then click Forgot Password.");
      return;
    }

    try {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      await sendPasswordResetEmail(auth, email);
      setAuthNotice("Password reset email sent. Check your inbox.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not send reset email. Try again.";
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try {
      setAuthBusy(true);
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  };

  const isAuthenticated = Boolean(user);

  const saveProfile = () => {
    const parsedAge = Number(profileAge);

    if (!profileGender) {
      setProfileError("Please choose your gender.");
      return;
    }

    if (!Number.isInteger(parsedAge) || parsedAge < 5 || parsedAge > 99) {
      setProfileError("Enter a valid age between 5 and 99.");
      return;
    }

    if (!user) {
      setProfileError("User session not found. Please login again.");
      return;
    }

    const nextProfile: UserProfile = {
      gender: profileGender,
      age: parsedAge,
    };

    window.localStorage.setItem(`profile_${user.uid}`, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    setProfileError(null);
  };

  if (authLoading) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={false}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={true}
          />
          <section className="auth-shell">
            <article className="auth-panel auth-loading">Checking account session...</article>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
          />
          <AuthView
            authMethod={authMethod}
            setAuthMethod={setAuthMethod}
            authMode={authMode}
            setAuthMode={setAuthMode}
            authBusy={authBusy}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            setAuthError={setAuthError}
            authError={authError}
            authNotice={authNotice}
            emailInputRef={emailInputRef}
            loginAnonymously={loginAnonymously}
            loginWithGoogle={loginWithGoogle}
            loginWithEmail={loginWithEmail}
            resetPassword={resetPassword}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
          />
          <ProfileSetupView
            profileGender={profileGender}
            setProfileGender={setProfileGender}
            profileAge={profileAge}
            setProfileAge={setProfileAge}
            profileError={profileError}
            onBack={logout}
            onContinue={saveProfile}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!chatMode) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
          />
          <ModeSelectionView
            onChooseMode={(mode) => {
              setChatMode(mode);
              setChatFilters(null);
            }}
            onBack={() => {
              setChatMode(null);
              setProfileGender(profile.gender);
              setProfileAge(String(profile.age));
            }}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  if (!chatFilters) {
    return (
      <>
        <main className="screen">
          <TopNav
            isAuthenticated={isAuthenticated}
            onLogin={() => {
              setAuthMethod("email");
              emailInputRef.current?.focus();
            }}
            onLogout={logout}
            isWorking={authBusy}
          />
          <FilterOptionsView
            initialFilters={{
              gender: "Any",
              ageGroup: "Any age",
              style: "Any style",
            }}
            onApply={(filters) => {
              setChatFilters(filters);
              setStrangerProfile(generateRandomStrangerProfile(filters));
            }}
            onBack={() => setChatMode(null)}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <main className="screen">
        <TopNav
          isAuthenticated={isAuthenticated}
          onLogin={() => {
            setAuthMethod("email");
            emailInputRef.current?.focus();
          }}
          onLogout={logout}
          isWorking={authBusy}
        />
        <ChatRoomView
          strangerProfile={strangerProfile}
          chatMode={chatMode}
          chatFilters={chatFilters}
          messages={messages}
          text={text}
          setText={setText}
          sendMessage={sendMessage}
          fileInputRef={fileInputRef}
          onSelectImage={onSelectImage}
          clearAttachment={clearAttachment}
          imagePreview={imagePreview}
          selectedFileName={selectedFileName}
          onLeaveChat={(filters) => {
            setStrangerProfile(generateRandomStrangerProfile(filters));
            setMessages(starterMessages);
            setText("");
            clearAttachment();
          }}
          onChangeMode={() => {
            setChatFilters(null);
          }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
