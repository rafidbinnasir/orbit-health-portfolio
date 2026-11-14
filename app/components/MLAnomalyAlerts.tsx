"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

type VitalReadingData = {
  heart_rate: number | null;
  spo2: number | null;
  temperature_c: number | null;
};

type MLPrediction = {
  id: number;
  reading_id: number;
  status: string;
  anomaly_score: number;
  created_at: string;
  vital_readings: VitalReadingData | VitalReadingData[] | null;
};

function formatEventTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently";
  }
}

export default function MLAnomalyAlerts() {
  const [predictions, setPredictions] = useState<MLPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function fetchPredictions() {
      try {
        const supabase = createClient();

        const { data, error: queryError } = await supabase
          .from("ml_predictions")
          .select(`
            id,
            reading_id,
            status,
            anomaly_score,
            created_at,
            vital_readings (
              heart_rate,
              spo2,
              temperature_c
            )
          `)
          .eq("status", "ANOMALY")
          .order("created_at", { ascending: false })
          .limit(3);

        if (!isActive) return;

        if (queryError) {
          setError(queryError.message);
          return;
        }

        setPredictions((data as MLPrediction[]) ?? []);
        setError("");
      } catch (err) {
        if (!isActive) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load reviewed health telemetry."
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchPredictions();

    const intervalId = window.setInterval(fetchPredictions, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section
      aria-labelledby="health-events-heading"
      className="flex flex-col rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-colors duration-200 sm:p-6 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none"
    >
      {/* SECTION HEADER */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>

            <h2
              id="health-events-heading"
              className="text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white"
            >
              Health Events Worth Reviewing
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Unusual readings identified for further review.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {predictions.length}{" "}
            {predictions.length === 1 ? "Event" : "Events"} Logged
          </span>
        </div>
      </div>

      {/* BODY CONTENT */}
      {loading ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-800"
        >
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            Checking telemetry records...
          </p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {error}
        </div>
      ) : predictions.length === 0 ? (
        /* EMPTY STATE */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-950/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
            <svg
              className="h-5 w-5"
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
          </div>

          <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
            All Telemetry Stable
          </h3>

          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            No unusual vital patterns recorded recently. Continuous biometric
            trend monitoring remains active.
          </p>
        </div>
      ) : (
        /* RESPONSIVE EVENT CARDS GRID */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {predictions.map((item) => {
            const reading = Array.isArray(item.vital_readings)
              ? item.vital_readings[0]
              : item.vital_readings;

            // Restrained clinical flags for visual clarity
            const isHrElevated =
              reading?.heart_rate !== null &&
              reading?.heart_rate !== undefined &&
              (reading.heart_rate > 100 || reading.heart_rate < 60);

            const isSpo2Low =
              reading?.spo2 !== null &&
              reading?.spo2 !== undefined &&
              reading.spo2 < 95;

            const isTempAbnormal =
              reading?.temperature_c !== null &&
              reading?.temperature_c !== undefined &&
              (reading.temperature_c > 37.5 || reading.temperature_c < 36.0);

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-xs dark:border-slate-800/90 dark:bg-slate-950/40 dark:hover:border-slate-700/80"
              >
                {/* CARD HEADER */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Unusual Reading
                    </span>

                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      #{item.reading_id}
                    </span>
                  </div>

                  <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    Logged: {formatEventTimestamp(item.created_at)}
                  </p>
                </div>

                {/* METRICS 3-COLUMN TILES */}
                <div className="my-4 grid grid-cols-3 gap-2">
                  {/* HEART RATE */}
                  <div
                    className={`rounded-lg border p-2 text-center transition-colors ${
                      isHrElevated
                        ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-950/20"
                        : "border-slate-200/80 bg-white dark:border-slate-800/60 dark:bg-slate-900/60"
                    }`}
                  >
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Heart Rate
                    </span>
                    <span
                      className={`mt-0.5 block text-base font-bold font-mono tracking-tight ${
                        isHrElevated
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {reading?.heart_rate ?? "—"}
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      bpm
                    </span>
                  </div>

                  {/* BLOOD OXYGEN (SpO2) */}
                  <div
                    className={`rounded-lg border p-2 text-center transition-colors ${
                      isSpo2Low
                        ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-950/20"
                        : "border-slate-200/80 bg-white dark:border-slate-800/60 dark:bg-slate-900/60"
                    }`}
                  >
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      SpO₂
                    </span>
                    <span
                      className={`mt-0.5 block text-base font-bold font-mono tracking-tight ${
                        isSpo2Low
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {reading?.spo2 ?? "—"}
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      %
                    </span>
                  </div>

                  {/* TEMPERATURE */}
                  <div
                    className={`rounded-lg border p-2 text-center transition-colors ${
                      isTempAbnormal
                        ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-950/20"
                        : "border-slate-200/80 bg-white dark:border-slate-800/60 dark:bg-slate-900/60"
                    }`}
                  >
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Temp
                    </span>
                    <span
                      className={`mt-0.5 block text-base font-bold font-mono tracking-tight ${
                        isTempAbnormal
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {reading?.temperature_c !== null &&
                      reading?.temperature_c !== undefined
                        ? reading.temperature_c
                        : "—"}
                    </span>
                    <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                      °C
                    </span>
                  </div>
                </div>

                {/* CARD FOOTER */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400 dark:border-slate-800/60 dark:text-slate-500">
                  <span>Deviation Metric</span>
                  <span className="font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {item.anomaly_score.toFixed(4)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* CLINICAL AWARENESS FOOTER */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-slate-800/60 dark:text-slate-500">
        <span>Identified for secondary clinical assessment.</span>
        <span>Auto-sync every 5s</span>
      </div>
    </section>
  );
}
