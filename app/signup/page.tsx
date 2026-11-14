"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
          },
        },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("already registered") ||
          error.message.toLowerCase().includes("already exists")
        ) {
          setMessage(
            "An account with this email may already exist. Please sign in or reset your password."
          );
        } else {
          setMessage(error.message);
        }
        return;
      }

      if (data.user && data.user.identities?.length === 0) {
        setMessage(
          "An account with this email may already exist. Please sign in or reset your password."
        );
        return;
      }

      if (data.user && data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      setMessage(
        "Account created! Check your email to confirm your account, then sign in."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
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
        <source src="/189457-885804464.mp4" type="video/mp4" />
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
              Create Crew Account
            </h1>
          </div>
        </div>

        <p className="mb-6 text-xs leading-relaxed text-slate-400">
          Register your astronaut identity to access telemetry surveillance, personalized vitals insights, and mission medical records.
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              Full Legal Name
            </label>
            <input
              id="name"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              placeholder="Dr. Eleanor Vance"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              placeholder="vance@mission.orbit"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              Password (min. 8 characters)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              placeholder="••••••••••••"
            />
          </div>

          {message && (
            <div
              role="alert"
              className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-3 text-xs font-medium text-cyan-200"
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
                <span>Registering Crew Account...</span>
              </span>
            ) : (
              "Initialize Astronaut Account"
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
          <p className="text-xs text-slate-400">
            Already commissioned?{" "}
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