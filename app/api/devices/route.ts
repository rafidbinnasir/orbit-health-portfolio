
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

// List the signed-in user's devices
export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_devices")
      .select("id, device_name, created_at, last_seen_at, revoked_at")
      .eq("user_id", user.id)
.is("revoked_at", null)
.order("created_at", { ascending: false });

    if (error) {
      console.error("Device list failed:", error.message);
      return NextResponse.json(
        { error: "Could not load devices" },
        { status: 500 }
      );
    }

    return NextResponse.json({ devices: data ?? [] });
  } catch (error) {
    console.error("Device list error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

// Register a new device
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const deviceName = body.deviceName;

    if (
      typeof deviceName !== "string" ||
      deviceName.trim().length < 1 ||
      deviceName.trim().length > 80
    ) {
      return NextResponse.json(
        { error: "Device name must be between 1 and 80 characters" },
        { status: 400 }
      );
    }

    const { count, error: countError } = await supabaseAdmin
      .from("user_devices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    if (countError) {
      console.error("Device count failed:", countError.message);
      return NextResponse.json(
        { error: "Could not check registered devices" },
        { status: 500 }
      );
    }

    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: "Maximum of 10 active devices reached" },
        { status: 400 }
      );
    }

    const deviceToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(deviceToken)
      .digest("hex");

    const { data: device, error: insertError } = await supabaseAdmin
      .from("user_devices")
      .insert({
        user_id: user.id,
        device_name: deviceName.trim(),
        token_hash: tokenHash,
      })
      .select("id, device_name, created_at")
      .single();

    if (insertError) {
      console.error("Device registration failed:", insertError.message);
      return NextResponse.json(
        { error: "Could not register device" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        device,
        deviceToken,
        message: "Save this token securely. It will not be shown again.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Device registration error:", error);
    return NextResponse.json(
      { error: "Invalid request or server error" },
      { status: 400 }
    );
  }
}

// Revoke one of the signed-in user's devices
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const deviceId = body.deviceId;

    if (typeof deviceId !== "string" || !deviceId.trim()) {
      return NextResponse.json(
        { error: "A device ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("user_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", deviceId)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Device revocation failed:", error.message);
      return NextResponse.json(
        { error: "Could not revoke device" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Device not found or already revoked" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Device revocation error:", error);
    return NextResponse.json(
      { error: "Invalid request or server error" },
      { status: 400 }
    );
  }
}
