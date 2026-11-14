"use client";

type VitalReading = {
  id: number;
  heart_rate: number | null;
  spo2: number | null;
  temperature_c: number | null;
  recorded_at: string;
};

type CompactVitalsProps = {
  readings: VitalReading[];
  loading?: boolean;
};

type TrendState = {
  direction: "up" | "down" | "neutral" | "insufficient";
  deltaText: string;
  srText: string;
};

function computeTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
  unit: string
): TrendState {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined
  ) {
    return {
      direction: "insufficient",
      deltaText: "—",
      srText: "Insufficient historical data for trend comparison",
    };
  }

  const diff = Number((current - previous).toFixed(1));

  if (diff > 0) {
    return {
      direction: "up",
      deltaText: `+${diff}`,
      srText: `Increased by ${diff} ${unit} from previous measurement (${previous} ${unit})`,
    };
  }

  if (diff < 0) {
    return {
      direction: "down",
      deltaText: `${diff}`,
      srText: `Decreased by ${Math.abs(diff)} ${unit} from previous measurement (${previous} ${unit})`,
    };
  }

  return {
    direction: "neutral",
    deltaText: "0",
    srText: `Unchanged from previous measurement (${previous} ${unit})`,
  };
}

export default function CompactVitals({
  readings,
  loading = false,
}: CompactVitalsProps) {
  const current = readings[0];
  const previous = readings.length > 1 ? readings[1] : null;

  const hrTrend = computeTrend(
    current?.heart_rate,
    previous?.heart_rate,
    "BPM"
  );
  const spo2Trend = computeTrend(current?.spo2, previous?.spo2, "%");
  const tempTrend = computeTrend(
    current?.temperature_c,
    previous?.temperature_c,
    "°C"
  );

  if (loading) {
    return (
      <section
        aria-label="Vitals telemetry loading"
        className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800/70">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/50" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/50" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/50" />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="vitals-panel-heading"
      className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/90"
    >
      {/* HEADER */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800/70">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <div>
              <h3
                id="vitals-panel-heading"
                className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200"
              >
                Telemetry Vitals
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Continuous Biometric Feed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
              {current?.recorded_at
                ? new Date(current.recorded_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "Awaiting sync"}
            </span>
          </div>
        </div>

        {/* THREE COMPACT MEASUREMENT TILES */}
        <div className="mt-3.5 space-y-2.5">
          {/* 1. HEART RATE */}
          <VitalCardItem
            label="Heart Rate"
            subtext="Cardiovascular pace"
            value={current?.heart_rate ?? "—"}
            unit="BPM"
            trend={hrTrend}
            colorTheme="rose"
            status={
              current?.heart_rate != null
                ? current.heart_rate < 60
                  ? "Bradycardia"
                  : current.heart_rate > 100
                    ? "Tachycardia"
                    : "Normal"
                : "Offline"
            }
          />

          {/* 2. BLOOD OXYGEN */}
          <VitalCardItem
            label="Oxygen Saturation"
            subtext="SpO₂ peripheral"
            value={
              current?.spo2 !== null && current?.spo2 !== undefined
                ? current.spo2
                : "—"
            }
            unit="%"
            trend={spo2Trend}
            colorTheme="cyan"
            status={
              current?.spo2 != null
                ? current.spo2 >= 95
                  ? "Optimal"
                  : current.spo2 >= 90
                    ? "Attention"
                    : "Hypoxia"
                : "Offline"
            }
          />

          {/* 3. TEMPERATURE */}
          <VitalCardItem
            label="Core Temperature"
            subtext="Internal baseline"
            value={
              current?.temperature_c !== null &&
              current?.temperature_c !== undefined
                ? `${current.temperature_c}`
                : "—"
            }
            unit="°C"
            trend={tempTrend}
            colorTheme="amber"
            status={
              current?.temperature_c != null
                ? current.temperature_c >= 36.5 && current.temperature_c <= 37.5
                  ? "Euthermic"
                  : current.temperature_c > 37.5
                    ? "Elevated"
                    : "Hypothermic"
                : "Offline"
            }
          />
        </div>
      </div>

      {/* FOOTER METADATA */}
      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400 dark:border-slate-800/70 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Sensor telemetry nominal
        </span>
        <span className="font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          {readings.length} total logged
        </span>
      </div>
    </section>
  );
}

function VitalCardItem({
  label,
  subtext,
  value,
  unit,
  trend,
  colorTheme,
  status,
}: {
  label: string;
  subtext: string;
  value: number | string;
  unit: string;
  trend: TrendState;
  colorTheme: "rose" | "cyan" | "amber";
  status: string;
}) {
  const accentBorder = {
    rose: "group-hover:border-rose-400/40 dark:group-hover:border-rose-500/40",
    cyan: "group-hover:border-cyan-400/40 dark:group-hover:border-cyan-500/40",
    amber: "group-hover:border-amber-400/40 dark:group-hover:border-amber-500/40",
  }[colorTheme];

  const dotColor = {
    rose: "bg-rose-500",
    cyan: "bg-cyan-500",
    amber: "bg-amber-500",
  }[colorTheme];

  return (
    <div
      className={`group relative flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 transition-all duration-200 hover:bg-white hover:shadow-xs dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:bg-slate-900/60 ${accentBorder}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
          <p className="text-[11px] font-semibold tracking-wide text-slate-700 dark:text-slate-300">
            {label}
          </p>
          <span className="hidden text-[10px] text-slate-400 sm:inline dark:text-slate-500">
            · {subtext}
          </span>
        </div>

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            {value}
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {unit}
          </span>
          <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {status}
          </span>
        </div>
      </div>

      <div className="shrink-0 pl-2">
        <TrendIndicator trend={trend} />
      </div>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: TrendState }) {
  if (trend.direction === "up") {
    return (
      <span
        title={trend.srText}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300"
      >
        <span aria-hidden="true" className="text-xs">
          ↑
        </span>
        <span className="font-mono text-[11px] font-semibold">{trend.deltaText}</span>
        <span className="sr-only">{trend.srText}</span>
      </span>
    );
  }

  if (trend.direction === "down") {
    return (
      <span
        title={trend.srText}
        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/50 dark:text-rose-300"
      >
        <span aria-hidden="true" className="text-xs">
          ↓
        </span>
        <span className="font-mono text-[11px] font-semibold">{trend.deltaText}</span>
        <span className="sr-only">{trend.srText}</span>
      </span>
    );
  }

  if (trend.direction === "neutral") {
    return (
      <span
        title={trend.srText}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      >
        <span aria-hidden="true" className="text-xs">
          —
        </span>
        <span className="font-mono text-[11px] font-semibold">{trend.deltaText}</span>
        <span className="sr-only">{trend.srText}</span>
      </span>
    );
  }

  return (
    <span
      title={trend.srText}
      className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
    >
      <span>—</span>
      <span className="sr-only">{trend.srText}</span>
    </span>
  );
}