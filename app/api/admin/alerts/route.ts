import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin, listAllUsers } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const severityFilter = searchParams.get("severity"); // "critical" | "warning" | "info" | "all"
  const statusFilter = searchParams.get("status"); // "active" | "acknowledged" | "resolved" | "all"
  const astronautFilter = searchParams.get("astronautId");
  const searchQuery = searchParams.get("q")?.toLowerCase();

  try {
    let query = supabaseAdmin
      .from("health_insights")
      .select("*")
      .order("created_at", { ascending: false });

    if (severityFilter && severityFilter !== "all") {
      query = query.eq("severity", severityFilter);
    }

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (astronautFilter) {
      query = query.eq("user_id", astronautFilter);
    }

    const [
      { data: insights, error: insightsError },
      allUsers,
      { data: profiles },
      { data: vitals },
    ] = await Promise.all([
      query,
      listAllUsers(),
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("vital_readings").select("*"),
    ]);

    if (insightsError) {
      throw insightsError;
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const readingMap = new Map((vitals || []).map((v) => [v.id, v]));

    let enriched = (insights || []).map((item) => {
      const profile = profileMap.get(item.user_id);
      const user = userMap.get(item.user_id);
      const reading = item.reading_id ? readingMap.get(item.reading_id) : null;

      return {
        ...item,
        astronautName:
          profile?.full_name ||
          user?.email?.split("@")[0].toUpperCase() ||
          "Astronaut",
        astronautId:
          profile?.astronaut_id ||
          `AST-${item.user_id.slice(0, 8).toUpperCase()}`,
        astronautEmail: user?.email || "",
        reading: reading || null,
      };
    });

    if (searchQuery) {
      enriched = enriched.filter(
        (i) =>
          i.title?.toLowerCase().includes(searchQuery) ||
          i.description?.toLowerCase().includes(searchQuery) ||
          i.astronautName?.toLowerCase().includes(searchQuery) ||
          i.astronautId?.toLowerCase().includes(searchQuery) ||
          i.astronautEmail?.toLowerCase().includes(searchQuery) ||
          i.rule_key?.toLowerCase().includes(searchQuery)
      );
    }

    // Counts for tabs
    const allAlerts = insights || [];
    const counts = {
      total: allAlerts.length,
      critical: allAlerts.filter((i) => i.severity === "critical").length,
      warning: allAlerts.filter((i) => i.severity === "warning").length,
      info: allAlerts.filter((i) => i.severity === "info").length,
      active: allAlerts.filter((i) => i.status === "active").length,
      acknowledged: allAlerts.filter((i) => i.status === "acknowledged").length,
      resolved: allAlerts.filter((i) => i.status === "resolved").length,
    };

    return NextResponse.json({
      alerts: enriched,
      counts,
    });
  } catch (error) {
    console.error("Admin alerts fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch health alerts." },
      { status: 500 }
    );
  }
}
