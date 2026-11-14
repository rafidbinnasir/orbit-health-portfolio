import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin, listAllUsers } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const selectedAstronautId = searchParams.get("astronautId");

  try {
    const [
      allUsers,
      { data: profiles },
      { data: roles },
      { data: allVitals },
      { data: allInsights },
      { data: allSleep },
    ] = await Promise.all([
      listAllUsers(),
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("*"),
      supabaseAdmin
        .from("vital_readings")
        .select("*")
        .order("recorded_at", { ascending: false }),
      supabaseAdmin
        .from("health_insights")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("sleep_reports")
        .select("*")
        .order("submitted_at", { ascending: false }),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));

    // Group vitals, insights, sleep by user_id
    const vitalsByUser = new Map<string, any[]>();
    for (const v of allVitals || []) {
      const list = vitalsByUser.get(v.user_id) || [];
      list.push(v);
      vitalsByUser.set(v.user_id, list);
    }

    const insightsByUser = new Map<string, any[]>();
    for (const i of allInsights || []) {
      const list = insightsByUser.get(i.user_id) || [];
      list.push(i);
      insightsByUser.set(i.user_id, list);
    }

    const sleepByUser = new Map<string, any[]>();
    for (const s of allSleep || []) {
      const list = sleepByUser.get(s.user_id) || [];
      list.push(s);
      sleepByUser.set(s.user_id, list);
    }

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const astronauts = allUsers.map((u) => {
      const p = profileMap.get(u.id);
      const userReadings = vitalsByUser.get(u.id) || [];
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
        } else {
          telemetryStatus = "outdated";
        }
      }

      return {
        id: u.id,
        email: u.email || "",
        fullName:
          p?.full_name || u.email?.split("@")[0].toUpperCase() || "Astronaut",
        astronautId: p?.astronaut_id || `AST-${u.id.slice(0, 8).toUpperCase()}`,
        missionName: p?.mission_name || "LEO Expedition",
        avatarUrl: p?.avatar_url || null,
        role: roleMap.get(u.id) || "astronaut",
        telemetryStatus,
        latestReading,
        totalReadings: userReadings.length,
        activeAlertsCount: activeAlerts.length,
        criticalAlertsCount: criticalCount,
        warningAlertsCount: warningCount,
      };
    });

    let selectedAstronautDetail: any = null;
    if (selectedAstronautId) {
      const targetUser = allUsers.find((u) => u.id === selectedAstronautId);
      if (targetUser) {
        const targetProfile = profileMap.get(targetUser.id);
        const targetReadings = vitalsByUser.get(targetUser.id) || [];
        const targetInsights = insightsByUser.get(targetUser.id) || [];
        const targetSleep = sleepByUser.get(targetUser.id) || [];

        selectedAstronautDetail = {
          id: targetUser.id,
          email: targetUser.email || "",
          fullName:
            targetProfile?.full_name ||
            targetUser.email?.split("@")[0].toUpperCase() ||
            "Astronaut",
          astronautId:
            targetProfile?.astronaut_id ||
            `AST-${targetUser.id.slice(0, 8).toUpperCase()}`,
          missionName: targetProfile?.mission_name || "LEO Expedition",
          avatarUrl: targetProfile?.avatar_url || null,
          role: roleMap.get(targetUser.id) || "astronaut",
          createdAt: targetUser.created_at,
          readings: targetReadings.slice(0, 50),
          insights: targetInsights,
          sleepReports: targetSleep,
        };
      }
    }

    return NextResponse.json({
      astronauts,
      selectedDetail: selectedAstronautDetail,
    });
  } catch (error) {
    console.error("Monitoring fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch astronaut monitoring data." },
      { status: 500 }
    );
  }
}
