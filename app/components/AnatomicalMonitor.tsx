"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { OrganId } from "./AnatomicalScene";

// Dynamically import client-only 3D scene to prevent SSR WebGL execution
const AnatomicalScene = dynamic(() => import("./AnatomicalScene"), {
  ssr: false,
  loading: () => <AnatomicalSkeleton />,
});

export type VitalReading = {
  id: number;
  heart_rate: number | null;
  spo2: number | null;
  temperature_c: number | null;
  recorded_at: string;
};

type AnatomicalMonitorProps = {
  readings?: VitalReading[];
  loading?: boolean;
};

type OrganMetadata = {
  id: OrganId;
  label: string;
  category: string;
  hasDirectTelemetry: boolean;
  description: string;
  clinicalNote: string;
};

const ORGAN_METADATA: Record<OrganId, OrganMetadata> = {
  heart: {
    id: "heart",
    label: "Heart & Cardiovascular",
    category: "Cardiopulmonary Stream",
    hasDirectTelemetry: true,
    description:
      "Dual-ventricular myocardium, coronary vasculature, ascending aorta, and pulmonary trunk.",
    clinicalNote:
      "Active streaming telemetry from digital suit biometric sensors (electrocardiograph & optical plethysmography).",
  },
  lungs: {
    id: "lungs",
    label: "Pulmonary System (Lungs & Bronchi)",
    category: "Respiratory Airway",
    hasDirectTelemetry: false,
    description:
      "Trachea with 16 cartilaginous rings, primary/secondary bronchi, and bilateral lung lobes.",
    clinicalNote:
      "No direct spirometry or tidal volume sensor online. Peripheral SpO₂ serves as an indirect oxygenation indicator.",
  },
  liver: {
    id: "liver",
    label: "Hepatic System (Liver)",
    category: "Metabolic / Clearance",
    hasDirectTelemetry: false,
    description:
      "Asymmetric hepatic lobes with falciform groove and vascular hepatic integration.",
    clinicalNote:
      "No dedicated hepatic telemetry channel is currently online. Hepatic enzyme and clearance panels require biochemical analysis.",
  },
  kidneys: {
    id: "kidneys",
    label: "Renal System (Kidneys & Ureters)",
    category: "Filtration & Hydration",
    hasDirectTelemetry: false,
    description:
      "Bilateral kidneys with hilar concavity, renal pelvis, and connected descending ureters.",
    clinicalNote:
      "No dedicated renal telemetry sensor is deployed. Glomerular filtration and electrolyte balance are evaluated via lab sampling.",
  },
  stomach: {
    id: "stomach",
    label: "Gastric System (Stomach)",
    category: "Upper Gastrointestinal",
    hasDirectTelemetry: false,
    description:
      "Stomach fundus, body, pyloric antrum, and esophageal anatomical junction.",
    clinicalNote:
      "No direct gastric pressure or motility sensors are online. Monitored via systemic core temperature baseline.",
  },
  intestines: {
    id: "intestines",
    label: "Intestinal Tract (Bowel & Colon)",
    category: "Lower Gastrointestinal",
    hasDirectTelemetry: false,
    description:
      "Convoluted small bowel course, large intestine cecum, ascending/descending colon, and sigmoid colon.",
    clinicalNote:
      "No continuous enteric telemetry is currently deployed. Systemic parameters are observed for acute abdominal events.",
  },
};

function AnatomicalSkeleton() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7 animate-pulse"
        >
          <path d="M12 2v20M2 12h20M7 7l10 10M17 7 7 17" />
        </svg>
      </div>
      <p className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-200">
        Initializing 3D Anatomical Telemetry...
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Loading WebGL shaders and model meshes
      </p>
    </div>
  );
}

export default function AnatomicalMonitor({
  readings = [],
}: AnatomicalMonitorProps) {
  const [selectedOrgan, setSelectedOrgan] = useState<OrganId | null>("heart");
  const [shellXRay, setShellXRay] = useState(true);

  const latestReading = readings[0];
  const activeMeta = selectedOrgan ? ORGAN_METADATA[selectedOrgan] : null;

  return (
    <section
      id="anatomy"
      aria-labelledby="anatomical-monitor-heading"
      className="scroll-mt-24 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md transition-colors duration-200 sm:p-7 dark:border-slate-800 dark:bg-slate-900/90"
    >
      {/* HEADER */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800/70">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              Biometric Visualization
            </p>
          </div>
          <h2
            id="anatomical-monitor-heading"
            className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white"
          >
            3D Anatomical Telemetry Monitor
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
            Interactive anatomical model with targeted biometric mapping. Rotate, zoom, and inspect organs in real time.
          </p>
        </div>

        {/* CONTROLS: X-Ray Shell Toggle & Model Status */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShellXRay((prev) => !prev)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              shellXRay
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-300"
                : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
            title="Toggle outer torso skin transparency"
          >
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 0 0 20Z" />
            </svg>
            <span>{shellXRay ? "Holo X-Ray: ON" : "Holo X-Ray: OFF"}</span>
          </button>
        </div>
      </div>

      {/* QUICK ORGAN SELECTOR PILLS */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Target Organ:
        </span>
        {(Object.keys(ORGAN_METADATA) as OrganId[]).map((key) => {
          const item = ORGAN_METADATA[key];
          const isSelected = selectedOrgan === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedOrgan(key)}
              className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold transition active:scale-95 ${
                isSelected
                  ? "border-cyan-500 bg-cyan-500 text-white shadow-sm dark:border-cyan-400 dark:bg-cyan-500 dark:text-slate-950"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-400 hover:bg-cyan-50/50 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300"
              }`}
            >
              {item.label.split(" ")[0]}
              {key === "heart" && latestReading?.heart_rate && (
                <span className="ml-1.5 rounded bg-black/20 px-1 py-0.2 text-[10px] font-mono">
                  {latestReading.heart_rate} BPM
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3D VIEWPORT CONTAINER */}
      <div className="relative h-[480px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-inner sm:h-[540px]">
        {/* Subtle Mission Control Grid Overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(8,145,178,0.12),transparent_70%)] opacity-70"
        />

        {/* 3D WebGL Canvas */}
        <AnatomicalScene
          selectedOrgan={selectedOrgan}
          onSelectOrgan={(organ) => setSelectedOrgan(organ)}
          shellXRay={shellXRay}
        />

        {/* VIEWPORT CONTROLS / HINTS OVERLAY (Bottom-left) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-cyan-400"
          >
            <path d="m15 15 6 6m-6-6v4.5m0-4.5h4.5" />
            <path d="M9 9 3 3m6 6V4.5M9 9H4.5" />
          </svg>
          <span>Drag to rotate · Scroll to zoom · Click organ to inspect</span>
        </div>

        {/* FLOATING ORGAN TELEMETRY PANEL (Beside / Over Model) */}
        {activeMeta && (
          <aside
            aria-label={`${activeMeta.label} Telemetry Panel`}
            className="absolute right-3 top-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-2xl border border-cyan-500/40 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur-xl sm:right-4 sm:top-4 sm:w-92 sm:p-5"
          >
            {/* PANEL HEADER WITH CLOSE BUTTON */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      activeMeta.hasDirectTelemetry
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-amber-400"
                    }`}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                    {activeMeta.category}
                  </span>
                </div>
                <h3 className="mt-1 truncate text-base font-bold text-white sm:text-lg">
                  {activeMeta.label}
                </h3>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedOrgan(null)}
                aria-label="Close telemetry panel"
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-rose-500/50 hover:bg-rose-950/40 hover:text-rose-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* ANATOMICAL DESCRIPTION */}
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {activeMeta.description}
            </p>

            {/* LIVE SENSOR DATA DISPLAY */}
            <div className="mt-4 space-y-2.5">
              {activeMeta.id === "heart" ? (
                // REAL LIVE TELEMETRY FOR THE HEART
                <>
                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
                    <span className="text-xs text-slate-400">Heart Rate</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      {latestReading?.heart_rate ?? "—"} BPM
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
                    <span className="text-xs text-slate-400">SpO₂ (O₂ Saturation)</span>
                    <span className="font-mono text-sm font-bold text-cyan-300">
                      {latestReading?.spo2 ?? "—"}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
                    <span className="text-xs text-slate-400">Myocardial Temp</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {latestReading?.temperature_c ?? "—"} °C
                    </span>
                  </div>
                </>
              ) : activeMeta.id === "lungs" ? (
                // LUNGS: Indirect SpO2 proxy + explicit statement
                <>
                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
                    <span className="text-xs text-slate-400">Systemic SpO₂ Proxy</span>
                    <span className="font-mono text-sm font-bold text-cyan-300">
                      {latestReading?.spo2 ?? "—"}%
                    </span>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-2.5 text-[11px] leading-relaxed text-amber-200/90">
                    <span className="font-semibold text-amber-300">Sensor Status:</span>{" "}
                    Direct spirometry / tidal volume sensor is currently offline. Oxygen saturation represents systemic arterial oxygenation.
                  </div>
                </>
              ) : (
                // OTHER ORGANS (LIVER, KIDNEYS, STOMACH, INTESTINES): Truthful statement
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>No Dedicated Telemetry Channel</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                    No dedicated telemetry sensor is currently streaming for this organ. Primary vital signs (heart rate and SpO₂) monitor systemic homeostasis only.
                  </p>
                  {latestReading?.temperature_c && (
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
                      <span className="text-slate-500">Core Temp Reference:</span>
                      <span className="font-mono font-medium text-slate-300">
                        {latestReading.temperature_c} °C
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CLINICAL NOTE */}
            <p className="mt-3 text-[10px] leading-relaxed text-slate-400 border-t border-slate-800/80 pt-2.5">
              {activeMeta.clinicalNote}
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}
