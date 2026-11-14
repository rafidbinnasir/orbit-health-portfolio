import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin, listAllUsers } from "@/lib/supabase-admin";

export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // 1. Fetch all users and database records in parallel
    const [
      allUsers,
      { data: profiles },
      { data: roles },
      { data: allInsights },
      { data: allReadings },
      { data: sleepReports },
    ] = await Promise.all([
      listAllUsers(),
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("*"),
      supabaseAdmin
        .from("health_insights")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("vital_readings")
        .select("*")
        .order("recorded_at", { ascending: false }),
      supabaseAdmin
        .from("sleep_reports")
        .select("*")
        .order("submitted_at", { ascending: false }),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));

    // 3. Compute metrics
    const astronauts = allUsers.filter(
      (u) => (roleMap.get(u.id) || "astronaut") === "astronaut"
    );

    const activeInsights = (allInsights || []).filter(
      (i) => i.status === "active"
    );
    const criticalActive = activeInsights.filter(
      (i) => i.severity === "critical"
    );
    const warningActive = activeInsights.filter(
      (i) => i.severity === "warning"
    );
    const infoActive = activeInsights.filter((i) => i.severity === "info");

    // 4. Compute latest readings per astronaut
    const readingsByUser = new Map<string, any[]>();
    for (const r of allReadings || []) {
      const list = readingsByUser.get(r.user_id) || [];
      list.push(r);
      readingsByUser.set(r.user_id, list);
    }

    const insightsByUser = new Map<string, any[]>();
    for (const i of allInsights || []) {
      const list = insightsByUser.get(i.user_id) || [];
      list.push(i);
      insightsByUser.set(i.user_id, list);
    }

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    let activeAstronautsCount = 0;

    const astronautSummaries = allUsers.map((u) => {
      const profile = profileMap.get(u.id);
      const userReadings = readingsByUser.get(u.id) || [];
      const userInsights = insightsByUser.get(u.id) || [];
      const latestReading = userReadings[0] || null;

      const activeAlerts = userInsights.filter((i) => i.status === "active");
      const criticalCount = activeAlerts.filter(
        (i) => i.severity === "critical"
      ).length;
      const warningCount = activeAlerts.filter(
        (i) => i.severity === "warning"
      ).length;

      let telemetryStatus: "live" | "outdated" | "none" = "none";
      if (latestReading?.recorded_at) {
        const diff = now - new Date(latestReading.recorded_at).getTime();
        if (diff <= ONE_DAY_MS) {
          telemetryStatus = "live";
          activeAstronautsCount++;
        } else {
          telemetryStatus = "outdated";
        }
      }

      return {
        id: u.id,
        email: u.email || "",
        fullName:
          profile?.full_name ||
          u.email?.split("@")[0].toUpperCase() ||
          "Astronaut",
        astronautId:
          profile?.astronaut_id || `AST-${u.id.slice(0, 8).toUpperCase()}`,
        missionName: profile?.mission_name || "LEO Expedition",
        role: roleMap.get(u.id) || "astronaut",
        avatarUrl: profile?.avatar_url || null,
        telemetryStatus,
        latestReading,
        totalReadings: userReadings.length,
        activeAlertsCount: activeAlerts.length,
        criticalAlertsCount: criticalCount,
        warningAlertsCount: warningCount,
      };
    });

    // 5. Enriched recent alerts (up to 15)
    const enrichedAlerts = (allInsights || []).slice(0, 15).map((insight) => {
      const profile = profileMap.get(insight.user_id);
      const user = allUsers.find((u) => u.id === insight.user_id);
      return {
        ...insight,
        astronautName:
          profile?.full_name ||
          user?.email?.split("@")[0].toUpperCase() ||
          "Astronaut",
        astronautId:
          profile?.astronaut_id ||
          `AST-${insight.user_id.slice(0, 8).toUpperCase()}`,
        astronautEmail: user?.email || "",
      };
    });

    // 6. System averages from recent readings (last 100)
    const recentSample = (allReadings || []).slice(0, 100);
    const validHR = recentSample
      .map((r) => r.heart_rate)
      .filter((v): v is number => typeof v === "number" && !isNaN(v));
    const validSpO2 = recentSample
      .map((r) => r.spo2)
      .filter((v): v is number => typeof v === "number" && !isNaN(v));
    const validTemp = recentSample
      .map((r) => r.temperature_c)
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    const avgHR = validHR.length
      ? Math.round(validHR.reduce((a, b) => a + b, 0) / validHR.length)
      : null;
    const avgSpO2 = validSpO2.length
      ? Number(
          (validSpO2.reduce((a, b) => a + b, 0) / validSpO2.length).toFixed(1)
        )
      : null;
    const avgTemp = validTemp.length
      ? Number(
          (validTemp.reduce((a, b) => a + b, 0) / validTemp.length).toFixed(1)
        )
      : null;

    // Sleep average from recent submissions
    const validSleep = (sleepReports || [])
      .map((s) => s.sleep_minutes)
      .filter((v): v is number => typeof v === "number" && !isNaN(v));
    const avgSleepMinutes = validSleep.length
      ? Math.round(validSleep.reduce((a, b) => a + b, 0) / validSleep.length)
      : null;

    return NextResponse.json({
      metrics: {
        totalAstronauts: astronauts.length,
        totalUsers: allUsers.length,
        activeCriticalCount: criticalActive.length,
        activeWarningCount: warningActive.length,
        activeInfoCount: infoActive.length,
        totalAlertsCount: (allInsights || []).length,
        totalReadingsCount: (allReadings || []).length,
        activeAstronauts24h: activeAstronautsCount,
        totalSleepReports: (sleepReports || []).length,
      },
      averages: {
        avgHeartRate: avgHR,
        avgSpO2,
        avgTemperature: avgTemp,
        avgSleepHours: avgSleepMinutes
          ? Number((avgSleepMinutes / 60).toFixed(1))
          : null,
      },
      alerts: enrichedAlerts,
      astronauts: astronautSummaries,
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return NextResponse.json(
      { error: "Failed to generate admin overview." },
      { status: 500 }
    );
  }
}
