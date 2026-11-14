
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid insight ID" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("health_insights")
    .update({ status: "acknowledged" })
    .eq("id", Number(id))
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("Failed to acknowledge insight:", error.message);

    return NextResponse.json(
      { error: "Could not acknowledge insight" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Active insight not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ insight: data });
}
