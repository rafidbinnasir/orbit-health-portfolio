"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";
import ThemeToggle from "../components/ThemeToggle";

type AstronautProfile = {
  full_name: string;
  astronaut_id: string;
  mission_name: string | null;
  avatar_url: string | null;
  created_at?: string;
};

type UserAccountStats = {
  vitalsCount: number;
  sleepCount: number;
  activeAlertsCount: number;
  joinedDate: string;
  lastSignIn: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Not recorded";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Not recorded";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Not recorded";
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "Active session";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Active session";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Active session";
  }
}

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AstronautProfile | null>(null);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [name, setName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [stats, setStats] = useState<UserAccountStats>({
    vitalsCount: 0,
    sleepCount: 0,
    activeAlertsCount: 0,
    joinedDate: "",
    lastSignIn: "",
  });

  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    let previewUrl = "";

    async function loadProfile() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (active) {
            setErrorMessage("Please sign in to view your astronaut profile.");
            setLoading(false);
          }
          return;
        }

        // Fetch profile data
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, astronaut_id, mission_name, avatar_url, created_at")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (!active) return;

        const loadedProfile = data as AstronautProfile;
        setProfile(loadedProfile);
        setName(loadedProfile.full_name ?? "");
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");

        // Fetch user telemetry statistics
        const [vitalsRes, sleepRes, alertsRes] = await Promise.all([
          supabase
            .from("vital_readings")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("sleep_reports")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("health_insights")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "active"),
        ]);

        if (active) {
          setStats({
            vitalsCount: vitalsRes.count ?? 0,
            sleepCount: sleepRes.count ?? 0,
            activeAlertsCount: alertsRes.count ?? 0,
            joinedDate: formatDate(user.created_at || loadedProfile.created_at),
            lastSignIn: formatDateTime(user.last_sign_in_at),
          });
        }

        // Fetch signed avatar URL if present
        if (loadedProfile.avatar_url) {
          const { data: signedData, error: signedError } =
            await supabase.storage
              .from("astronaut-avatars")
              .createSignedUrl(loadedProfile.avatar_url, 3600);

          if (!signedError && signedData && active) {
            previewUrl = signedData.signedUrl;
            setPhotoPreview(signedData.signedUrl);
          }
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? `Could not load profile: ${error.message}`
              : "Could not load your profile."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  function choosePhoto(file?: File) {
    setErrorMessage("");
    setMessage("");

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage("Please choose a valid JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("The profile photo must be 5 MB or smaller.");
      return;
    }

    if (photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || !profile) {
        throw new Error("Your session may have expired. Please sign in again.");
      }

      const cleanName = name.trim();
      const cleanEmail = newEmail.trim();

      if (!cleanName) {
        throw new Error("Please enter your full name.");
      }

      let avatarPath = profile.avatar_url;

      if (photoFile) {
        const extension =
          photoFile.type === "image/png"
            ? "png"
            : photoFile.type === "image/webp"
              ? "webp"
              : "jpg";

        const filePath = `${user.id}/avatar.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("astronaut-avatars")
          .upload(filePath, photoFile, {
            upsert: true,
            contentType: photoFile.type,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;
        avatarPath = filePath;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
          avatar_url: avatarPath,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      setProfile({ ...profile, full_name: cleanName, avatar_url: avatarPath });
      setPhotoFile(null);

      if (avatarPath) {
        const { data: signedData, error: signedError } =
          await supabase.storage
            .from("astronaut-avatars")
            .createSignedUrl(avatarPath, 3600);

        if (!signedError && signedData) {
          setPhotoPreview(signedData.signedUrl);
        }
      }

      if (cleanEmail.toLowerCase() !== (user.email ?? "").toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: cleanEmail,
        });

        if (emailError) throw emailError;

        setMessage(
          "Profile saved successfully. A verification link has been sent to your new email address to complete the update."
        );
        setEditing(false);
      } else {
        setMessage("Your astronaut profile has been updated successfully.");
        setEmail(user.email ?? "");
        setNewEmail(user.email ?? "");
        setEditing(false);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while saving your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (!profile) return;
    setName(profile.full_name);
    setNewEmail(email);
    setPhotoFile(null);
    setEditing(false);
    setErrorMessage("");
    setMessage("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function copyAstronautId() {
    if (!profile?.astronaut_id) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(profile.astronaut_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out error:", error);
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-white">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* LOGO & BRAND */}
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="2" />
                <ellipse
                  cx="12"
                  cy="12"
                  rx="10"
                  ry="4.5"
                  transform="rotate(-30 12 12)"
                />
                <circle cx="19.5" cy="7.5" r="1" />
              </svg>
            </div>

            <div>
              <span className="block text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                ORBIT Health
              </span>
              <span className="block text-[10px] font-semibold tracking-widest text-cyan-600 dark:text-cyan-400">
                CREW PROFILE
              </span>
            </div>
          </Link>

          {/* ACTIONS & NAVIGATION */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <ThemeToggle />

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white sm:text-sm"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>Dashboard</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out of mission session"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-900/40 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 sm:text-sm"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">
                {signingOut ? "Signing out..." : "Sign out"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* FEEDBACK BANNERS */}
        {message && (
          <div
            role="status"
            className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/90 p-4 text-emerald-900 shadow-xs dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium leading-relaxed">{message}</p>
            </div>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="cursor-pointer text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-50/90 p-4 text-rose-900 shadow-xs dark:border-rose-500/20 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-sm font-medium leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="cursor-pointer text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-white"
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        )}

        {/* LOADING SKELETON */}
        {loading ? (
          <div className="space-y-6">
            <div className="h-52 animate-pulse rounded-3xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-96 animate-pulse rounded-3xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70 lg:col-span-2" />
              <div className="h-96 animate-pulse rounded-3xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70" />
            </div>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            {/* 1. HERO IDENTITY CARD */}
            <section
              aria-labelledby="identity-heading"
              className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm backdrop-blur-xs transition-colors dark:border-slate-800 dark:bg-slate-900/90 sm:p-8"
            >
              {/* Subtle top glow */}
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-500/15"
                aria-hidden="true"
              />

              <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                {/* AVATAR & BASIC DETAILS */}
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                  {/* AVATAR BOX */}
                  <div className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/15 via-slate-100 to-slate-200 text-3xl font-bold text-cyan-700 shadow-inner dark:border-cyan-400/30 dark:from-cyan-950/40 dark:via-slate-800 dark:to-slate-900 dark:text-cyan-300 sm:h-28 sm:w-28">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPreview}
                        alt={`${profile.full_name}'s astronaut portrait`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {profile.full_name?.trim().charAt(0).toUpperCase() ||
                          "A"}
                      </span>
                    )}

                    {/* Active Telemetry Pulse Indicator */}
                    <span
                      className="absolute bottom-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-xs dark:border-slate-900"
                      title="Biometric telemetry actively synced"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white opacity-80" />
                    </span>
                  </div>

                  {/* IDENTIFIER & MISSION DETAILS */}
                  <div className="text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                        Active Flight Crew
                      </span>

                      <button
                        type="button"
                        onClick={copyAstronautId}
                        title="Click to copy Astronaut ID"
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <span>{profile.astronaut_id}</span>
                        <svg
                          className="h-3 w-3 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        {copied && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">
                            Copied!
                          </span>
                        )}
                      </button>
                    </div>

                    <h1
                      id="identity-heading"
                      className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
                    >
                      {profile.full_name}
                    </h1>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                      {profile.mission_name ||
                        "Standard Orbital Station Telemetry"}
                    </p>
                  </div>
                </div>

                {/* TELEMETRY QUICK SUMMARY METRICS */}
                <div className="flex w-full flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-4 sm:w-auto md:border-t-0 md:pt-0">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2 text-center dark:border-slate-800 dark:bg-slate-950/50">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Telemetry
                    </span>
                    <span className="block font-mono text-base font-bold text-slate-900 dark:text-white">
                      {stats.vitalsCount}
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      Logs Recorded
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2 text-center dark:border-slate-800 dark:bg-slate-950/50">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Sleep Reports
                    </span>
                    <span className="block font-mono text-base font-bold text-slate-900 dark:text-white">
                      {stats.sleepCount}
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      Evaluated
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2 text-center dark:border-slate-800 dark:bg-slate-950/50">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Status
                    </span>
                    <span className="block text-base font-bold text-emerald-600 dark:text-emerald-400">
                      Nominal
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      Active Stream
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. MAIN 2-COLUMN SECTION: PROFILE DETAILS & SECURITY */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* PRIMARY COLUMN (2 COLS): CLINICAL PROFILE & EDIT FORM */}
              <div className="space-y-6 lg:col-span-2">
                <section
                  aria-labelledby="profile-data-heading"
                  className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/90 sm:p-7"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800/70">
                    <div>
                      <h2
                        id="profile-data-heading"
                        className="text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg"
                      >
                        {editing
                          ? "Edit Profile Details"
                          : "Crew Member Information"}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {editing
                          ? "Update your personal credentials and contact address."
                          : "Primary astronaut credentials registered with ORBIT Health."}
                      </p>
                    </div>

                    {!editing && (
                      <button
                        type="button"
                        onClick={() => {
                          setName(profile.full_name);
                          setNewEmail(email);
                          setEditing(true);
                          setMessage("");
                          setErrorMessage("");
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-500/20 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300 dark:hover:bg-cyan-400/20 sm:text-sm"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                        <span>Edit Profile</span>
                      </button>
                    )}
                  </div>

                  {editing ? (
                    /* EDIT FORM */
                    <form onSubmit={handleSave} className="mt-6 space-y-5">
                      {/* PHOTO UPLOAD INPUT */}
                      <div>
                        <label
                          htmlFor="avatar"
                          className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Profile Portrait Photo
                        </label>

                        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-500/30 bg-slate-100 text-lg font-bold text-cyan-600 dark:bg-slate-800 dark:text-cyan-400">
                            {photoPreview ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photoPreview}
                                alt="Selected preview"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (name.trim().charAt(0).toUpperCase() || "A")
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <input
                              ref={fileInput}
                              id="avatar"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(event) =>
                                choosePhoto(event.target.files?.[0])
                              }
                              className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cyan-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-cyan-700 hover:file:bg-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:file:bg-cyan-950/60 dark:file:text-cyan-300"
                            />
                            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                              Supported: JPEG, PNG, or WebP. Maximum file size:
                              5 MB.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* FULL NAME */}
                      <div>
                        <label
                          htmlFor="full-name"
                          className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Full Crew Name
                        </label>
                        <input
                          id="full-name"
                          type="text"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                          maxLength={100}
                          autoComplete="name"
                          placeholder="e.g. Commander Alex Vance"
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          Identifies your records across health logs and alerts.
                        </p>
                      </div>

                      {/* EMAIL ADDRESS */}
                      <div>
                        <label
                          htmlFor="email"
                          className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                        >
                          Registered Notification Email
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={newEmail}
                          onChange={(event) => setNewEmail(event.target.value)}
                          required
                          autoComplete="email"
                          placeholder="astronaut@orbit.mission"
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          If changed, Supabase Auth will send a confirmation
                          email to activate the new address.
                        </p>
                      </div>

                      {/* ASTRONAUT ID (READ ONLY) */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Permanent Astronaut Identifier
                        </label>
                        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 font-mono text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                          <span>{profile.astronaut_id}</span>
                          <span className="flex items-center gap-1 text-[11px] font-sans text-slate-400 dark:text-slate-500">
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                            Locked by Command
                          </span>
                        </div>
                      </div>

                      {/* FORM ACTION BUTTONS */}
                      <div className="flex flex-wrap items-center gap-3 pt-3">
                        <button
                          type="submit"
                          disabled={saving}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span>Saving Profile...</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <span>Save Changes</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleCancelEdit}
                          className="cursor-pointer rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* VIEWING MODE: STRUCTURED CLINICAL PROFILE CARDS */
                    <div className="mt-6 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* FULL NAME */}
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition-colors dark:border-slate-800/80 dark:bg-slate-950/40">
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Full Name
                          </span>
                          <span className="mt-1 block text-base font-semibold text-slate-900 dark:text-white">
                            {profile.full_name}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
                            Clinical mission registry name
                          </span>
                        </div>

                        {/* ASTRONAUT ID */}
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition-colors dark:border-slate-800/80 dark:bg-slate-950/40">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Astronaut ID
                            </span>
                            <span className="text-[10px] text-cyan-600 dark:text-cyan-400">
                              Verified
                            </span>
                          </div>
                          <span className="mt-1 block font-mono text-base font-bold text-cyan-700 dark:text-cyan-300">
                            {profile.astronaut_id}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
                            Unique biometric registry key
                          </span>
                        </div>

                        {/* EMAIL */}
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition-colors dark:border-slate-800/80 dark:bg-slate-950/40">
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Contact Email
                          </span>
                          <span className="mt-1 block truncate text-base font-medium text-slate-900 dark:text-white">
                            {email || "Not available"}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
                            Primary mission notifications
                          </span>
                        </div>

                        {/* MISSION NAME */}
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition-colors dark:border-slate-800/80 dark:bg-slate-950/40">
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Mission Assignment
                          </span>
                          <span className="mt-1 block text-base font-medium text-slate-900 dark:text-white">
                            {profile.mission_name ||
                              "Orbital Station Alpha (Default)"}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
                            Active flight operational deployment
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* BIOMETRIC INTEGRITY CARD */}
                <section
                  aria-labelledby="biometrics-heading"
                  className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/90 sm:p-7"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>

                    <div>
                      <h3
                        id="biometrics-heading"
                        className="text-sm font-bold text-slate-900 dark:text-white"
                      >
                        Biometric Telemetry Synchronization
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Hardware device linking and data integrity.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/60 dark:bg-slate-950/40">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Sensor Stream
                      </span>
                      <p className="mt-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Connected & Live
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/60 dark:bg-slate-950/40">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Vitals Sync
                      </span>
                      <p className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        HR, SpO₂, Temp
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/60 dark:bg-slate-950/40">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Anomaly Engine
                      </span>
                      <p className="mt-0.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                        Real-time Active
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {/* SECONDARY COLUMN (1 COL): ACCOUNT DETAILS & SECURITY */}
              <div className="space-y-6">
                {/* ACCOUNT CREDENTIALS */}
                <section
                  aria-labelledby="security-heading"
                  className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/90 sm:p-7"
                >
                  <h3
                    id="security-heading"
                    className="text-sm font-bold tracking-tight text-slate-900 dark:text-white"
                  >
                    Account & Credentials
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Security status and session metadata.
                  </p>

                  <div className="mt-5 space-y-3.5 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">
                        Auth Service
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Supabase SSR Auth
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">
                        Account Role
                      </span>
                      <span className="inline-flex items-center rounded-md border border-cyan-500/20 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-950/40 dark:text-cyan-300">
                        Astronaut
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">
                        Commission Date
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {stats.joinedDate || "Active"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">
                        Last Active
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {stats.lastSignIn || "Just now"}
                      </span>
                    </div>
                  </div>

                  {/* PASSWORD RESET LINK */}
                  <div className="mt-5 pt-2">
                    <Link
                      href="/forgot-password"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                        />
                      </svg>
                      <span>Update Password</span>
                    </Link>
                  </div>
                </section>

                {/* TELEMETRY PRIVACY NOTICE */}
                <section
                  aria-labelledby="privacy-heading"
                  className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/90 sm:p-7"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-cyan-600 dark:text-cyan-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h3
                      id="privacy-heading"
                      className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200"
                    >
                      Telemetry Protection
                    </h3>
                  </div>

                  <p className="mt-2.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Your vitals, sleep evaluations, and health deviations are
                    bound to your Astronaut ID and secured via Postgres Row Level
                    Security. Profile modifications synchronize immediately
                    across mission monitoring stations.
                  </p>
                </section>

                {/* LOGOUT SESSION ACTION */}
                <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/90 sm:p-7">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Session Control
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    End your mission control session on this device.
                  </p>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/50"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>
                      {signingOut
                        ? "Terminating Session..."
                        : "Sign Out of Mission Control"}
                    </span>
                  </button>
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
