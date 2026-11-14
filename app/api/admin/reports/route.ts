import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin, listAllUsers } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get("timeRange") || "7d"; // "24h" | "7d" | "30d" | "all"
  const astronautId = searchParams.get("astronautId"); // null or specific user_id

  try {
    let cutoffIso: string | null = null;
    const now = Date.now();
    if (timeRange === "24h") {
      cutoffIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    } else if (timeRange === "7d") {
      cutoffIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeRange === "30d") {
      cutoffIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Build readings query
    let vitalsQuery = supabaseAdmin
      .from("vital_readings")
      .select("*")
      .order("recorded_at", { ascending: true });

    if (cutoffIso) {
      vitalsQuery = vitalsQuery.gte("recorded_at", cutoffIso);
    }
    if (astronautId && astronautId !== "all") {
      vitalsQuery = vitalsQuery.eq("user_id", astronautId);
    }

    // Build sleep query
    let sleepQuery = supabaseAdmin
      .from("sleep_reports")
      .select("*")
      .order("submitted_at", { ascending: true });

    if (cutoffIso) {
      sleepQuery = sleepQuery.gte("submitted_at", cutoffIso);
    }
    if (astronautId && astronautId !== "all") {
      sleepQuery = sleepQuery.eq("user_id", astronautId);
    }

    // Build alerts query
    let alertsQuery = supabaseAdmin
      .from("health_insights")
      .select("*")
      .order("created_at", { ascending: true });

    if (cutoffIso) {
      alertsQuery = alertsQuery.gte("created_at", cutoffIso);
    }
    if (astronautId && astronautId !== "all") {
      alertsQuery = alertsQuery.eq("user_id", astronautId);
    }

    const [
      { data: vitals },
      { data: sleep },
      { data: alerts },
      { data: profiles },
      allUsers,
    ] = await Promise.all([
      vitalsQuery,
      sleepQuery,
      alertsQuery,
      supabaseAdmin.from("profiles").select("*"),
      listAllUsers(),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const astronautsList = allUsers.map((u) => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        name: p?.full_name || u.email?.split("@")[0].toUpperCase() || "Astronaut",
        astronautId: p?.astronaut_id || `AST-${u.id.slice(0, 8).toUpperCase()}`,
        email: u.email || "",
      };
    });

    // Format vitals series
    const vitalsSeries = (vitals || []).map((v) => {
      const p = profileMap.get(v.user_id);
      const u = userMap.get(v.user_id);
      return {
        id: v.id,
        userId: v.user_id,
        astronautName: p?.full_name || u?.email?.split("@")[0] || "Astronaut",
        recordedAt: v.recorded_at,
        timeFormatted: new Date(v.recorded_at).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        heartRate: v.heart_rate,
        spo2: v.spo2,
        temperature: v.temperature_c,
      };
    });

    // Format sleep series
    const sleepSeries = (sleep || []).map((s) => {
      const p = profileMap.get(s.user_id);
      const u = userMap.get(s.user_id);
      return {
        id: s.id,
        userId: s.user_id,
        astronautName: p?.full_name || u?.email?.split("@")[0] || "Astronaut",
        submittedAt: s.submitted_at,
        dateFormatted: new Date(s.submitted_at).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }),
        sleepMinutes: s.sleep_minutes,
        sleepHours: Number((s.sleep_minutes / 60).toFixed(2)),
      };
    });

    // Compute metrics & aggregates
    const hrValues = vitalsSeries
      .map((v) => v.heartRate)
      .filter((v): v is number => typeof v === "number");
    const spo2Values = vitalsSeries
      .map((v) => v.spo2)
      .filter((v): v is number => typeof v === "number");
    const tempValues = vitalsSeries
      .map((v) => v.temperature)
      .filter((v): v is number => typeof v === "number");
    const sleepValues = sleepSeries
      .map((s) => s.sleepHours)
      .filter((s): s is number => typeof s === "number");

    const aggregates = {
      readingsCount: vitalsSeries.length,
      sleepReportsCount: sleepSeries.length,
      alertsCount: (alerts || []).length,
      avgHeartRate: hrValues.length
        ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
        : null,
      minHeartRate: hrValues.length ? Math.min(...hrValues) : null,
      maxHeartRate: hrValues.length ? Math.max(...hrValues) : null,
      avgSpO2: spo2Values.length
        ? Number(
            (spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length).toFixed(1)
          )
        : null,
      minSpO2: spo2Values.length ? Math.min(...spo2Values) : null,
      maxSpO2: spo2Values.length ? Math.max(...spo2Values) : null,
      avgTemperature: tempValues.length
        ? Number(
            (tempValues.reduce((a, b) => a + b, 0) / tempValues.length).toFixed(1)
          )
        : null,
      minTemperature: tempValues.length ? Math.min(...tempValues) : null,
      maxTemperature: tempValues.length ? Math.max(...tempValues) : null,
      avgSleepHours: sleepValues.length
        ? Number(
            (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length).toFixed(1)
          )
        : null,
    };

    // Severity & Rule Breakdown for anomaly trends
    const severityCount = {
      critical: (alerts || []).filter((a) => a.severity === "critical").length,
      warning: (alerts || []).filter((a) => a.severity === "warning").length,
      info: (alerts || []).filter((a) => a.severity === "info").length,
    };

    const ruleBreakdown: Record<string, number> = {};
    for (const a of alerts || []) {
      const key = a.rule_key || "other";
      ruleBreakdown[key] = (ruleBreakdown[key] || 0) + 1;
    }

    return NextResponse.json({
      aggregates,
      severityCount,
      ruleBreakdown,
      vitalsSeries,
      sleepSeries,
      recentAlerts: (alerts || []).slice(-10).reverse().map((a) => ({
        ...a,
        astronautName:
          profileMap.get(a.user_id)?.full_name ||
          userMap.get(a.user_id)?.email?.split("@")[0] ||
          "Astronaut",
      })),
      astronautsList,
    });
  } catch (error) {
    console.error("Admin reports query error:", error);
    return NextResponse.json(
      { error: "Failed to generate health reports." },
      { status: 500 }
    );
  }
}
