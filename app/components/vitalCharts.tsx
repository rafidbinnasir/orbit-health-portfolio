"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

type VitalReading = {
  id: number;
  heart_rate: number | null;
  spo2: number | null;
  temperature_c: number | null;
  recorded_at: string;
};

type SleepReport = {
  id: string;
  sleep_minutes: number;
  submitted_at: string;
};

type TimeRange = "1h" | "24h" | "7d" | "all";
type StreamFilter = "all" | "heart" | "spo2" | "temp" | "sleep";

const timeRanges: { label: string; value: TimeRange }[] = [
  { label: "Past 1h", value: "1h" },
  { label: "Past 24h", value: "24h" },
  { label: "Past 7d", value: "7d" },
  { label: "All Telemetry", value: "all" },
];

export default function VitalCharts({
  readings,
}: {
  readings: VitalReading[];
}) {
  const [isDark, setIsDark] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [streamFilter, setStreamFilter] = useState<StreamFilter>("all");
  const [sleepReports, setSleepReports] = useState<SleepReport[]>([]);
  const [sleepError, setSleepError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSleepHistory() {
      try {
        const response = await fetch("/api/sleep");

        if (!response.ok) {
          throw new Error("Could not load sleep history.");
        }

        const result = await response.json();

        if (!cancelled) {
          setSleepReports(result.reports ?? []);
          setSleepError("");
        }
      } catch {
        if (!cancelled) {
          setSleepError("Sleep history is currently unavailable.");
        }
      }
    }

    loadSleepHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function updateTheme() {
      setIsDark(document.documentElement.classList.contains("dark"));
    }

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const filteredReadings = useMemo(() => {
    const sorted = [...readings].sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() -
        new Date(b.recorded_at).getTime()
    );

    if (timeRange === "all") return sorted;

    const duration =
      timeRange === "1h"
        ? 60 * 60 * 1000
        : timeRange === "24h"
          ? 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;

    const cutoff = Date.now() - duration;

    return sorted.filter(
      (reading) =>
        new Date(reading.recorded_at).getTime() >= cutoff
    );
  }, [readings, timeRange]);

  const chartData = filteredReadings.map((reading) => ({
    time: new Date(reading.recorded_at).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    heartRate: reading.heart_rate,
    spo2: reading.spo2,
    temperature: reading.temperature_c,
  }));

  const sleepChartData = [...sleepReports]
    .sort(
      (a, b) =>
        new Date(a.submitted_at).getTime() -
        new Date(b.submitted_at).getTime()
    )
    .map((report) => ({
      time: new Date(report.submitted_at).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      hours: Number((report.sleep_minutes / 60).toFixed(2)),
    }));

  // Averages for analytics strip
  const stats = useMemo(() => {
    const validHR = filteredReadings.filter((r) => r.heart_rate != null);
    const avgHR = validHR.length
      ? Math.round(validHR.reduce((acc, r) => acc + (r.heart_rate ?? 0), 0) / validHR.length)
      : null;

    const validSpO2 = filteredReadings.filter((r) => r.spo2 != null);
    const avgSpO2 = validSpO2.length
      ? (validSpO2.reduce((acc, r) => acc + (r.spo2 ?? 0), 0) / validSpO2.length).toFixed(1)
      : null;

    const validTemp = filteredReadings.filter((r) => r.temperature_c != null);
    const avgTemp = validTemp.length
      ? (validTemp.reduce((acc, r) => acc + (r.temperature_c ?? 0), 0) / validTemp.length).toFixed(1)
      : null;

    const avgSleep = sleepReports.length
      ? (sleepReports.reduce((acc, s) => acc + s.sleep_minutes, 0) / sleepReports.length / 60).toFixed(1)
      : null;

    return { avgHR, avgSpO2, avgTemp, avgSleep };
  }, [filteredReadings, sleepReports]);

  const gridStroke = isDark ? "#334155" : "#e2e8f0";
  const axisStroke = isDark ? "#94a3b8" : "#64748b";

  const tooltipContentStyle = {
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    borderColor: isDark ? "#334155" : "#e2e8f0",
    color: isDark ? "#f8fafc" : "#0f172a",
    borderRadius: "0.75rem",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    fontSize: "12px",
    padding: "8px 12px",
  };

  const tooltipItemStyle = {
    color: isDark ? "#f8fafc" : "#0f172a",
    fontSize: "12px",
    fontWeight: "600",
  };

  const axisProps = {
    stroke: axisStroke,
    tick: { fill: axisStroke, fontSize: 11 },
  };

  const showHeart = streamFilter === "all" || streamFilter === "heart";
  const showSpO2 = streamFilter === "all" || streamFilter === "spo2";
  const showTemp = streamFilter === "all" || streamFilter === "temp";
  const showSleep = streamFilter === "all" || streamFilter === "sleep";

  return (
    <div className="space-y-6">
      {/* ANALYTICS CONTROL & FILTER BAR */}
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Telemetry Trend Analytics
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {filteredReadings.length} records processed for current analytical window
          </p>
        </div>

        {/* TIME RANGE SELECTION PILLS */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-100/60 p-1 dark:border-slate-800 dark:bg-slate-950/60">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => setTimeRange(range.value)}
              aria-pressed={timeRange === range.value}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                timeRange === range.value
                  ? "bg-cyan-500 text-slate-950 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </section>

      {/* PHYSIOLOGICAL AVERAGES STRIP */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">
            Avg Heart Rate
          </p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              {stats.avgHR ?? "—"}
            </span>
            <span className="text-xs font-medium text-slate-400">BPM</span>
          </div>
          <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
            Range: 60–100 norm
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500">
            Avg Blood Oxygen
          </p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              {stats.avgSpO2 ?? "—"}
            </span>
            <span className="text-xs font-medium text-slate-400">%</span>
          </div>
          <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
            Threshold: ≥95% opt
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
            Avg Temperature
          </p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              {stats.avgTemp ?? "—"}
            </span>
            <span className="text-xs font-medium text-slate-400">°C</span>
          </div>
          <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
            Baseline: 36.5–37.5
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3.5 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">
            Avg Sleep Duration
          </p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              {stats.avgSleep ?? "—"}
            </span>
            <span className="text-xs font-medium text-slate-400">hours</span>
          </div>
          <span className="mt-0.5 block text-[10px] text-slate-400 dark:text-slate-500">
            Mission Target: 8.0h
          </span>
        </div>
      </div>

      {/* STREAM FILTER TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
          Stream View:
        </span>
        {[
          { id: "all", label: "All Telemetry Panels" },
          { id: "heart", label: "Heart Rate" },
          { id: "spo2", label: "Blood Oxygen (SpO₂)" },
          { id: "temp", label: "Core Temperature" },
          { id: "sleep", label: "Sleep History" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStreamFilter(tab.id as StreamFilter)}
            className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition ${
              streamFilter === tab.id
                ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            📊
          </div>
          <p className="mt-3 font-semibold text-slate-800 dark:text-slate-200">
            No Telemetry Readings for Selected Range
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Select another duration window or wait for telemetry sync.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 1. HEART RATE */}
          {showHeart && (
            <ChartPanel
              title="Heart Rate"
              unit="BPM"
              badge="Cardiovascular"
              badgeColor="rose"
              rangeDesc="Normal resting range: 60–100 BPM"
            >
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                <XAxis dataKey="time" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend
                  wrapperStyle={{
                    color: isDark ? "#cbd5e1" : "#475569",
                    fontSize: "12px",
                  }}
                />
                <ReferenceLine
                  y={100}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{ value: "100 max", fill: axisStroke, fontSize: 10 }}
                />
                <ReferenceLine
                  y={60}
                  stroke="#38bdf8"
                  strokeDasharray="4 4"
                  label={{ value: "60 min", fill: axisStroke, fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="heartRate"
                  name="Heart Rate (BPM)"
                  stroke="#fb7185"
                  strokeWidth={2.2}
                  dot={{ r: 2.5, fill: "#fb7185" }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartPanel>
          )}

          {/* 2. BLOOD OXYGEN */}
          {showSpO2 && (
            <ChartPanel
              title="Blood Oxygen (SpO₂)"
              unit="%"
              badge="Oxygenation"
              badgeColor="cyan"
              rangeDesc="Target threshold: ≥ 95%"
            >
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                <XAxis dataKey="time" {...axisProps} />
                <YAxis domain={[80, 100]} {...axisProps} />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend
                  wrapperStyle={{
                    color: isDark ? "#cbd5e1" : "#475569",
                    fontSize: "12px",
                  }}
                />
                <ReferenceLine
                  y={95}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: "95% nominal", fill: axisStroke, fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="spo2"
                  name="SpO₂ Saturation (%)"
                  stroke="#22d3ee"
                  strokeWidth={2.2}
                  dot={{ r: 2.5, fill: "#22d3ee" }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartPanel>
          )}

          {/* 3. TEMPERATURE */}
          {showTemp && (
            <ChartPanel
              title="Core Body Temperature"
              unit="°C"
              badge="Thermal"
              badgeColor="amber"
              rangeDesc="Baseline: 36.5–37.5 °C"
            >
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                <XAxis dataKey="time" {...axisProps} />
                <YAxis domain={[34, 41]} {...axisProps} />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend
                  wrapperStyle={{
                    color: isDark ? "#cbd5e1" : "#475569",
                    fontSize: "12px",
                  }}
                />
                <ReferenceLine
                  y={37.5}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: "37.5°C threshold", fill: axisStroke, fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="Core Temp (°C)"
                  stroke="#fbbf24"
                  strokeWidth={2.2}
                  dot={{ r: 2.5, fill: "#fbbf24" }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartPanel>
          )}

          {/* 4. SLEEP DURATION */}
          {showSleep && (
            <ChartPanel
              title="Sleep Duration History"
              unit="hours"
              badge="Rest & Recovery"
              badgeColor="violet"
              rangeDesc="Target rest cycle: 8.0 hours"
            >
              {sleepError ? (
                <div className="flex h-full items-center justify-center text-xs font-semibold text-rose-500">
                  {sleepError}
                </div>
              ) : sleepChartData.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    No Sleep Reports Logged
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Submit daily check-ins to track sleep circadian patterns.
                  </p>
                </div>
              ) : (
                <LineChart data={sleepChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} />
                  <XAxis dataKey="time" {...axisProps} />
                  <YAxis
                    domain={[0, 12]}
                    tickFormatter={(value) => `${value}h`}
                    {...axisProps}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value) => [`${value} hours`, "Sleep Duration"]}
                  />
                  <Legend
                    wrapperStyle={{
                      color: isDark ? "#cbd5e1" : "#475569",
                      fontSize: "12px",
                    }}
                  />
                  <ReferenceLine
                    y={8}
                    stroke="#10b981"
                    strokeDasharray="5 5"
                    label={{ value: "8.0h mission target", fill: axisStroke, fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    name="Sleep Duration (h)"
                    stroke="#a78bfa"
                    strokeWidth={2.4}
                    dot={{ r: 3, fill: "#a78bfa" }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              )}
            </ChartPanel>
          )}
        </div>
      )}
    </div>
  );
}

function ChartPanel({
  title,
  unit,
  badge,
  badgeColor,
  rangeDesc,
  children,
}: {
  title: string;
  unit: string;
  badge: string;
  badgeColor: "rose" | "cyan" | "amber" | "violet";
  rangeDesc: string;
  children: React.ReactElement;
}) {
  const badgeClasses = {
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  }[badgeColor];

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </h4>
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClasses}`}
            >
              {badge}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {rangeDesc} · ({unit})
          </p>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}