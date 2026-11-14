import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid alert ID." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!["acknowledged", "resolved", "active"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid alert status requested." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {
      status,
    };

    if (status === "resolved") {
      updatePayload.resolved_at = new Date().toISOString();
    } else if (status === "active") {
      updatePayload.resolved_at = null;
    }

    const { data, error } = await supabaseAdmin
      .from("health_insights")
      .update(updatePayload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ alert: data, success: true });
  } catch (error) {
    console.error("Failed to update alert:", error);
    return NextResponse.json(
      { error: "Unable to update alert." },
      { status: 500 }
    );
  }
}
