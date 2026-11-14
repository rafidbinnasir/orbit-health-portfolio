"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase-browser";

export type AstronautProfileData = {
  full_name: string | null;
  astronaut_id: string | null;
  mission_name: string | null;
  rank?: string | null;
  age?: number | string | null;
  avatar_url: string | null;
};

export type AstronautProfileProps = {
  onRefresh?: () => void;
  avatarUrl?: string | null;
  rankFallback?: string;
  ageFallback?: string;
};

export default function AstronautProfile({
  onRefresh,
  avatarUrl = null,
  rankFallback = "Commander",
  ageFallback = "Classified",
}: AstronautProfileProps) {
  const [profile, setProfile] = useState<AstronautProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUrlState, setAvatarUrlState] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (active) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, astronaut_id, mission_name, avatar_url")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Could not load astronaut profile:", error);
          return;
        }

        if (!active || !data) return;

        const loadedProfile = data as AstronautProfileData;
        setProfile(loadedProfile);

        if (loadedProfile.avatar_url) {
          const { data: signedData, error: signedError } =
            await supabase.storage
              .from("astronaut-avatars")
              .createSignedUrl(loadedProfile.avatar_url, 3600);

          if (!signedError && signedData && active) {
            setAvatarUrlState(signedData.signedUrl);
          } else if (signedError) {
            console.error("Could not load astronaut photo:", signedError);
          }
        }
      } catch (error) {
        console.error("Profile loading failed:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  function handleRefresh() {
    setRefreshing(true);

    if (onRefresh) {
      try {
        onRefresh();
      } finally {
        setTimeout(() => setRefreshing(false), 600);
      }
    } else {
      window.location.reload();
    }
  }

  function handleCopyId(e: React.MouseEvent) {
    e.stopPropagation();
    const id = profile?.astronaut_id?.trim();
    if (id && navigator.clipboard) {
      navigator.clipboard.writeText(id).then(() => {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      });
    }
  }

  const astronautName = profile?.full_name?.trim() || "Commander";
  const astronautId = profile?.astronaut_id?.trim() || "ORB-7749";
  const rank = profile?.rank || rankFallback;
  const age = profile?.age != null ? String(profile.age) : ageFallback;
  const displayedAvatar = avatarUrlState || avatarUrl;

  return (
    <aside
      aria-label="Astronaut identity badge"
      className="group relative flex w-full max-w-md shrink-0 items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40 hover:shadow-md dark:border-slate-800/90 dark:bg-slate-900/90 dark:shadow-none dark:hover:border-slate-700"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {/* AVATAR CONTAINER */}
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-slate-100 to-slate-200 text-cyan-600 shadow-inner dark:border-cyan-500/30 dark:from-cyan-950/40 dark:via-slate-800/80 dark:to-slate-900 dark:text-cyan-400 sm:h-16 sm:w-16">
          {displayedAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayedAvatar}
              alt={`${astronautName}'s profile photo`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-7 w-7 sm:h-8 sm:w-8"
            >
              <path d="M12 3a8 8 0 0 0-8 8v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3a8 8 0 0 0-8-8z" />
              <path d="M8 11a4 4 0 0 1 8 0v1a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1z" />
              <line x1="12" y1="3" x2="12" y2="1" />
              <path d="M7 21a5 5 0 0 1 10 0" />
            </svg>
          )}

          {/* ONLINE TELEMETRY INDICATOR */}
          <span
            className="absolute bottom-1 right-1 flex h-2.5 w-2.5 items-center justify-center"
            title="Biometric telemetry online"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full border border-white bg-emerald-500 dark:border-slate-900" />
          </span>
        </div>

        {/* CREW CREDENTIALS */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300">
              <span className="h-1 w-1 rounded-full bg-cyan-500" />
              {rank}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Age {age}
            </span>
          </div>

          <div className="mt-0.5 min-w-0">
            {loading ? (
              <div className="h-5 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            ) : (
              <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
                {astronautName}
              </p>
            )}
          </div>

          {/* ASTRONAUT ID & COPY BUTTON */}
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              ID:
            </span>
            {loading ? (
              <span className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            ) : (
              <button
                type="button"
                onClick={handleCopyId}
                title="Click to copy astronaut ID"
                className="group/id inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 transition hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400"
              >
                <span>{astronautId}</span>
                <span className="text-[10px] text-slate-400 opacity-60 transition group-hover/id:opacity-100">
                  {copiedId ? "✓" : "📋"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MISSION BADGE / NASA LOGO & REFRESH ACTION */}
      <div className="flex flex-col items-end justify-between self-stretch pl-1">
        <button
          type="button"
          onClick={handleRefresh}
          title="Refresh telemetry profile"
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyan-500" : ""}`}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </button>

        {/* NASA INSIGNIA */}
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nasa.svg"
            alt="NASA Mission Insignia"
            className="h-10 w-10 shrink-0 object-contain opacity-90 drop-shadow-sm transition-opacity group-hover:opacity-100 sm:h-11 sm:w-11"
          />
        </div>
      </div>
    </aside>
  );
}