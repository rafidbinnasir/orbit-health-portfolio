"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
useEffect(() => {
  async function verifyRecoverySession() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      setMessage(
        "Your password reset session is invalid or has expired. Please request a new reset link."
      );
    }
  }

  verifyRecoverySession();
}, []);
  async function handlePasswordUpdate(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (password.length < 8) {
      setMessage("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

const { data: sessionData, error: sessionError } =
  await supabase.auth.getSession();

if (sessionError || !sessionData.session) {
  throw new Error(
    "Your password reset session is invalid or has expired. Please request a new reset link."
  );
}

const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      setSuccess(true);
      setMessage("Your password has been updated successfully. Redirecting to login...");

      setPassword("");
      setConfirmPassword("");

      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 2000);
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Unable to update your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-white sm:px-6">
      {/* BACKGROUND VIDEO */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 z-0 h-full w-full object-cover"
      >
        <source src="/4-135665514.mp4" type="video/mp4" />
      </video>

      {/* AMBIENT OVERLAY */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-slate-950/60 backdrop-blur-xs" />

      {/* AUTH CARD */}
      <section className="relative z-20 w-full max-w-md rounded-2xl border border-slate-800/90 bg-slate-900/85 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              ORBIT HEALTH
            </p>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Set New Password
            </h1>
          </div>
        </div>

        <p className="mb-6 text-xs leading-relaxed text-slate-400">
          Enter a secure password for your astronaut profile. Minimum 8 characters.
        </p>

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              New Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              placeholder="Re-enter password"
            />
          </div>

          {message && (
            <div
              role={success ? "status" : "alert"}
              aria-live="polite"
              className={`rounded-xl border p-3 text-xs font-medium ${
                success
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
                  : "border-rose-500/30 bg-rose-950/40 text-rose-300"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-cyan-500 py-3 text-sm font-bold text-slate-950 shadow-md transition hover:bg-cyan-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                <span>Updating Security Credentials...</span>
              </span>
            ) : (
              "Update Mission Password"
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
          <p className="text-xs text-slate-400">
            Remembered your credentials?{" "}
            <Link
              href="/login"
              className="font-semibold text-cyan-400 transition hover:text-cyan-300 hover:underline"
            >
              Back to Sign In
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}