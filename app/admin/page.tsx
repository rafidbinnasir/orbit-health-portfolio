"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AdminShell from "./AdminShell";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type HealthAlert = {
  id: number;
  user_id: string;
  reading_id: number | null;
  rule_key: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  recommended_action: string;
  evidence: Record<string, any>;
  status: "active" | "acknowledged" | "resolved";
  created_at: string;
  resolved_at: string | null;
  astronautName: string;
  astronautId: string;
  astronautEmail: string;
};

type AstronautSummary = {
  id: string;
  email: string;
  fullName: string;
  astronautId: string;
  missionName: string;
  role: string;
  avatarUrl: string | null;
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

type OverviewData = {
  metrics: {
    totalAstronauts: number;
    totalUsers: number;
    activeCriticalCount: number;
    activeWarningCount: number;
    activeInfoCount: number;
    totalAlertsCount: number;
    totalReadingsCount: number;
    activeAstronauts24h: number;
    totalSleepReports: number;
  };
  averages: {
    avgHeartRate: number | null;
    avgSpO2: number | null;
    avgTemperature: number | null;
    avgSleepHours: number | null;
  };
  alerts: HealthAlert[];
  astronauts: AstronautSummary[];
};

export default function AdminPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Alert filter on the homepage
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<
    "all" | "critical" | "warning" | "info"
  >("all");

  // Inspection modal
  const [selectedAlert, setSelectedAlert] = useState<HealthAlert | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  async function fetchOverview(showRefreshSpin = false) {
    if (showRefreshSpin) setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load control center data (HTTP ${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(() => {
      fetchOverview();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleAcknowledgeAlert(alertId: number) {
    try {
      setAcknowledging(true);
      const res = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "acknowledged" }),
      });
      if (!res.ok) {
        throw new Error("Failed to acknowledge alert");
      }
      await fetchOverview();
      if (selectedAlert && selectedAlert.id === alertId) {
        setSelectedAlert((prev) => (prev ? { ...prev, status: "acknowledged" } : null));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating alert");
    } finally {
      setAcknowledging(false);
    }
  }

  const filteredAlerts = useMemo(() => {
    if (!data?.alerts) return [];
    if (alertSeverityFilter === "all") return data.alerts;
    return data.alerts.filter((a) => a.severity === alertSeverityFilter);
  }, [data?.alerts, alertSeverityFilter]);

  // Construct chart points from astronauts' latest vitals or system data
  const telemetryChartData = useMemo(() => {
    if (!data?.astronauts) return [];
    return data.astronauts
      .filter((a) => a.latestReading)
      .map((a) => ({
        name: a.fullName.split(" ")[0],
        heartRate: a.latestReading?.heart_rate,
        spo2: a.latestReading?.spo2,
        temperature: a.latestReading?.temperature_c,
      }));
  }, [data?.astronauts]);

  return (
    <AdminShell
      activeSection="overview"
      title="Health Control Center"
      headerActions={
        <button
          type="button"
          onClick={() => fetchOverview(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 transition"
          title="Refresh telemetry"
        >
          <span className={`inline-block ${isRefreshing ? "animate-spin" : ""}`}>↻</span>
          <span className="hidden sm:inline">Refresh Data</span>
        </button>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-8 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            onClick={() => fetchOverview(true)}
            className="rounded-lg border border-rose-400/40 px-3 py-1 text-xs hover:bg-rose-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-3xl border border-white/10 bg-[#0B1324] p-12 text-center text-cyan-400">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="mt-4 text-xs font-semibold tracking-widest text-slate-400">
            LOADING REAL-TIME MISSION TELEMETRY...
          </p>
        </div>
      ) : data ? (
        <div className="space-y-10">
          {/* TOP OPERATIONS BANNER */}
          <section className="relative overflow-hidden rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-[#0F1E36] via-[#0B1426] to-[#070D1A] p-6 sm:p-9 shadow-2xl">
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-cyan-400/10" />
            <div className="pointer-events-none absolute -right-8 -top-12 h-52 w-52 rounded-full border border-cyan-400/15" />

            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-[11px] font-bold tracking-widest text-cyan-300">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  CENTRAL MEDICAL OPERATIONS
                </div>
                <h2 className="mt-4 text-2xl font-black text-white sm:text-4xl tracking-tight">
                  Mission Control Telemetry Center
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-300 sm:text-base">
                  Real-time health oversight for all active astronauts. Prioritize incoming
                  biometric alerts, inspect anomalous physiological signs, and track mission vital trends.
                </p>
              </div>

              {/* QUICK STATUS PILL */}
              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#070C18]/90 p-4 sm:p-5 text-right">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Biometric Telemetry Stream
                </p>
                <div className="flex items-center justify-end gap-2 text-emerald-400 font-bold text-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  ONLINE & SYNCHRONIZED
                </div>
                <p className="text-xs text-slate-500">
                  {data.metrics.totalReadingsCount} recorded vital readings
                </p>
              </div>
            </div>

            {/* HIGH-LEVEL METRICS CARDS */}
            <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4 border-t border-white/10 pt-7">
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
                <p className="text-[10px] font-bold tracking-widest text-rose-300 uppercase">
                  Critical Alerts
                </p>
                <p className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {data.metrics.activeCriticalCount}
                </p>
                <p className="mt-1 text-[11px] text-rose-300/80">Immediate clinical action required</p>
              </div>

              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                <p className="text-[10px] font-bold tracking-widest text-amber-300 uppercase">
                  Warning Alerts
                </p>
                <p className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {data.metrics.activeWarningCount}
                </p>
                <p className="mt-1 text-[11px] text-amber-300/80">Telemetry variance monitored</p>
              </div>

              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-4">
                <p className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase">
                  Total Astronauts
                </p>
                <p className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {data.metrics.totalAstronauts}
                </p>
                <p className="mt-1 text-[11px] text-cyan-300/80">
                  {data.metrics.activeAstronauts24h} active in last 24h
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Avg Heart Rate
                </p>
                <p className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {data.averages.avgHeartRate ? `${data.averages.avgHeartRate} BPM` : "—"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  SpO₂ {data.averages.avgSpO2 ?? "—"}% · {data.averages.avgTemperature ?? "—"}°C
                </p>
              </div>
            </div>
          </section>

          {/* SECTION A: HEALTH ALERTS — HIGHEST PRIORITY */}
          <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 sm:p-8 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 text-xs font-bold">
                    !
                  </span>
                  <p className="text-xs font-bold tracking-[0.25em] text-rose-400 uppercase">
                    PRIORITY QUEUE
                  </p>
                </div>
                <h3 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
                  Mission Health Alerts
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Real-time clinical triggers and telemetry threshold breaches from the health insights engine.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filter Tabs */}
                <div className="flex rounded-xl border border-white/10 bg-[#070C18] p-1 text-xs">
                  {(["all", "critical", "warning", "info"] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setAlertSeverityFilter(sev)}
                      className={`cursor-pointer rounded-lg px-3 py-1.5 font-semibold capitalize transition ${
                        alertSeverityFilter === sev
                          ? sev === "critical"
                            ? "bg-rose-500 text-white"
                            : sev === "warning"
                            ? "bg-amber-500 text-slate-950"
                            : "bg-cyan-500 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <Link
                  href="/admin/alerts"
                  className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
                >
                  View All Alerts →
                </Link>
              </div>
            </div>

            {/* ALERTS LIST */}
            <div className="mt-6">
              {filteredAlerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400">
                  <p className="font-semibold text-sm text-slate-300">
                    No {alertSeverityFilter !== "all" ? alertSeverityFilter : ""} health alerts recorded
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    All monitored astronaut vitals are within approved mission thresholds.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAlerts.slice(0, 6).map((alert) => {
                    const isCritical = alert.severity === "critical";
                    const isWarning = alert.severity === "warning";
                    const isActive = alert.status === "active";

                    return (
                      <div
                        key={alert.id}
                        className={`group relative flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-4 sm:p-5 transition ${
                          isCritical
                            ? "border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-rose-950/20 to-[#0A1222] hover:border-rose-400"
                            : isWarning
                            ? "border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-amber-950/15 to-[#0A1222] hover:border-amber-400"
                            : "border-cyan-500/20 bg-cyan-950/10 hover:border-cyan-400/40"
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          {/* SEVERITY ICON */}
                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                              isCritical
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : isWarning
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            }`}
                          >
                            {isCritical ? "▲" : isWarning ? "◆" : "●"}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isCritical
                                    ? "bg-rose-500 text-white"
                                    : isWarning
                                    ? "bg-amber-500 text-slate-950"
                                    : "bg-cyan-500 text-slate-950"
                                }`}
                              >
                                {alert.severity}
                              </span>

                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  isActive
                                    ? "border-rose-400/30 bg-rose-400/10 text-rose-300 animate-pulse"
                                    : "border-slate-700 bg-slate-800 text-slate-400"
                                }`}
                              >
                                {alert.status.toUpperCase()}
                              </span>

                              <span className="text-xs font-semibold text-cyan-300">
                                {alert.astronautName} ({alert.astronautId})
                              </span>

                              <span className="text-[11px] text-slate-500">
                                {new Date(alert.created_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <h4 className="mt-1.5 text-sm font-bold text-white sm:text-base">
                              {alert.title}
                            </h4>

                            <p className="mt-1 text-xs leading-relaxed text-slate-300 line-clamp-2">
                              {alert.description || alert.recommended_action}
                            </p>

                            {/* EVIDENCE MEASUREMENT CHIPS */}
                            {alert.evidence && Object.keys(alert.evidence).length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                                {Object.entries(alert.evidence).map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-slate-300 font-mono"
                                  >
                                    {k}: <strong className="text-white">{String(v)}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex shrink-0 items-center gap-2 self-center sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setSelectedAlert(alert)}
                            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300"
                          >
                            Inspect Details
                          </button>

                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              disabled={acknowledging}
                              className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-50"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* SECTION B: HEALTH REPORTS — HIGH PRIORITY */}
          <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 sm:p-8 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                    ▤
                  </span>
                  <p className="text-xs font-bold tracking-[0.25em] text-cyan-400 uppercase">
                    CLINICAL ANALYTICS
                  </p>
                </div>
                <h3 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
                  Health Reports & Telemetry Trends
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Cross-astronaut physiological vital signs, blood oxygenation, core temperature, and sleep.
                </p>
              </div>

              <Link
                href="/admin/reports"
                className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-400/20"
              >
                Open Analytics & Reports →
              </Link>
            </div>

            {/* TRENDS CHART */}
            <div className="mt-6">
              <div className="rounded-2xl border border-white/10 bg-[#070C18] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Astronaut Fleet Telemetry Comparison (Latest Readings)
                    </h4>
                    <p className="text-xs text-slate-400">
                      Synchronized Heart Rate (BPM), SpO₂ (%), and Temperature (°C)
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-[#fb7185]">● Heart Rate (BPM)</span>
                    <span className="text-[#22d3ee]">● SpO₂ (%)</span>
                    <span className="text-[#fbbf24]">● Temp (°C)</span>
                  </div>
                </div>

                {telemetryChartData.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-xs text-slate-500">
                    No active vital readings recorded yet to render comparative charts.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={telemetryChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="name"
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0B1324",
                            borderColor: "#334155",
                            borderRadius: "0.75rem",
                            color: "#fff",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
                        <Line
                          type="monotone"
                          dataKey="heartRate"
                          name="Heart Rate (BPM)"
                          stroke="#fb7185"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="spo2"
                          name="SpO₂ (%)"
                          stroke="#22d3ee"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          name="Temperature (°C)"
                          stroke="#fbbf24"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION C: ASTRONAUT FLEET OVERVIEW */}
          <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 sm:p-8 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    ⌁
                  </span>
                  <p className="text-xs font-bold tracking-[0.25em] text-emerald-400 uppercase">
                    CREW ROSTER
                  </p>
                </div>
                <h3 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
                  Astronaut Monitoring Overview
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Registered crew members, telemetry status, latest biometric readings, and active alerts.
                </p>
              </div>

              <Link
                href="/admin/monitoring"
                className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-400/20"
              >
                Go to Monitoring Center →
              </Link>
            </div>

            {/* ASTRONAUT TABLE */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs text-slate-300">
                <thead className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Astronaut</th>
                    <th className="py-3 px-3">ID / Mission</th>
                    <th className="py-3 px-3">Telemetry Status</th>
                    <th className="py-3 px-3">Latest Vitals</th>
                    <th className="py-3 px-3">Last Recorded</th>
                    <th className="py-3 px-3">Alerts</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.astronauts.map((astro) => {
                    const hasLive = astro.telemetryStatus === "live";
                    const isOutdated = astro.telemetryStatus === "outdated";

                    return (
                      <tr key={astro.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 font-bold text-cyan-300 text-xs">
                              {astro.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{astro.fullName}</p>
                              <p className="text-[11px] text-slate-500">{astro.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <p className="font-mono text-cyan-300 font-semibold">{astro.astronautId}</p>
                          <p className="text-[11px] text-slate-500">{astro.missionName}</p>
                        </td>

                        <td className="py-3.5 px-3">
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
                            {hasLive ? "Live Telemetry" : isOutdated ? "Outdated" : "No Readings"}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          {astro.latestReading ? (
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="text-rose-300">
                                {astro.latestReading.heart_rate ?? "—"} BPM
                              </span>
                              <span className="text-slate-600">·</span>
                              <span className="text-cyan-300">
                                {astro.latestReading.spo2 ?? "—"}%
                              </span>
                              <span className="text-slate-600">·</span>
                              <span className="text-amber-300">
                                {astro.latestReading.temperature_c ?? "—"}°C
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">None recorded</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-slate-400">
                          {astro.latestReading?.recorded_at ? (
                            new Date(astro.latestReading.recorded_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          {astro.criticalAlertsCount > 0 ? (
                            <span className="rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                              {astro.criticalAlertsCount} Critical
                            </span>
                          ) : astro.warningAlertsCount > 0 ? (
                            <span className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              {astro.warningAlertsCount} Warning
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">0 active</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <Link
                            href={`/admin/monitoring?astronautId=${astro.id}`}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-200"
                          >
                            Monitor →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {/* INSPECT ALERT DETAILS MODAL */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-3xl border border-white/20 bg-[#0A1326] p-6 sm:p-8 shadow-2xl text-slate-200">
            <button
              onClick={() => setSelectedAlert(null)}
              className="absolute top-5 right-5 rounded-xl border border-white/10 p-2 text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  selectedAlert.severity === "critical"
                    ? "bg-rose-500 text-white"
                    : selectedAlert.severity === "warning"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-cyan-500 text-slate-950"
                }`}
              >
                {selectedAlert.severity}
              </span>
              <span className="text-xs font-bold text-cyan-400">
                Rule Key: {selectedAlert.rule_key}
              </span>
            </div>

            <h3 className="mt-4 text-xl font-bold text-white">
              {selectedAlert.title}
            </h3>

            <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-[#070C18] p-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Affected Astronaut
                  </p>
                  <p className="mt-0.5 font-bold text-white">
                    {selectedAlert.astronautName} ({selectedAlert.astronautId})
                  </p>
                  <p className="text-slate-400">{selectedAlert.astronautEmail}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Triggered Timestamp
                  </p>
                  <p className="mt-0.5 font-bold text-white">
                    {new Date(selectedAlert.created_at).toLocaleString()}
                  </p>
                  <p className="text-slate-400 capitalize">Status: {selectedAlert.status}</p>
                </div>
              </div>

              {selectedAlert.description && (
                <div className="border-t border-white/10 pt-3">
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Clinical Finding
                  </p>
                  <p className="mt-1 text-slate-200 leading-relaxed">
                    {selectedAlert.description}
                  </p>
                </div>
              )}

              {selectedAlert.recommended_action && (
                <div className="border-t border-white/10 pt-3">
                  <p className="text-[10px] uppercase font-bold text-amber-400">
                    Recommended Clinical Action
                  </p>
                  <p className="mt-1 text-slate-200 leading-relaxed">
                    {selectedAlert.recommended_action}
                  </p>
                </div>
              )}

              {selectedAlert.evidence && Object.keys(selectedAlert.evidence).length > 0 && (
                <div className="border-t border-white/10 pt-3">
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Measurement Evidence
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2 font-mono">
                    {Object.entries(selectedAlert.evidence).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-lg border border-cyan-400/20 bg-cyan-950/40 px-2.5 py-1 text-cyan-200 text-xs"
                      >
                        {k}: <strong>{String(v)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Close
              </button>

              {selectedAlert.status === "active" && (
                <button
                  type="button"
                  disabled={acknowledging}
                  onClick={() => handleAcknowledgeAlert(selectedAlert.id)}
                  className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                >
                  {acknowledging ? "Acknowledging..." : "Acknowledge Alert"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
