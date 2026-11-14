"use client";

import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase-browser";
import { useEffect, useRef, useState } from "react";
import VitalCharts from "./components/vitalCharts";
import TypingHeading from "./components/TypingHeading";
import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";
import HealthAssistant from "./components/HealthAssistant";
import HealthInsights from "./components/HealthInsights";
import CompactVitals from "./components/CompactVitals";
import AstronautProfile from "./components/AstronautProfile";
import AnatomicalMonitor from "./components/AnatomicalMonitor";
import SleepCheckIn from "./components/SleepCheckIn";
import MLAnomalyAlerts from "./components/MLAnomalyAlerts";

type VitalReading = {
  id: number;
  heart_rate: number | null;
  spo2: number | null;
  temperature_c: number | null;
  recorded_at: string;
};

export default function Home() {
  const router = useRouter();
  const ambienceRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = ambienceRef.current;
    if (!audio) return;

    let isMounted = true;
    audio.volume = 0.05; // 5% volume
    audio.loop = true; // Nonstop continuous loop

    const removeListeners = () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleInteraction);
      });
    };

    const handleInteraction = () => {
      if (!isMounted) return;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            removeListeners();
          })
          .catch(() => {
            // Still waiting for eligible interaction
          });
      }
    };

    const events: Array<keyof WindowEventMap> = [
      "click",
      "pointerdown",
      "keydown",
      "touchstart",
    ];

    // Attempt immediate automatic playback
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Autoplay permitted immediately
        })
        .catch(() => {
          // If browser policy restricts unmuted autoplay until user gesture,
          // automatically start on the very first user interaction anywhere
          events.forEach((event) => {
            window.addEventListener(event, handleInteraction, {
              passive: true,
            });
          });
        });
    }

    return () => {
      isMounted = false;
      removeListeners();
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  const [readings, setReadings] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authChecking, setAuthChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function checkUserRole() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isActive) return;

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!isActive) return;

      if (roleError || !roleData) {
        router.replace("/login");
        return;
      }

      if (roleData.role === "admin") {
        router.replace("/admin");
        return;
      }

      setAuthChecking(false);
    }

    checkUserRole();

    return () => {
      isActive = false;
    };
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed:", error.message);
      setError("Unable to sign out. Please try again.");
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  useEffect(() => {
    let isActive = true;

    async function fetchReadings() {
      try {
        const response = await fetch("/api/vitals", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load vital readings.");
        }

        const data = await response.json();

        if (isActive) {
          setReadings(data.readings ?? []);
          setError("");
        }
      } catch {
        if (isActive) {
          setError("Unable to load readings. Please try again.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchReadings();

    const intervalId = window.setInterval(() => {
      fetchReadings();
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-cyan-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm font-semibold tracking-wider">
            Verifying your mission access...
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <SleepCheckIn />
      <main className="min-h-screen bg-slate-50/50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
        <audio
          ref={ambienceRef}
          src="/space-ambience.mp3"
          loop
          preload="auto"
          aria-hidden="true"
        />

        {/* TOP EXECUTIVE NAVIGATION */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            {/* BRANDING */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="group flex items-center gap-3 transition-opacity hover:opacity-90"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 transition-colors group-hover:bg-cyan-500/20 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300">
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
                  <div className="flex items-center gap-2">
                    <span className="font-bold tracking-tight text-slate-900 dark:text-white">
                      ORBIT Health
                    </span>
                    <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 sm:inline-flex">
                      Telemetry Sync
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold tracking-widest text-cyan-600 dark:text-cyan-400">
                    MISSION CONTROL · BIO-TELEMETRY
                  </p>
                </div>
              </Link>
            </div>

            {/* DESKTOP NAVIGATION LINKS */}
            <nav
              aria-label="Astronaut Navigation"
              className="hidden items-center gap-1.5 md:flex"
            >
              <a
                href="#dashboard"
                className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200"
              >
                Overview
              </a>

              <a
                href="#telemetry"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Telemetry
              </a>

              <a
                href="#anatomy"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                3D Anatomy
              </a>

              <a
                href="#readings"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Records
              </a>

              <a
                href="#charts"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Analytics
              </a>

              <Link
                href="/profile"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Profile
              </Link>
            </nav>

            {/* ACTION CONTROLS & THEME */}
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />

              <button
                type="button"
                onClick={handleSignOut}
                className="hidden cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 sm:inline-flex"
              >
                Sign out
              </button>

              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle mobile navigation menu"
                aria-expanded={mobileMenuOpen}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 dark:border-slate-800 dark:text-slate-300 md:hidden"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {mobileMenuOpen ? (
                    <>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </>
                  ) : (
                    <>
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* MOBILE NAV DRAWER */}
          {mobileMenuOpen && (
            <div className="border-t border-slate-200 bg-white/95 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
              <div className="flex flex-col gap-2">
                <a
                  href="#dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300"
                >
                  Overview
                </a>
                <a
                  href="#telemetry"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Telemetry & Alerts
                </a>
                <a
                  href="#anatomy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  3D Anatomy
                </a>
                <a
                  href="#readings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Records
                </a>
                <a
                  href="#charts"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Analytics
                </a>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Astronaut Profile
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="mt-1 w-full rounded-lg border border-rose-300/60 bg-rose-50 px-3 py-2 text-left text-xs font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </header>

        {/* DASHBOARD CONTENT BODY */}
        <div
          id="dashboard"
          className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          {/* DASHBOARD BRIEFING & ASTRONAUT IDENTITY HEADER */}
          <header className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">

              <div className="mt-2">
                <TypingHeading />
              </div>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Continuous biometric surveillance, clinical insights, and telemetry diagnostics.
              </p>
            </div>

            {/* ASTRONAUT IDENTITY TILE */}
            <div className="shrink-0">
              <AstronautProfile />
            </div>
          </header>

          {/* SYSTEM ERROR NOTIFICATION */}
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200"
              >
                ✕
              </button>
            </div>
          )}

          {/* PRIMARY MISSION TELEMETRY GRID: HEALTH INSIGHTS & COMPACT VITALS */}
          <section
            id="telemetry"
            className="mb-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3"
          >
            <div className="min-w-0 lg:col-span-2">
              <HealthInsights />
            </div>

            <div className="min-w-0 lg:col-span-1">
              <CompactVitals readings={readings} loading={loading} />
            </div>
          </section>

          {/* HEALTH EVENTS WORTH REVIEWING (ISOLATION FOREST PREDICTIONS) */}
          <section className="mb-8">
            <MLAnomalyAlerts />
          </section>

          {/* 3D ANATOMICAL TELEMETRY MONITOR */}
          <section id="anatomy" className="mb-8 scroll-mt-20">
            <AnatomicalMonitor readings={readings} loading={loading} />
          </section>

          {loading ? (
            <div
              className="rounded-2xl border border-slate-200/90 bg-white p-10 text-center text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
              role="status"
            >
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <p className="mt-3 text-xs font-medium">
                Synchronizing recorded vital history...
              </p>
            </div>
          ) : (
            <>
              {/* RECENT BIOMETRIC RECORDS TABLE */}
              <section
                id="readings"
                className="mb-8 scroll-mt-20 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-all sm:p-7 dark:border-slate-800 dark:bg-slate-900/90"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800/70">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2" aria-hidden="true">
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                      </span>
                      <p className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                        Clinical Logs
                      </p>
                    </div>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Recent Biometric Readings
                    </h2>
                  </div>

                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                    {readings.length} records logged
                  </span>
                </div>

                {readings.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center dark:border-slate-800">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      No Readings Logged Yet
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Your recorded vital signs will stream automatically into this registry.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-xs sm:text-sm">
                      <thead className="border-b border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-500">
                        <tr>
                          <th className="py-3 pr-4 font-semibold uppercase tracking-wider text-[11px]">
                            Recorded At (Local)
                          </th>
                          <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">
                            Heart Rate
                          </th>
                          <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">
                            Blood Oxygen (SpO₂)
                          </th>
                          <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">
                            Core Temperature
                          </th>
                          <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px] text-right">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {readings.map((reading) => {
                          const isNominalHR =
                            reading.heart_rate != null &&
                            reading.heart_rate >= 60 &&
                            reading.heart_rate <= 100;
                          const isNominalSpO2 =
                            reading.spo2 != null && reading.spo2 >= 95;
                          const isNominalTemp =
                            reading.temperature_c != null &&
                            reading.temperature_c >= 36.5 &&
                            reading.temperature_c <= 37.5;
                          const allNominal =
                            isNominalHR && isNominalSpO2 && isNominalTemp;

                          return (
                            <tr
                              key={reading.id}
                              className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                            >
                              <td className="py-3.5 pr-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                {new Date(reading.recorded_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </td>

                              <td className="px-4 py-3.5 font-mono font-semibold text-slate-900 dark:text-white">
                                {reading.heart_rate != null ? (
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        isNominalHR
                                          ? "bg-rose-500"
                                          : "bg-rose-600 animate-pulse"
                                      }`}
                                    />
                                    {reading.heart_rate}{" "}
                                    <span className="text-[11px] font-normal text-slate-400">
                                      BPM
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="px-4 py-3.5 font-mono font-semibold text-slate-900 dark:text-white">
                                {reading.spo2 != null ? (
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        isNominalSpO2
                                          ? "bg-cyan-500"
                                          : "bg-amber-500 animate-pulse"
                                      }`}
                                    />
                                    {reading.spo2}
                                    <span className="text-[11px] font-normal text-slate-400">
                                      %
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="px-4 py-3.5 font-mono font-semibold text-slate-900 dark:text-white">
                                {reading.temperature_c != null ? (
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${
                                        isNominalTemp
                                          ? "bg-amber-500"
                                          : "bg-rose-500 animate-pulse"
                                      }`}
                                    />
                                    {reading.temperature_c}
                                    <span className="text-[11px] font-normal text-slate-400">
                                      °C
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="px-4 py-3.5 text-right">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                    allNominal
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                  }`}
                                >
                                  {allNominal ? "Nominal" : "Deviation"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* VITAL ANALYTICS & CHARTS */}
              <section id="charts" className="mb-10 scroll-mt-20">
                <VitalCharts readings={readings} />
              </section>

              {/* MISSION FOOTER */}
              <footer className="mt-12 border-t border-slate-200/80 pt-6 pb-12 dark:border-slate-800">
                <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      ORBIT Health · Astronaut Mission Telemetry System
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      Encrypted astronaut biometrics. Displayed readings do not replace direct Flight Surgeon assessment.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Encrypted SSL / RLS Active
                    </span>
                    <span>·</span>
                    <Link
                      href="/profile"
                      className="transition hover:text-cyan-600 dark:hover:text-cyan-400"
                    >
                      Astronaut Settings
                    </Link>
                  </div>
                </div>
              </footer>
            </>
          )}
        </div>

        {/* FLOATING HEALTH ASSISTANT */}
        <HealthAssistant />
      </main>
    </>
  );
}