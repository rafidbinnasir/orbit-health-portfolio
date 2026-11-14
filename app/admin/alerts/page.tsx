"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AdminShell from "../AdminShell";

type AlertItem = {
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
  reading?: {
    heart_rate: number | null;
    spo2: number | null;
    temperature_c: number | null;
    recorded_at: string;
  } | null;
};

type AlertCounts = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  active: number;
  acknowledged: number;
  resolved: number;
};

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState<AlertCounts>({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    active: 0,
    acknowledged: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspect modal
  const [inspectAlert, setInspectAlert] = useState<AlertItem | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function loadAlerts(showSpin = false) {
    if (showSpin) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const res = await fetch(`/api/admin/alerts?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load alerts (HTTP ${res.status})`);
      }
      const json = await res.json();
      setAlerts(json.alerts || []);
      setCounts(
        json.counts || {
          total: 0,
          critical: 0,
          warning: 0,
          info: 0,
          active: 0,
          acknowledged: 0,
          resolved: 0,
        }
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching alerts");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [severityFilter, statusFilter]);

  async function handleUpdateStatus(
    alertId: number,
    nextStatus: "acknowledged" | "resolved"
  ) {
    try {
      setUpdatingId(alertId);
      const res = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update alert (HTTP ${res.status})`);
      }
      await loadAlerts();
      if (inspectAlert && inspectAlert.id === alertId) {
        setInspectAlert((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating alert status");
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredAlerts = useMemo(() => {
    if (!searchQuery.trim()) return alerts;
    const q = searchQuery.toLowerCase();
    return alerts.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.astronautName.toLowerCase().includes(q) ||
        a.astronautId.toLowerCase().includes(q) ||
        a.rule_key.toLowerCase().includes(q)
    );
  }, [alerts, searchQuery]);

  return (
    <AdminShell
      activeSection="alerts"
      title="Health Alerts Incident Center"
      headerActions={
        <button
          type="button"
          onClick={() => loadAlerts(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 transition"
        >
          <span className={`inline-block ${isRefreshing ? "animate-spin" : ""}`}>↻</span>
          <span className="hidden sm:inline">Refresh Alerts</span>
        </button>
      }
    >
      <div className="space-y-8">
        {/* TOP SUMMARY STRIP */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div
            onClick={() => {
              setSeverityFilter("all");
              setStatusFilter("all");
            }}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              severityFilter === "all" && statusFilter === "all"
                ? "border-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                : "border-white/10 bg-[#0A1222] hover:border-white/20"
            }`}
          >
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Total Incidents
            </p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {counts.total}
            </p>
            <p className="mt-1 text-xs text-slate-500">All historical telemetry events</p>
          </div>

          <div
            onClick={() => {
              setSeverityFilter("critical");
              setStatusFilter("active");
            }}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              severityFilter === "critical"
                ? "border-rose-400 bg-rose-950/40 shadow-[0_0_15px_rgba(244,63,94,0.25)]"
                : "border-rose-500/30 bg-rose-500/10 hover:border-rose-400/50"
            }`}
          >
            <p className="text-[10px] font-bold tracking-widest text-rose-300 uppercase">
              Critical Alerts
            </p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {counts.critical}
            </p>
            <p className="mt-1 text-xs text-rose-300/80">Immediate clinical escalation</p>
          </div>

          <div
            onClick={() => {
              setSeverityFilter("warning");
              setStatusFilter("all");
            }}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              severityFilter === "warning"
                ? "border-amber-400 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                : "border-amber-500/30 bg-amber-500/10 hover:border-amber-400/50"
            }`}
          >
            <p className="text-[10px] font-bold tracking-widest text-amber-300 uppercase">
              Warning Alerts
            </p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {counts.warning}
            </p>
            <p className="mt-1 text-xs text-amber-300/80">Physiological threshold variances</p>
          </div>

          <div
            onClick={() => {
              setStatusFilter("active");
              setSeverityFilter("all");
            }}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
              statusFilter === "active"
                ? "border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                : "border-white/10 bg-[#0A1222] hover:border-white/20"
            }`}
          >
            <p className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase">
              Active Unresolved
            </p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {counts.active}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {counts.acknowledged} acknowledged · {counts.resolved} resolved
            </p>
          </div>
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="rounded-2xl border border-white/10 bg-[#0A1222] p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* SEARCH INPUT */}
            <div className="relative min-w-[260px] flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by astronaut, ID, or alert title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#070C18] px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* SEVERITY TABS */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Severity:
              </span>
              <div className="flex rounded-xl border border-white/10 bg-[#070C18] p-1 text-xs">
                {(["all", "critical", "warning", "info"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`cursor-pointer rounded-lg px-3 py-1 font-semibold capitalize transition ${
                      severityFilter === sev
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
            </div>

            {/* STATUS TABS */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                Status:
              </span>
              <div className="flex rounded-xl border border-white/10 bg-[#070C18] p-1 text-xs">
                {(["all", "active", "acknowledged", "resolved"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`cursor-pointer rounded-lg px-3 py-1 font-semibold capitalize transition ${
                      statusFilter === st
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ALERTS TABLE / CARDS */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#0A1222] p-12 text-center text-cyan-400">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="mt-4 text-xs font-semibold tracking-widest text-slate-400">
              RETRIEVING MISSION ALERTS FEED...
            </p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-[#0A1222]/50 p-12 text-center text-slate-400">
            <p className="text-sm font-semibold text-white">No health alerts match your filter criteria.</p>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting the severity or status filters above.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-[#0A1222] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs text-slate-300">
                <thead className="border-b border-white/10 bg-[#070C18]/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">Severity</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Alert Finding</th>
                    <th className="py-3.5 px-4">Affected Astronaut</th>
                    <th className="py-3.5 px-4">Measurement</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAlerts.map((alert) => {
                    const isCritical = alert.severity === "critical";
                    const isWarning = alert.severity === "warning";
                    const isActive = alert.status === "active";

                    return (
                      <tr
                        key={alert.id}
                        className={`hover:bg-white/[0.02] transition ${
                          isCritical && isActive ? "bg-rose-950/10" : ""
                        }`}
                      >
                        {/* SEVERITY */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                              isCritical
                                ? "bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                                : isWarning
                                ? "bg-amber-500 text-slate-950"
                                : "bg-cyan-500 text-slate-950"
                            }`}
                          >
                            <span>{isCritical ? "▲" : isWarning ? "◆" : "●"}</span>
                            {alert.severity}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                              isActive
                                ? "border-rose-400/40 bg-rose-400/10 text-rose-300 animate-pulse"
                                : alert.status === "acknowledged"
                                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {alert.status.toUpperCase()}
                          </span>
                        </td>

                        {/* TITLE & DESCRIPTION */}
                        <td className="py-4 px-4 max-w-xs">
                          <p className="font-bold text-white text-xs sm:text-sm">
                            {alert.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">
                            {alert.description || alert.recommended_action}
                          </p>
                        </td>

                        {/* ASTRONAUT */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <p className="font-bold text-white">{alert.astronautName}</p>
                          <p className="font-mono text-[11px] text-cyan-300">{alert.astronautId}</p>
                        </td>

                        {/* MEASUREMENT EVIDENCE */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {alert.evidence && Object.keys(alert.evidence).length > 0 ? (
                            <div className="font-mono text-[11px] text-slate-300">
                              {Object.entries(alert.evidence)
                                .slice(0, 2)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" · ")}
                            </div>
                          ) : alert.reading ? (
                            <div className="font-mono text-[11px] text-slate-300">
                              {alert.reading.heart_rate} BPM / {alert.reading.spo2}%
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* TIMESTAMP */}
                        <td className="py-4 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                          {new Date(alert.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* ACTIONS */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectAlert(alert)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300 transition"
                            >
                              Inspect
                            </button>

                            {isActive && (
                              <button
                                type="button"
                                disabled={updatingId === alert.id}
                                onClick={() => handleUpdateStatus(alert.id, "acknowledged")}
                                className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-400/20 transition disabled:opacity-50"
                              >
                                {updatingId === alert.id ? "..." : "Acknowledge"}
                              </button>
                            )}

                            {alert.status !== "resolved" && (
                              <button
                                type="button"
                                disabled={updatingId === alert.id}
                                onClick={() => handleUpdateStatus(alert.id, "resolved")}
                                className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-400/20 transition disabled:opacity-50"
                              >
                                {updatingId === alert.id ? "..." : "Resolve"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DETAILED INSPECTION MODAL */}
      {inspectAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl border border-white/20 bg-[#0A1326] p-6 sm:p-8 shadow-2xl text-slate-200">
            <button
              onClick={() => setInspectAlert(null)}
              className="absolute top-5 right-5 rounded-xl border border-white/10 p-2 text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                  inspectAlert.severity === "critical"
                    ? "bg-rose-500 text-white"
                    : inspectAlert.severity === "warning"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-cyan-500 text-slate-950"
                }`}
              >
                {inspectAlert.severity}
              </span>
              <span className="text-xs font-mono text-cyan-400">
                Rule ID: {inspectAlert.rule_key}
              </span>
            </div>

            <h3 className="mt-4 text-xl font-bold text-white sm:text-2xl">
              {inspectAlert.title}
            </h3>

            <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-[#070C18] p-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Affected Astronaut
                  </p>
                  <p className="mt-0.5 font-bold text-white text-sm">
                    {inspectAlert.astronautName}
                  </p>
                  <p className="font-mono text-cyan-300">{inspectAlert.astronautId}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Recorded Timestamp
                  </p>
                  <p className="mt-0.5 font-bold text-white">
                    {new Date(inspectAlert.created_at).toLocaleString()}
                  </p>
                  <p className="text-slate-400">Status: {inspectAlert.status}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Reading Reference
                  </p>
                  <p className="mt-0.5 font-mono text-slate-300">
                    {inspectAlert.reading_id ? `Vital #${inspectAlert.reading_id}` : "Algorithmic"}
                  </p>
                  {inspectAlert.resolved_at && (
                    <p className="text-emerald-400 text-[10px]">
                      Resolved: {new Date(inspectAlert.resolved_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {inspectAlert.description && (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Telemetry Description & Clinical Context
                  </p>
                  <p className="mt-1 text-slate-200 leading-relaxed text-sm">
                    {inspectAlert.description}
                  </p>
                </div>
              )}

              {inspectAlert.recommended_action && (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-[10px] uppercase font-bold text-amber-400">
                    Standard Medical Escalation Protocol
                  </p>
                  <p className="mt-1 text-slate-200 leading-relaxed text-sm">
                    {inspectAlert.recommended_action}
                  </p>
                </div>
              )}

              {inspectAlert.evidence && Object.keys(inspectAlert.evidence).length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Sensor Evidence & Quantitative Thresholds
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 font-mono">
                    {Object.entries(inspectAlert.evidence).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-lg border border-cyan-400/25 bg-cyan-950/40 px-3 py-1.5 text-cyan-200 text-xs"
                      >
                        {k}: <strong className="text-white">{String(v)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/admin/monitoring?astronautId=${inspectAlert.user_id}`}
                className="text-xs text-cyan-400 hover:underline"
              >
                View Astronaut Telemetry Profile →
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectAlert(null)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
                >
                  Dismiss
                </button>

                {inspectAlert.status === "active" && (
                  <button
                    type="button"
                    disabled={updatingId === inspectAlert.id}
                    onClick={() => handleUpdateStatus(inspectAlert.id, "acknowledged")}
                    className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                  >
                    {updatingId === inspectAlert.id ? "Updating..." : "Acknowledge"}
                  </button>
                )}

                {inspectAlert.status !== "resolved" && (
                  <button
                    type="button"
                    disabled={updatingId === inspectAlert.id}
                    onClick={() => handleUpdateStatus(inspectAlert.id, "resolved")}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {updatingId === inspectAlert.id ? "Updating..." : "Mark as Resolved"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
