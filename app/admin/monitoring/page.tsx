"use client";

import { useEffect, useState, useMemo,Suspense  } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "../AdminShell";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type AstronautSummary = {
  id: string;
  email: string;
  fullName: string;
  astronautId: string;
  missionName: string;
  avatarUrl: string | null;
  role: string;
  telemetryStatus: "live" | "outdated" | "none";
  latestReading: {
    id: number;
    heart_rate: number | null;
    spo2: number | null;
    temperature_c: number | null;
    recorded_at: string;
  } | null;
  totalReadings: number;
  activeAlertsCount: number;
  criticalAlertsCount: number;
  warningAlertsCount: number;
};

type AstronautDetail = {
  id: string;
  email: string;
  fullName: string;
  astronautId: string;
  missionName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  readings: Array<{
    id: number;
    heart_rate: number | null;
    spo2: number | null;
    temperature_c: number | null;
    recorded_at: string;
  }>;
  insights: Array<{
    id: number;
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    recommended_action: string;
    status: string;
    created_at: string;
    evidence: Record<string, any>;
  }>;
  sleepReports: Array<{
    id: string;
    sleep_minutes: number;
    submitted_at: string;
  }>;
};

function AdminMonitoringContent() {
  const searchParams = useSearchParams();
  const initialSelected = searchParams.get("astronautId");

  const [astronauts, setAstronauts] = useState<AstronautSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);
  const [selectedDetail, setSelectedDetail] = useState<AstronautDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "outdated" | "none">("all");

  async function loadDirectory() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/monitoring", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load astronaut monitoring directory");
      const json = await res.json();
      setAstronauts(json.astronauts || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching astronauts");
    } finally {
      setLoading(false);
    }
  }

  async function loadAstronautDetail(id: string) {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/admin/monitoring?astronautId=${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load astronaut details");
      const json = await res.json();
      setSelectedDetail(json.selectedDetail || null);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadDirectory();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadAstronautDetail(selectedId);
    } else {
      setSelectedDetail(null);
    }
  }, [selectedId]);

  const filteredAstronauts = useMemo(() => {
    return astronauts.filter((a) => {
      const matchesSearch =
        a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.astronautId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || a.telemetryStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [astronauts, searchQuery, statusFilter]);

  // Chart data for selected astronaut
  const chartData = useMemo(() => {
    if (!selectedDetail?.readings) return [];
    return [...selectedDetail.readings]
      .reverse()
      .map((r) => ({
        time: new Date(r.recorded_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        heartRate: r.heart_rate,
        spo2: r.spo2,
        temperature: r.temperature_c,
      }));
  }, [selectedDetail?.readings]);

  return (
    <AdminShell
      activeSection="monitoring"
      title="Astronaut Telemetry Monitoring Center"
      headerActions={
        <button
          type="button"
          onClick={() => {
            loadDirectory();
            if (selectedId) loadAstronautDetail(selectedId);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 transition"
        >
          ↻ Refresh Fleet
        </button>
      }
    >
      <div className="space-y-8">
        {/* TOP STATUS FILTER & SEARCH */}
        <div className="rounded-2xl border border-white/10 bg-[#0A1222] p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative min-w-[260px] flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search astronaut name, ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#070C18] px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Telemetry State:
              </span>
              <div className="flex rounded-xl border border-white/10 bg-[#070C18] p-1 text-xs">
                {(["all", "live", "outdated", "none"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`cursor-pointer rounded-lg px-3 py-1 font-semibold capitalize transition ${
                      statusFilter === st
                        ? "bg-cyan-400 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {st === "all"
                      ? "All Fleet"
                      : st === "live"
                      ? "Live Sync"
                      : st === "outdated"
                      ? "Outdated (>24h)"
                      : "No Records"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* MAIN SPLIT: ASTRONAUT DIRECTORY & DETAIL INSPECTOR */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* DIRECTORY LIST (5 or 12 COLS) */}
          <div className={`${selectedDetail ? "lg:col-span-5" : "lg:col-span-12"} space-y-4`}>
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-400">
                Monitored Crew ({filteredAstronauts.length})
              </h3>
              {selectedId && (
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-xs text-cyan-400 hover:underline"
                >
                  Collapse Detail View
                </button>
              )}
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-[#0A1222] p-8 text-center text-cyan-400">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                <p className="mt-3 text-xs text-slate-400">Loading crew telemetry status...</p>
              </div>
            ) : filteredAstronauts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400 text-xs">
                No astronauts found matching filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAstronauts.map((astro) => {
                  const isSelected = selectedId === astro.id;
                  const hasLive = astro.telemetryStatus === "live";
                  const isOutdated = astro.telemetryStatus === "outdated";

                  return (
                    <div
                      key={astro.id}
                      onClick={() => setSelectedId(astro.id)}
                      className={`cursor-pointer rounded-2xl border p-4 transition duration-150 ${
                        isSelected
                          ? "border-cyan-400 bg-[#0E1A33] shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/50"
                          : "border-white/10 bg-[#0A1222] hover:border-white/20 hover:bg-[#0D1628]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 font-bold text-cyan-300 text-xs">
                            {astro.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white text-sm">
                                {astro.fullName}
                              </p>
                              {astro.role === "admin" && (
                                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300 uppercase">
                                  Admin
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-cyan-400">
                              {astro.astronautId} · <span className="text-slate-500">{astro.email}</span>
                            </p>
                          </div>
                        </div>

                        {/* STATUS PILL */}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                            hasLive
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                              : isOutdated
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                              : "border-slate-700 bg-slate-800 text-slate-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              hasLive
                                ? "bg-emerald-400 animate-pulse"
                                : isOutdated
                                ? "bg-amber-400"
                                : "bg-slate-500"
                            }`}
                          />
                          {hasLive ? "Live" : isOutdated ? "Outdated" : "No Data"}
                        </span>
                      </div>

                      {/* VITALS SNAPSHOT */}
                      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs">
                        {astro.latestReading ? (
                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="text-rose-300">
                              ❤️ {astro.latestReading.heart_rate ?? "—"} BPM
                            </span>
                            <span className="text-cyan-300">
                              🫁 {astro.latestReading.spo2 ?? "—"}%
                            </span>
                            <span className="text-amber-300">
                              🌡️ {astro.latestReading.temperature_c ?? "—"}°C
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            No biometric readings recorded on this unit
                          </span>
                        )}

                        {astro.criticalAlertsCount > 0 ? (
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/40">
                            {astro.criticalAlertsCount} Critical Alert
                          </span>
                        ) : astro.warningAlertsCount > 0 ? (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                            {astro.warningAlertsCount} Warning
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">0 alerts</span>
                        )}
                      </div>

                      {astro.latestReading?.recorded_at && (
                        <p className="mt-1 text-[10px] text-slate-500">
                          Last sync: {new Date(astro.latestReading.recorded_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DETAILED ASTRONAUT TELEMETRY PANEL (7 COLS) */}
          {selectedDetail && (
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-3xl border border-cyan-400/30 bg-[#0A1222] p-6 sm:p-7 shadow-2xl">
                {/* HEADER */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-400/10 font-bold text-cyan-300 text-lg shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                      {selectedDetail.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white sm:text-xl">
                        {selectedDetail.fullName}
                      </h3>
                      <p className="font-mono text-xs text-cyan-400">
                        {selectedDetail.astronautId} · <span className="text-slate-400">{selectedDetail.email}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedId(null)}
                    className="rounded-xl border border-white/10 p-2 text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {detailLoading ? (
                  <div className="py-12 text-center text-cyan-400">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    <p className="mt-3 text-xs text-slate-400">Loading biometrics feed...</p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-6">
                    {/* VITALS CHART */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Telemetry Chronology (Recent Readings)
                      </h4>
                      {chartData.length === 0 ? (
                        <div className="rounded-2xl border border-white/5 bg-[#070C18] p-6 text-center text-xs text-slate-500">
                          No historical vital sign readings to chart.
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-[#070C18] p-4">
                          <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis
                                  dataKey="time"
                                  stroke="#64748b"
                                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                                />
                                <YAxis
                                  stroke="#64748b"
                                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#0B1324",
                                    borderColor: "#334155",
                                    borderRadius: "0.75rem",
                                    color: "#fff",
                                    fontSize: "11px",
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="heartRate"
                                  name="Heart Rate"
                                  stroke="#fb7185"
                                  strokeWidth={2}
                                  dot={{ r: 2.5 }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="spo2"
                                  name="SpO₂"
                                  stroke="#22d3ee"
                                  strokeWidth={2}
                                  dot={{ r: 2.5 }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="temperature"
                                  name="Temp"
                                  stroke="#fbbf24"
                                  strokeWidth={2}
                                  dot={{ r: 2.5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ALERTS FOR THIS ASTRONAUT */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Recorded Health Alerts ({selectedDetail.insights.length})
                      </h4>
                      {selectedDetail.insights.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          No active or past health alerts recorded for this astronaut.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {selectedDetail.insights.slice(0, 5).map((ins) => (
                            <div
                              key={ins.id}
                              className="rounded-xl border border-white/10 bg-[#070C18] p-3 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                    ins.severity === "critical"
                                      ? "bg-rose-500 text-white"
                                      : ins.severity === "warning"
                                      ? "bg-amber-500 text-slate-950"
                                      : "bg-cyan-500 text-slate-950"
                                  }`}
                                >
                                  {ins.severity}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(ins.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="mt-1 font-bold text-white">{ins.title}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {ins.recommended_action || ins.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RECENT READINGS TABLE */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Recent Vital Readings ({selectedDetail.readings.length})
                      </h4>
                      {selectedDetail.readings.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          No individual readings recorded yet.
                        </p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#070C18]">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="border-b border-white/10 text-[10px] uppercase font-bold text-slate-400 sticky top-0 bg-[#070C18]">
                              <tr>
                                <th className="py-2 px-3">Recorded At</th>
                                <th className="py-2 px-3">Heart Rate</th>
                                <th className="py-2 px-3">SpO₂</th>
                                <th className="py-2 px-3">Temperature</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                              {selectedDetail.readings.slice(0, 15).map((r) => (
                                <tr key={r.id}>
                                  <td className="py-2 px-3 text-slate-400 font-sans">
                                    {new Date(r.recorded_at).toLocaleString()}
                                  </td>
                                  <td className="py-2 px-3 text-rose-300">
                                    {r.heart_rate ?? "—"} BPM
                                  </td>
                                  <td className="py-2 px-3 text-cyan-300">
                                    {r.spo2 ?? "—"}%
                                  </td>
                                  <td className="py-2 px-3 text-amber-300">
                                    {r.temperature_c ?? "—"}°C
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

export default function AdminMonitoringPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-cyan-400">
          Loading monitoring center...
        </div>
      }
    >
      <AdminMonitoringContent />
    </Suspense>
  );
}
