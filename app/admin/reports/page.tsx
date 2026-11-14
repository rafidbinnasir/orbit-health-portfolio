"use client";

import { useEffect, useState, useMemo } from "react";
import AdminShell from "../AdminShell";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

type VitalDataPoint = {
  id: number;
  userId: string;
  astronautName: string;
  recordedAt: string;
  timeFormatted: string;
  heartRate: number | null;
  spo2: number | null;
  temperature: number | null;
};

type SleepDataPoint = {
  id: string;
  userId: string;
  astronautName: string;
  submittedAt: string;
  dateFormatted: string;
  sleepMinutes: number;
  sleepHours: number;
};

type ReportsResponse = {
  aggregates: {
    readingsCount: number;
    sleepReportsCount: number;
    alertsCount: number;
    avgHeartRate: number | null;
    minHeartRate: number | null;
    maxHeartRate: number | null;
    avgSpO2: number | null;
    minSpO2: number | null;
    maxSpO2: number | null;
    avgTemperature: number | null;
    minTemperature: number | null;
    maxTemperature: number | null;
    avgSleepHours: number | null;
  };
  severityCount: {
    critical: number;
    warning: number;
    info: number;
  };
  ruleBreakdown: Record<string, number>;
  vitalsSeries: VitalDataPoint[];
  sleepSeries: SleepDataPoint[];
  recentAlerts: Array<{
    id: number;
    title: string;
    severity: string;
    rule_key: string;
    created_at: string;
    astronautName: string;
  }>;
  astronautsList: Array<{
    id: string;
    name: string;
    astronautId: string;
    email: string;
  }>;
};

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [selectedAstronaut, setSelectedAstronaut] = useState<string>("all");

  async function fetchReports() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("timeRange", timeRange);
      if (selectedAstronaut !== "all") params.set("astronautId", selectedAstronaut);

      const res = await fetch(`/api/admin/reports?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load reports (HTTP ${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, [timeRange, selectedAstronaut]);

  const anomalyDistribution = useMemo(() => {
    if (!data?.severityCount) return [];
    return [
      { name: "Critical", count: data.severityCount.critical, fill: "#f43f5e" },
      { name: "Warning", count: data.severityCount.warning, fill: "#f59e0b" },
      { name: "Info", count: data.severityCount.info, fill: "#06b6d4" },
    ];
  }, [data?.severityCount]);

  const tooltipStyle = {
    backgroundColor: "#0B1324",
    borderColor: "#334155",
    borderRadius: "0.75rem",
    color: "#fff",
    fontSize: "12px",
  };

  return (
    <AdminShell
      activeSection="reports"
      title="Mission Health Reports & Telemetry Analytics"
      headerActions={
        <div className="flex items-center gap-2">
          {/* ASTRONAUT DROPDOWN FILTER */}
          <select
            value={selectedAstronaut}
            onChange={(e) => setSelectedAstronaut(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#070C18] px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
          >
            <option value="all">All Monitored Crew</option>
            {data?.astronautsList?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.astronautId})
              </option>
            ))}
          </select>

          {/* TIME RANGE SELECTOR */}
          <div className="flex rounded-xl border border-white/10 bg-[#070C18] p-1 text-xs">
            {(["24h", "7d", "30d", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 font-semibold uppercase transition ${
                  timeRange === range
                    ? "bg-cyan-400 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* METRICS AGGREGATION CARDS */}
        {data && (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-2xl border border-rose-500/20 bg-[#0A1222] p-4">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Heart Rate Range
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-400 sm:text-3xl">
                  {data.aggregates.avgHeartRate ?? "—"}
                </span>
                <span className="text-xs text-slate-400">BPM avg</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Min {data.aggregates.minHeartRate ?? "—"} · Max {data.aggregates.maxHeartRate ?? "—"} BPM
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-[#0A1222] p-4">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Oxygen Saturation (SpO₂)
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-300 sm:text-3xl">
                  {data.aggregates.avgSpO2 ? `${data.aggregates.avgSpO2}%` : "—"}
                </span>
                <span className="text-xs text-slate-400">avg</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Min {data.aggregates.minSpO2 ?? "—"}% · Max {data.aggregates.maxSpO2 ?? "—"}%
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-[#0A1222] p-4">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Core Body Temperature
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-300 sm:text-3xl">
                  {data.aggregates.avgTemperature ? `${data.aggregates.avgTemperature}°C` : "—"}
                </span>
                <span className="text-xs text-slate-400">avg</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Min {data.aggregates.minTemperature ?? "—"}°C · Max {data.aggregates.maxTemperature ?? "—"}°C
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-400/20 bg-[#0A1222] p-4">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Rest & Sleep Duration
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-300 sm:text-3xl">
                  {data.aggregates.avgSleepHours ? `${data.aggregates.avgSleepHours}h` : "—"}
                </span>
                <span className="text-xs text-slate-400">avg sleep</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {data.aggregates.sleepReportsCount} sleep check-in records
              </p>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-3xl border border-white/10 bg-[#0A1222] p-12 text-center text-cyan-400">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="mt-4 text-xs font-semibold tracking-widest text-slate-400">
              COMPUTING MULTI-ASTRONAUT TELEMETRY ANALYTICS...
            </p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* 1. HEART RATE OVER TIME */}
            <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 sm:p-7 shadow-xl">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Cardiac Chronology & Heart Rate Trends
                  </h3>
                  <p className="text-xs text-slate-400">
                    Continuous BPM records with clinical nominal threshold lines (60 – 100 BPM).
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-[#fb7185]">● Heart Rate (BPM)</span>
                  <span className="text-slate-500">--- Normal Range (60-100)</span>
                </div>
              </div>

              {data.vitalsSeries.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-xs text-slate-500">
                  No vital records found for the selected crew member and timeframe.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.vitalsSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="timeFormatted"
                        stroke="#64748b"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        stroke="#64748b"
                        domain={[30, 180]}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <ReferenceLine y={60} stroke="#3b82f6" strokeDasharray="3 3" />
                      <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="3 3" />
                      <ReferenceLine y={140} stroke="#f43f5e" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="heartRate"
                        name="Heart Rate (BPM)"
                        stroke="#fb7185"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* 2. BLOOD OXYGENATION (SPO2) & TEMPERATURE */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* SpO2 */}
              <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 shadow-xl">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white">
                    Blood Oxygen Saturation (SpO₂)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Peripheral pulse oximetry with Hypoxia Critical Line (90%).
                  </p>
                </div>

                {data.vitalsSeries.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-xs text-slate-500">
                    No SpO₂ data available.
                  </div>
                ) : (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.vitalsSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="timeFormatted"
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <YAxis
                          stroke="#64748b"
                          domain={[70, 100]}
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <ReferenceLine y={90} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "Hypoxia (90%)", fill: "#f43f5e", fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey="spo2"
                          name="SpO₂ (%)"
                          stroke="#22d3ee"
                          strokeWidth={2}
                          dot={{ r: 2.5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              {/* TEMPERATURE */}
              <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 shadow-xl">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white">
                    Core Body Temperature (°C)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Thermoregulatory tracking with Hyperthermia Threshold (38.0°C).
                  </p>
                </div>

                {data.vitalsSeries.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-xs text-slate-500">
                    No temperature data available.
                  </div>
                ) : (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.vitalsSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="timeFormatted"
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <YAxis
                          stroke="#64748b"
                          domain={[35, 42]}
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <ReferenceLine y={38.0} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Fever (38°C)", fill: "#f59e0b", fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          name="Temperature (°C)"
                          stroke="#fbbf24"
                          strokeWidth={2}
                          dot={{ r: 2.5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            </div>

            {/* 3. SLEEP DURATION & ANOMALIES BREAKDOWN */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* SLEEP */}
              <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 shadow-xl">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white">
                    Crew Sleep Duration & Circadian Rhythm
                  </h3>
                  <p className="text-xs text-slate-400">
                    Self-reported and biometric rest intervals (Hours slept vs 8h target).
                  </p>
                </div>

                {data.sleepSeries.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-xs text-slate-500">
                    No sleep check-in records found for this period.
                  </div>
                ) : (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.sleepSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="dateFormatted"
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <YAxis
                          stroke="#64748b"
                          domain={[0, 12]}
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <ReferenceLine y={8} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Nominal (8h)", fill: "#10b981", fontSize: 10 }} />
                        <Bar
                          dataKey="sleepHours"
                          name="Sleep Duration (hrs)"
                          fill="#818cf8"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              {/* ANOMALY BREAKDOWN */}
              <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 shadow-xl">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-white">
                    Health Anomalies & Incident Severity
                  </h3>
                  <p className="text-xs text-slate-400">
                    Distribution of clinical alert events detected by the rules engine.
                  </p>
                </div>

                {data.aggregates.alertsCount === 0 ? (
                  <div className="flex h-56 items-center justify-center text-xs text-slate-500">
                    No health alerts triggered during this interval.
                  </div>
                ) : (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={anomalyDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="name"
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar
                          dataKey="count"
                          name="Alerts Count"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            </div>

            {/* 4. RECENT ANOMALIES LOG */}
            <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-1">
                Recent Clinical Trigger History
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Telemetry incidents evaluated against mission medical standards.
              </p>

              {data.recentAlerts.length === 0 ? (
                <p className="text-xs text-slate-500">No anomaly history recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="border-b border-white/10 text-[10px] uppercase font-bold text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Astronaut</th>
                        <th className="py-2.5 px-3">Rule Key</th>
                        <th className="py-2.5 px-3">Recorded At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.recentAlerts.map((a) => (
                        <tr key={a.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                a.severity === "critical"
                                  ? "bg-rose-500 text-white"
                                  : a.severity === "warning"
                                  ? "bg-amber-500 text-slate-950"
                                  : "bg-cyan-500 text-slate-950"
                              }`}
                            >
                              {a.severity}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-white">{a.title}</td>
                          <td className="py-3 px-3 text-cyan-300">{a.astronautName}</td>
                          <td className="py-3 px-3 font-mono text-slate-400">{a.rule_key}</td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
