"use client";

import { auth, googleProvider } from "@/lib/firebase";
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
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: number;
  author: "you" | "stranger";
  text?: string;
  image?: string;
  sentAt: string;
};

type ProfileGender = "male" | "female" | "other";

type UserProfile = {
  gender: ProfileGender;
  age: number;
};

type ChatMode = "text" | "video" | "group";

const pickRandomGender = (): ProfileGender => {
  const genders: ProfileGender[] = ["male", "female", "other"];
  return genders[Math.floor(Math.random() * genders.length)];
};

const generateRandomStrangerProfile = (): UserProfile => {
  return {
    gender: pickRandomGender(),
    age: Math.floor(Math.random() * (45 - 18 + 1)) + 18,
  };
};

const starterMessages: ChatMessage[] = [
  {
    id: 1,
    author: "stranger",
    text: "Hey! I am a random stranger. Tell me what music you are into.",
    sentAt: "09:12",
  },
  {
    id: 2,
    author: "you",
    text: "Mostly indie + electronic. Want to trade playlists?",
    sentAt: "09:12",
  },
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.3 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.1 0 9.8-1.9 13.4-5.1l-6.2-5.2c-2 1.5-4.5 2.3-7.2 2.3-5.2 0-9.6-3.3-11.1-8l-6.5 5C9.7 39.5 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.2 5.4-6.1 6.8l6.2 5.2C39 36.7 44 31 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function MainLogo() {
  return (
    <Image
      src="/asstes/logo/logologoheartandtempetedchat.png"
      alt="Tempted Chat"
      width={260}
      height={48}
      priority
      className="main-logo-image"
    />
  );
}

function GenderIcon({ gender }: { gender: ProfileGender }) {
  if (gender === "male") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="9" cy="15" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12.5 11.5 19 5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M14 5h5v5" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (gender === "female") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 13v8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8.5 18h7" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M13 7l5-5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M14.5 2h3.5v3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 14v7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M7.5 18h5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function TopNav({
  isAuthenticated,
  onLogin,
  onLogout,
  isWorking,
}: {
  isAuthenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
  isWorking: boolean;
}) {
  return (
    <nav className="top-nav" aria-label="Main navigation">
      <div className="top-nav-inner">
        <a href="#" className="brand-link" aria-label="Tempted Chat home">
          <MainLogo />
        </a>

        <div className="nav-links" aria-label="Primary links">
          <a href="#">Home</a>
          <a href="#">Safety</a>
          <a href="#">About</a>
        </div>

        <button
          type="button"
          className="nav-cta"
          onClick={isAuthenticated ? onLogout : onLogin}
          disabled={isWorking}
        >
          {isAuthenticated ? "Log Out" : "Log In"}
        </button>
      </div>
    </nav>
  );
}

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
  const [strangerProfile, setStrangerProfile] = useState<UserProfile>(
    generateRandomStrangerProfile(),
  );
  const [profileGender, setProfileGender] = useState<ProfileGender | null>(null);
  const [profileAge, setProfileAge] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [messages, setMessages] = useState(starterMessages);
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
        (parsed.gender === "male" || parsed.gender === "female" || parsed.gender === "other") &&
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

  const onSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
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
        error instanceof Error
          ? error.message
          : "Could not send reset email. Try again.";
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

  const findNextStranger = () => {
    setStrangerProfile(generateRandomStrangerProfile());
  };

  const saveProfile = () => {
    const parsedAge = Number(profileAge);

    if (!profileGender) {
      setProfileError("Please choose your gender.");
      return;
    }

    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 99) {
      setProfileError("Enter a valid age between 13 and 99.");
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
    );
  }

  if (!isAuthenticated) {
    return (
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
        <section className="auth-shell">
          <article className="auth-brand">
            <p className="eyebrow">TEMPTED.CHAT</p>
            <h1>Video-era random chat, rebuilt for 2026.</h1>
            <p>
              Match in seconds, keep things respectful, and share text + images
              in one clean interface.
            </p>
            <ul className="feature-list">
              <li>Anonymous guest mode</li>
              <li>Email and password login</li>
              <li>Fast stranger matching flow</li>
              <li>Image sharing in chat</li>
            </ul>
          </article>

          <article className="auth-panel">
            <h2>Choose login option</h2>
            <p>Select one option below. Phone login is not included.</p>

            <div className="auth-methods">
              <button
                type="button"
                className={`provider-btn provider-anonymous ${authMethod === "anonymous" ? "active" : ""}`}
                onClick={() => {
                  setAuthMethod("anonymous");
                  void loginAnonymously();
                }}
                disabled={authBusy}
              >
                <span className="method-icon">A</span>
                <span>Sign In Anonymously</span>
                <span className="fast-pill">FAST</span>
              </button>

              <button
                type="button"
                className={`provider-btn provider-google ${authMethod === "google" ? "active" : ""}`}
                onClick={() => {
                  setAuthMethod("google");
                  void loginWithGoogle();
                }}
                disabled={authBusy}
              >
                <span className="method-icon google-mark-icon">
                  <GoogleMark />
                </span>
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                className={`provider-btn provider-email ${authMethod === "email" ? "active" : ""}`}
                onClick={() => {
                  setAuthMethod("email");
                  setAuthError(null);
                  emailInputRef.current?.focus();
                }}
                disabled={authBusy}
              >
                <span className="method-icon">@</span>
                <span>Email &amp; Password</span>
              </button>
            </div>

            {authMethod === "email" && (
              <div className="auth-form">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />

                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                />

                <button
                  type="button"
                  className="google-btn"
                  onClick={() => void loginWithEmail()}
                  disabled={authBusy}
                >
                  {authBusy
                    ? "Please wait..."
                    : authMode === "signup"
                      ? "Create account"
                      : "Login"}
                </button>

                <button
                  type="button"
                  className="forgot-pass-btn"
                  onClick={() => void resetPassword()}
                  disabled={authBusy}
                >
                  Forgot Password?
                </button>

                <button
                  type="button"
                  className="switch-auth"
                  onClick={() => {
                    setAuthMode((prev) => (prev === "signin" ? "signup" : "signin"));
                    setAuthError(null);
                    emailInputRef.current?.focus();
                  }}
                >
                  {authMode === "signin"
                    ? "New user? Create account"
                    : "Already have an account? Sign in"}
                </button>
              </div>
            )}

            {authError && <p className="auth-error">{authError}</p>}
            {authNotice && <p className="auth-notice">{authNotice}</p>}

            <p className="tiny-note">
              By continuing, you agree to community rules and anti-abuse policy.
            </p>
          </article>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
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
        <section className="profile-card">
          <p className="eyebrow">PROFILE SETUP</p>
          <h2>Tell us about you</h2>
          <p className="profile-copy">
            Complete your profile before entering chat. This helps us match better.
          </p>

          <div className="gender-grid">
            <button
              type="button"
              className={`gender-btn ${profileGender === "male" ? "active" : ""}`}
              onClick={() => setProfileGender("male")}
            >
              <span className="gender-btn-content">
                <span className="gender-icon male"><GenderIcon gender="male" /></span>
                <span>Male</span>
              </span>
            </button>
            <button
              type="button"
              className={`gender-btn ${profileGender === "female" ? "active" : ""}`}
              onClick={() => setProfileGender("female")}
            >
              <span className="gender-btn-content">
                <span className="gender-icon female"><GenderIcon gender="female" /></span>
                <span>Female</span>
              </span>
            </button>
            <button
              type="button"
              className={`gender-btn ${profileGender === "other" ? "active" : ""}`}
              onClick={() => setProfileGender("other")}
            >
              <span className="gender-btn-content">
                <span className="gender-icon other"><GenderIcon gender="other" /></span>
                <span>Other</span>
              </span>
            </button>
          </div>

          <label htmlFor="profile-age" className="profile-age-label">
            Age
          </label>
          <input
            id="profile-age"
            type="number"
            min={13}
            max={99}
            value={profileAge}
            onChange={(event) => setProfileAge(event.target.value)}
            placeholder="Enter your age"
            className="profile-age-input"
          />

          {profileError && <p className="auth-error">{profileError}</p>}

          <button type="button" className="google-btn" onClick={saveProfile}>
            Continue to chat
          </button>
        </section>
      </main>
    );
  }

  if (!chatMode) {
    return (
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
        <section className="mode-card">
          <p className="eyebrow">CHAT MODE</p>
          <h2>Choose how you want to connect</h2>
          <p className="profile-copy">Pick one mode to continue.</p>

          <div className="mode-grid">
            <button
              type="button"
              className="mode-option"
              onClick={() => setChatMode("text")}
            >
              <span className="mode-icon">TT</span>
              <span>Text to text chat</span>
            </button>

            <button
              type="button"
              className="mode-option"
              onClick={() => setChatMode("video")}
            >
              <span className="mode-icon">VC</span>
              <span>Video call</span>
            </button>

            <button
              type="button"
              className="mode-option"
              onClick={() => setChatMode("group")}
            >
              <span className="mode-icon">GT</span>
              <span>Group text</span>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
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
      <section className="chat-elevated">
        <header className="chat-elevated-header">
          <div className="header-left">
            <p className="eyebrow">LIVE CHAT</p>
            <h2>Stranger room</h2>
            <p className="auth-user-chip">
              {user?.isAnonymous ? "Guest account" : user?.email ?? "Signed in user"}
            </p>
            <p className="auth-user-chip">{`${profile.gender}, ${profile.age}`}</p>
            <p className="auth-user-chip">{`Mode: ${chatMode}`}</p>
            <p className="stranger-chip">
              {`Connected stranger: ${strangerProfile.gender}, ${strangerProfile.age}`}
            </p>
          </div>
          <div className="chat-actions">
            <span className="status-dot">Connected</span>
            <button type="button" className="mode-switch-btn" onClick={() => setChatMode(null)}>
              Change Mode
            </button>
            <button type="button" className="new-match-btn" onClick={findNextStranger}>
              Next
            </button>
          </div>
        </header>

        <div className="chat-log elevated-log">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`bubble ${message.author === "you" ? "outgoing" : "incoming"}`}
            >
              <p className="author-label">
                {message.author === "you" ? "You" : "Stranger"}
              </p>
              {message.text && <p>{message.text}</p>}
              {message.image && (
                <Image
                  src={message.image}
                  alt="Uploaded by sender"
                  className="bubble-image"
                  width={520}
                  height={280}
                  unoptimized
                />
              )}
              <time>{message.sentAt}</time>
            </article>
          ))}
        </div>

        {imagePreview && (
          <div className="attachment-preview">
            <Image
              src={imagePreview}
              alt="Attachment preview"
              width={64}
              height={64}
              unoptimized
            />
            <div>
              <p>{selectedFileName}</p>
              <button type="button" onClick={clearAttachment}>
                Remove image
              </button>
            </div>
          </div>
        )}

        <div className="composer elevated-composer">
          <input
            type="text"
            placeholder="Write a message..."
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                sendMessage();
              }
            }}
          />

          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept="image/*"
            onChange={onSelectImage}
          />

          <button
            type="button"
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Attach
          </button>

          <button type="button" className="send-btn" onClick={sendMessage}>
            Send
          </button>
        </div>
      </section>
    </main>
  );
}
