"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type HealthInsight = {
  id: number;
  rule_key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommended_action: string;
  status: "active" | "acknowledged" | "resolved";
  created_at: string;
};

/**
 * Remove any development "TEST:" prefixes from production-facing alerts.
 */
function cleanAlertText(text: string): string {
  if (!text) return "";
  return text.replace(/^TEST:\s*/i, "").trim();
}

/**
 * Format timestamps safely for client display.
 */
function formatAlertTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Recently";
  }
}

/**
 * Merge newly polled alerts into an existing queue without jarring reorders.
 * Preserves the currently viewed alert at the top of the stack while appending new arrivals.
 */
function mergeQueue(
  existingQueue: HealthInsight[],
  incomingAlerts: HealthInsight[],
  acknowledgedSet: Set<number>
): HealthInsight[] {
  const activeIncoming = incomingAlerts.filter(
    (a) => !acknowledgedSet.has(a.id)
  );

  if (existingQueue.length === 0) {
    return [...activeIncoming].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const incomingMap = new Map(activeIncoming.map((a) => [a.id, a]));

  // Keep existing items that are still active in database
  const preservedExisting = existingQueue
    .filter((a) => incomingMap.has(a.id) && !acknowledgedSet.has(a.id))
    .map((a) => incomingMap.get(a.id)!);

  // Identify new arrivals not previously in the queue
  const existingIdSet = new Set(existingQueue.map((a) => a.id));
  const newArrivals = activeIncoming.filter((a) => !existingIdSet.has(a.id));
  newArrivals.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return [...preservedExisting, ...newArrivals];
}

export default function HealthInsights() {
  const [criticalQueue, setCriticalQueue] = useState<HealthInsight[]>([]);
  const [warningQueue, setWarningQueue] = useState<HealthInsight[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<number>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [queueError, setQueueError] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Mute control state
  const [isMuted, setIsMuted] = useState(false);
  // Autoplay restriction indicator
  const [audioBlocked, setAudioBlocked] = useState(false);

  // Dedicated audio elements for alerts (isolated from background space ambience)
  const criticalAudioRef = useRef<HTMLAudioElement | null>(null);
  const warningAudioRef = useRef<HTMLAudioElement | null>(null);

  // Tracks the ID of the critical alert currently sounding
  const activeCriticalIdRef = useRef<number | null>(null);

  // Tracks whether initial load of insights has completed (avoids playing stale alerts on mount)
  const isFirstLoadRef = useRef<boolean>(true);

  // Tracks IDs of warnings that have already been queued or played
  const playedWarningIdsRef = useRef<Set<number>>(new Set());

  // Sequential queue of warning alert IDs pending sound
  const pendingWarningsQueueRef = useRef<number[]>([]);

  // Tracks whether a warning sound is actively playing
  const isWarningPlayingRef = useRef<boolean>(false);
  const processWarningQueueRef = useRef<() => void>(() => {});

  /**
   * Process warning audio queue sequentially.
   * Warnings only play when no critical alert is active and audio is unmuted.
   */
  const processWarningQueue = useCallback(() => {
    const warningAudio = warningAudioRef.current;
    if (!warningAudio) return;

    if (isMuted) {
      warningAudio.pause();
      warningAudio.currentTime = 0;
      isWarningPlayingRef.current = false;
      return;
    }

    // Critical alerts have strict priority - warnings cannot play if critical alerts are active
    if (criticalQueue.length > 0) {
      warningAudio.pause();
      warningAudio.currentTime = 0;
      isWarningPlayingRef.current = false;
      return;
    }

    if (isWarningPlayingRef.current) return;
    if (pendingWarningsQueueRef.current.length === 0) return;

    isWarningPlayingRef.current = true;
    warningAudio.currentTime = 0;
    warningAudio.loop = false;
    warningAudio.volume = 0.5;

    warningAudio.onended = () => {
      isWarningPlayingRef.current = false;
      // Pop the finished warning
      pendingWarningsQueueRef.current.shift();
      // Play next warning sequentially
      processWarningQueueRef.current();
    };

    const playPromise = warningAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setAudioBlocked(false);
        })
        .catch((err: unknown) => {
          isWarningPlayingRef.current = false;
          setAudioBlocked(true);
          console.warn("Warning alert audio blocked by browser policy:", err);
        });
    }
  }, [criticalQueue.length, isMuted]);

  useEffect(() => {
    processWarningQueueRef.current = processWarningQueue;
  }, [processWarningQueue]);

  /**
   * Load active insights from Supabase API.
   */
  const loadInsights = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch("/api/insights", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to fetch telemetry insights.");
        }

        const result = await response.json();
        const incoming: HealthInsight[] = result.insights ?? [];

        // Partition by severity
        const incomingCriticals = incoming.filter(
          (i) => i.severity === "critical"
        );
        const incomingWarnings = incoming.filter(
          (i) => i.severity === "warning" || i.severity === "info"
        );

        // Sound handling for warnings
        if (isFirstLoadRef.current) {
          // Initial baseline load: mark pre-existing warnings as seen so we don't play stale alerts on mount
          incomingWarnings.forEach((w) => playedWarningIdsRef.current.add(w.id));
          isFirstLoadRef.current = false;
        } else {
          // Subsequent polls: detect genuinely new warnings
          let hasNewWarning = false;
          for (const alert of incomingWarnings) {
            if (
              alert.status === "active" &&
              !acknowledgedIds.has(alert.id) &&
              !playedWarningIdsRef.current.has(alert.id)
            ) {
              playedWarningIdsRef.current.add(alert.id);
              pendingWarningsQueueRef.current.push(alert.id);
              hasNewWarning = true;
            }
          }
          if (hasNewWarning) {
            processWarningQueue();
          }
        }

        setCriticalQueue((prev) =>
          mergeQueue(prev, incomingCriticals, acknowledgedIds)
        );
        setWarningQueue((prev) =>
          mergeQueue(prev, incomingWarnings, acknowledgedIds)
        );
        setSyncError(null);
      } catch {
        setSyncError("Telemetry sync interrupted. Monitoring active locally.");
      } finally {
        setLoading(false);
        if (isManual) {
          setIsRefreshing(false);
        }
      }
    },
    [acknowledgedIds, processWarningQueue]
  );

  useEffect(() => {
    void loadInsights();

    // Auto-poll every 10 seconds
    const interval = setInterval(() => {
      void loadInsights();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadInsights]);

  /**
   * Critical Alert Audio Controller.
   * Manages strict sequential queue: only criticalQueue[0] sounds continuously.
   * Stops immediately on acknowledgment and transitions to the next critical alert.
   */
  const currentCritical = criticalQueue[0];
  const currentCriticalId = currentCritical ? currentCritical.id : null;

  useEffect(() => {
    const criticalAudio = criticalAudioRef.current;
    if (!criticalAudio) return;

    // If muted or no active critical alert in queue
    if (isMuted || currentCriticalId === null) {
      if (activeCriticalIdRef.current !== null) {
        criticalAudio.pause();
        criticalAudio.currentTime = 0;
        activeCriticalIdRef.current = null;
      }
      // If no critical alert is active and unmuted, resume any pending warnings
      if (!isMuted && currentCriticalId === null) {
        processWarningQueue();
      }
      return;
    }

    // Critical alert is active:
    // 1. Immediately pause and reset any playing warning audio (strict priority)
    const warningAudio = warningAudioRef.current;
    if (warningAudio && !warningAudio.paused) {
      warningAudio.pause();
      warningAudio.currentTime = 0;
      isWarningPlayingRef.current = false;
    }

    // 2. If already sounding this exact critical alert, do not restart playback
    if (activeCriticalIdRef.current === currentCriticalId) {
      return;
    }

    // 3. New critical alert is now at the top of the queue: start repeating continuously
    activeCriticalIdRef.current = currentCriticalId;
    criticalAudio.pause();
    criticalAudio.currentTime = 0;
    criticalAudio.loop = true;
    criticalAudio.volume = 0.7;

    const playPromise = criticalAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setAudioBlocked(false);
        })
        .catch((err: unknown) => {
          setAudioBlocked(true);
          console.warn("Critical alert audio blocked by browser policy:", err);
        });
    }
  }, [currentCriticalId, isMuted, processWarningQueue]);

  /**
   * Unlock audio playback if blocked by browser autoplay policy.
   */
  const handleUnlockAudio = useCallback(() => {
    setAudioBlocked(false);
    if (criticalQueue.length > 0 && !isMuted) {
      const audio = criticalAudioRef.current;
      if (audio) {
        audio.loop = true;
        audio.volume = 0.7;
        audio.play().catch(() => setAudioBlocked(true));
      }
    } else if (!isMuted) {
      processWarningQueue();
    }
  }, [criticalQueue.length, isMuted, processWarningQueue]);

  // If audio was blocked by browser policy, unlock automatically on first user gesture
  useEffect(() => {
    if (!audioBlocked) return;

    const onUserInteraction = () => {
      handleUnlockAudio();
    };

    const events: Array<keyof WindowEventMap> = [
      "click",
      "pointerdown",
      "keydown",
    ];

    events.forEach((ev) => {
      window.addEventListener(ev, onUserInteraction, {
        once: true,
        passive: true,
      });
    });

    return () => {
      events.forEach((ev) => {
        window.removeEventListener(ev, onUserInteraction);
      });
    };
  }, [audioBlocked, handleUnlockAudio]);

  // Teardown audio on component unmount
  useEffect(() => {
    return () => {
      if (criticalAudioRef.current) {
        criticalAudioRef.current.pause();
        criticalAudioRef.current.currentTime = 0;
      }
      if (warningAudioRef.current) {
        warningAudioRef.current.pause();
        warningAudioRef.current.currentTime = 0;
      }
    };
  }, []);

  /**
   * Toggle mute state. Muting immediately silences all alert audio without modifying alerts.
   */
  function toggleMute() {
    setIsMuted((prev) => !prev);
  }

  /**
   * Persistent acknowledgment handler.
   */
  async function handleAcknowledge(id: number) {
    if (acknowledgingId !== null) return; // Prevent concurrent requests

    setAcknowledgingId(id);
    setQueueError(null);

    try {
      const response = await fetch(`/api/insights/${id}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Acknowledgment failed. Please retry.");
      }

      // Record acknowledged ID locally to prevent re-adding during polling
      setAcknowledgedIds((prev) => {
        const updated = new Set(prev);
        updated.add(id);
        return updated;
      });

      // Advance each queue independently
      setCriticalQueue((prev) => prev.filter((item) => item.id !== id));
      setWarningQueue((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setQueueError({
        id,
        message:
          err instanceof Error
            ? err.message
            : "Could not acknowledge alert.",
      });
    } finally {
      setAcknowledgingId(null);
    }
  }

  if (loading) {
    return (
      <section
        id="insights"
        aria-label="Health Insights loading"
        className="scroll-mt-24 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90"
      >
        {/* Hidden Audio Elements */}
        <audio
          ref={criticalAudioRef}
          src="/audio/critical-alert.mp3"
          preload="auto"
          aria-hidden="true"
        />
        <audio
          ref={warningAudioRef}
          src="/audio/warning-alert.mp3"
          preload="auto"
          aria-hidden="true"
        />

        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800/60">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
          <div className="h-[350px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/40" />
          <div className="h-[350px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/40" />
        </div>
      </section>
    );
  }

  return (
    <section
      id="insights"
      aria-labelledby="insights-heading"
      className="scroll-mt-24 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/90"
    >
      {/* Hidden Audio Elements */}
      <audio
        ref={criticalAudioRef}
        src="/audio/critical-alert.mp3"
        preload="auto"
        aria-hidden="true"
      />
      <audio
        ref={warningAudioRef}
        src="/audio/warning-alert.mp3"
        preload="auto"
        aria-hidden="true"
      />

      {/* COMPACT SECTION HEADER */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
          </span>

          <h2
            id="insights-heading"
            className="text-sm font-bold tracking-wide text-slate-900 dark:text-white"
          >
            Health Insights
          </h2>

          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            · Mission Alert Queues
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick status counters */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className={`rounded-md px-2 py-0.5 font-semibold transition-colors ${
                criticalQueue.length > 0
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {criticalQueue.length} Critical
            </span>

            <span
              className={`rounded-md px-2 py-0.5 font-semibold transition-colors ${
                warningQueue.length > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {warningQueue.length} Warnings
            </span>
          </div>

          {/* Autoplay restriction warning banner */}
          {audioBlocked && (
            <button
              type="button"
              onClick={handleUnlockAudio}
              title="Browser blocked alert audio autoplay. Click to enable sound."
              aria-label="Browser blocked alert audio autoplay. Click to enable sound."
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-amber-400/80 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 shadow-xs transition hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/80 dark:text-amber-200 animate-pulse"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <span>Enable Sound</span>
            </button>
          )}

          {/* MUTE / UNMUTE BUTTON */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute alert sounds" : "Mute alert sounds"}
            title={
              isMuted
                ? "Alert sounds are muted. Click to unmute."
                : "Alert sounds are active. Click to mute."
            }
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
              isMuted
                ? "border-amber-400/60 bg-amber-500/15 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-300"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-400 hover:bg-cyan-50/60 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300"
            }`}
          >
            {isMuted ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="22" y1="9" x2="16" y2="15" />
                  <line x1="16" y1="9" x2="22" y2="15" />
                </svg>
                <span>Alerts Muted</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400"
                  aria-hidden="true"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                <span>Audio Active</span>
              </>
            )}
          </button>

          {/* SYNC BUTTON */}
          <button
            type="button"
            onClick={() => void loadInsights(true)}
            disabled={isRefreshing}
            aria-label="Synchronize telemetry alerts"
            title="Synchronize telemetry alerts"
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRefreshing ? "animate-spin text-cyan-600 dark:text-cyan-400" : ""}
              aria-hidden="true"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{isRefreshing ? "Syncing..." : "Sync"}</span>
          </button>
        </div>
      </div>

      {syncError && (
        <p
          role="status"
          className="mb-3 text-[11px] text-amber-600 dark:text-amber-400"
        >
          {syncError}
        </p>
      )}

      {/* TWO INDEPENDENT ALERT STACKS WITH GUARANTEED EQUAL & STABLE HEIGHT */}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:gap-5">
        {/* STACK 1: CRITICAL ALERTS */}
        <AlertStack
          type="critical"
          alerts={criticalQueue}
          onAcknowledge={handleAcknowledge}
          acknowledgingId={acknowledgingId}
          queueError={queueError}
        />

        {/* STACK 2: WARNINGS */}
        <AlertStack
          type="warning"
          alerts={warningQueue}
          onAcknowledge={handleAcknowledge}
          acknowledgingId={acknowledgingId}
          queueError={queueError}
        />
      </div>
    </section>
  );
}

/**
 * Fixed-size Stacked-Card Component for an independent Alert Queue.
 *
 * Guarantees:
 * 1. Consistent fixed height (`h-[350px]`) whether 3 alerts, 1 alert, or 0 alerts.
 * 2. Visual stacked card effect behind the top active card.
 * 3. Consistent internal layout: line-clamped text, anchored footer acknowledge button.
 * 4. Polished empty state that fills the exact same reserved area, eliminating layout jumps.
 */
function AlertStack({
  type,
  alerts,
  acknowledgingId,
  onAcknowledge,
  queueError,
}: {
  type: "critical" | "warning";
  alerts: HealthInsight[];
  acknowledgingId: number | null;
  onAcknowledge: (id: number) => void;
  queueError: {
    id: number;
    message: string;
  } | null;
}) {
  const isCritical = type === "critical";
  const currentAlert = alerts[0];
  const nextAlert = alerts[1];
  const thirdAlert = alerts[2];

  // EMPTY STATE: Renders in the EXACT same reserved 350px space to prevent layout shifts.
  if (!currentAlert) {
    return (
      <div
        aria-label={`No active ${isCritical ? "critical alerts" : "warnings"}`}
        className="flex h-[350px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/50 p-6 text-center transition-all duration-200 dark:border-slate-800/80 dark:bg-slate-900/30"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          No active {isCritical ? "critical alerts" : "warnings"}
        </h3>

        <p className="mt-1.5 max-w-[260px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          All monitored telemetry parameters for this queue are operating within nominal limits.
        </p>

        <div className="mt-4 flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Nominal Telemetry</span>
        </div>
      </div>
    );
  }

  const cleanTitle = cleanAlertText(currentAlert.title);
  const cleanDescription = cleanAlertText(currentAlert.description);
  const cleanAction = cleanAlertText(currentAlert.recommended_action);
  const formattedTime = formatAlertTime(currentAlert.created_at);

  return (
    <div className="relative h-[350px] w-full">
      {/* LAYER 2 (Third Alert Preview): Fixed dimensions matching main card */}
      {thirdAlert && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-4 top-4 z-0 h-[330px] rounded-2xl border transition-all duration-300 ${
            isCritical
              ? "border-rose-400/20 bg-rose-100/30 dark:border-rose-900/30 dark:bg-rose-950/20"
              : "border-amber-400/20 bg-amber-100/30 dark:border-amber-900/30 dark:bg-amber-950/20"
          }`}
        />
      )}

      {/* LAYER 1 (Second Alert Preview): Fixed dimensions matching main card */}
      {nextAlert && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-2 top-2 z-10 h-[330px] rounded-2xl border transition-all duration-300 ${
            isCritical
              ? "border-rose-400/30 bg-rose-50/60 shadow-xs dark:border-rose-800/40 dark:bg-rose-950/40"
              : "border-amber-400/30 bg-amber-50/60 shadow-xs dark:border-amber-800/40 dark:bg-amber-950/40"
          }`}
        />
      )}

      {/* MAIN TOP CARD: Fully interactive, fixed height (h-[330px]), fill width */}
      <article
        aria-label={`${currentAlert.severity} alert: ${cleanTitle}`}
        className={`relative z-20 flex h-[330px] w-full flex-col overflow-hidden rounded-2xl border p-4 shadow-md backdrop-blur-md transition-all duration-200 sm:p-5 ${
          isCritical
            ? "border-rose-400/50 bg-gradient-to-b from-rose-50/80 via-white to-rose-50/50 text-slate-900 shadow-rose-500/5 dark:border-rose-500/30 dark:from-rose-950/60 dark:via-slate-900/95 dark:to-slate-950 dark:text-white"
            : "border-amber-400/50 bg-gradient-to-b from-amber-50/80 via-white to-amber-50/50 text-slate-900 shadow-amber-500/5 dark:border-amber-500/30 dark:from-amber-950/60 dark:via-slate-900/95 dark:to-slate-950 dark:text-white"
        }`}
      >
        {/* HEADER: Severity badge, queue position, timestamp */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/5 pb-2.5 dark:border-white/5">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isCritical
                  ? "bg-rose-100 text-rose-800 border border-rose-300 dark:border-rose-800/60 dark:bg-rose-950/80 dark:text-rose-300"
                  : "bg-amber-100 text-amber-800 border border-amber-300 dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isCritical ? "bg-rose-600 animate-pulse" : "bg-amber-600"
                }`}
              />
              {currentAlert.severity}
            </span>

            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {formattedTime}
            </span>
          </div>

          <span className="rounded-md bg-black/5 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            1 of {alerts.length}
          </span>
        </div>

        {/* BODY: Fixed-size content area with line-clamping */}
        <div className="flex min-h-0 flex-1 flex-col justify-start overflow-y-auto overscroll-contain pt-3 pr-1">
          {/* TITLE: Clamped to exactly 1 line with ellipsis */}
          <h3
            title={cleanTitle}
            className="line-clamp-1 shrink-0 text-sm font-bold tracking-tight text-slate-900 sm:text-base dark:text-white"
          >
            {cleanTitle}
          </h3>

          {/* DESCRIPTION: Clamped to maximum 3 lines */}
          <p
            title={cleanDescription}
            className="mt-1.5 whitespace-normal break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300"
          >
            {cleanDescription}
          </p>

          {/* RECOMMENDED ACTION: Clamped to maximum 2 lines inside distinct action pill */}
          {cleanAction && (
            <div
              title={cleanAction}
              className={`mt-2.5 shrink-0 rounded-xl border p-2.5 text-xs leading-snug transition-colors ${
                isCritical
                  ? "border-rose-200/90 bg-rose-100/60 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-200"
                  : "border-amber-200/90 bg-amber-100/60 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200"
              }`}
            >
              <p className="whitespace-normal break-words">
                <span className="font-bold tracking-wide">Recommended action:</span>{" "}
                {cleanAction}
              </p>
            </div>
          )}
        </div>

        {/* FOOTER: Anchored at bottom, error status, acknowledge button */}
        <div className="mt-auto shrink-0 pt-2">
          {queueError && queueError.id === currentAlert.id && (
            <p
              role="alert"
              className="mb-1.5 truncate text-[11px] font-medium text-rose-600 dark:text-rose-400"
            >
              {queueError.message}
            </p>
          )}

          <button
            type="button"
            disabled={acknowledgingId === currentAlert.id}
            onClick={() => onAcknowledge(currentAlert.id)}
            aria-label={`Acknowledge ${cleanTitle}`}
            className={`w-full cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold tracking-wide shadow-xs transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm ${
              isCritical
                ? "bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500"
                : "bg-amber-500 text-slate-950 hover:bg-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400"
            }`}
          >
            {acknowledgingId === currentAlert.id
              ? "Acknowledging..."
              : "Acknowledge Alert"}
          </button>
        </div>
      </article>
    </div>
  );
}
