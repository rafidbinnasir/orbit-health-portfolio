"use client";

import { useEffect, useState } from "react";

export default function SleepCheckIn() {
  const [visible, setVisible] = useState(false);
  const [hours, setHours] = useState("7");
  const [minutes, setMinutes] = useState("0");
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSleepReport() {
      try {
        const response = await fetch("/api/sleep", {
          cache: "no-store",
        });

        if (response.status === 401) return;

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not check sleep status.");
        }

        if (active) {
          setVisible(result.shouldPrompt === true);
        }
      } catch (err) {
        console.error("Sleep check-in lookup failed:", err);
      } finally {
        if (active) setChecking(false);
      }
    }

    checkSleepReport();

    return () => {
      active = false;
    };
  }, []);

  async function submitSleepReport() {
    setError("");

    const sleepMinutes = Number(hours) * 60 + Number(minutes);

    if (!Number.isInteger(sleepMinutes) || sleepMinutes > 1440) {
      setError("Sleep duration cannot exceed 24 hours.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/sleep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sleepMinutes }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setVisible(false);
          return;
        }

        throw new Error(result.error || "Could not save your sleep report.");
      }

      setVisible(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (checking || !visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sleep-checkin-title"
        className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 text-slate-900 shadow-2xl transition-all duration-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-xl text-violet-600 dark:text-violet-400">
            ☾
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              ORBIT HEALTH · Circadian Check-In
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily astronaut recovery log
            </p>
          </div>
        </div>

        <h2
          id="sleep-checkin-title"
          className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white"
        >
          How much have you slept in the last 24 hours?
        </h2>

        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Continuous spaceflight circadian logging helps monitor cognitive fatigue, immune function, and physiological adaptation.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Hours
            <select
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {Array.from({ length: 25 }, (_, index) => (
                <option key={index} value={index}>
                  {index} {index === 1 ? "hour" : "hours"}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Minutes
            <select
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {[0, 15, 30, 45].map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-3.5 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submitSleepReport}
          disabled={saving}
          className="mt-5 w-full cursor-pointer rounded-xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-cyan-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Transmitting Report..." : "Submit Sleep Telemetry"}
        </button>

        <p className="mt-3 text-center text-[10px] text-slate-400 dark:text-slate-500">
          Encrypted and synchronized to your mission telemetry records.
        </p>
      </section>
    </div>
  );
}