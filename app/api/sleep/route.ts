
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { evaluateSleep } from "@/lib/health-rules";


export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Please sign in first." },
      { status: 401 }
    );
  }

  const cutoff = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  // Fetch historical sleep reports for the chart.
  const { data: reports, error: reportsError } = await supabase
    .from("sleep_reports")
    .select("id, sleep_minutes, submitted_at")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: true })
    .limit(100);

  if (reportsError) {
    console.error("Sleep history lookup failed:", reportsError);

    return NextResponse.json(
      { error: "Could not fetch sleep history." },
      { status: 500 }
    );
  }

  // Find the latest report within the rolling 24-hour window.
  const recentReport =
    [...(reports ?? [])]
      .filter(
        (report) =>
          new Date(report.submitted_at).getTime() >=
          new Date(cutoff).getTime()
      )
      .sort(
        (a, b) =>
          new Date(b.submitted_at).getTime() -
          new Date(a.submitted_at).getTime()
      )[0] ?? null;

  return NextResponse.json({
    shouldPrompt: !recentReport,
    lastReport: recentReport,
    reports: reports ?? [],
  });
}


export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Please sign in first." },
      { status: 401 }
    );
  }

  let body: { sleepMinutes?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const sleepMinutes = body.sleepMinutes;

  if (
    typeof sleepMinutes !== "number" ||
    !Number.isInteger(sleepMinutes) ||
    sleepMinutes < 0 ||
    sleepMinutes > 1440
  ) {
    return NextResponse.json(
      { error: "Sleep must be between 0 and 1440 whole minutes." },
      { status: 400 }
    );
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Check the rolling 24-hour window before inserting.
  const { data: recent, error: lookupError } = await supabase
    .from("sleep_reports")
    .select("id")
    .eq("user_id", user.id)
    .gte("submitted_at", cutoff)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("Sleep duplicate check failed:", lookupError);
    return NextResponse.json(
      { error: "Could not check recent sleep reports." },
      { status: 500 }
    );
  }

  if (recent) {
    return NextResponse.json(
      { error: "You have already submitted a sleep report in the last 24 hours." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("sleep_reports")
    .insert({
      user_id: user.id,
      sleep_minutes: sleepMinutes,
    })
    .select("id, sleep_minutes, submitted_at")
    .single();

  if (error) {
    console.error("Sleep report save failed:", error);
    return NextResponse.json(
      { error: "Could not save sleep report." },
      { status: 500 }
    );
  }

  // Evaluate the newly saved sleep report.
  const insights = evaluateSleep({
    id: data.id,
    sleep_minutes: data.sleep_minutes,
    submitted_at: data.submitted_at,
  });

  // Save generated sleep insights using the existing alert system.
  const savedInsights = [];
  const insightErrors = [];

  for (const insight of insights) {
    const {
      data: savedInsight,
      error: insightError,
    } = await supabase
      .from("health_insights")
      .insert({
        user_id: user.id,
        reading_id: null,
        ...insight,
      })
      .select()
      .single();

    if (insightError) {
      console.error(
        "Failed to save sleep insight:",
        insightError.code,
        insightError.message
      );

      insightErrors.push({
        rule_key: insight.rule_key,
        code: insightError.code,
        error: insightError.message,
      });

      continue;
    }

    if (savedInsight) {
      savedInsights.push(savedInsight);
    }
  }

  return NextResponse.json(
    {
      report: data,
      insights: savedInsights,
      insightErrors,
    },
    { status: 201 }
  );
}
