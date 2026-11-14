
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { evaluateVitals } from "@/lib/health-rules";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the hardware device
    const deviceToken = request.headers.get("x-device-token");

    if (!deviceToken) {
      return NextResponse.json(
        { error: "Missing device token" },
        { status: 401 }
      );
    }

    // Hash the token before looking it up in the database
    const tokenHash = createHash("sha256")
      .update(deviceToken)
      .digest("hex");

    const { data: device, error: deviceError } = await supabaseAdmin
      .from("user_devices")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (deviceError) {
      console.error("Device authentication failed:", deviceError.message);

      return NextResponse.json(
        { error: "Device authentication failed" },
        { status: 500 }
      );
    }

    if (!device) {
      return NextResponse.json(
        { error: "Invalid or revoked device token" },
        { status: 401 }
      );
    }

    const userId = device.user_id;

    // 2. Parse and validate incoming measurements
    const body = await request.json();

    const { heartRate, spo2, temperatureC } = body;

    if (
      !Number.isInteger(heartRate) ||
      heartRate < 1 ||
      heartRate > 300 ||
      typeof spo2 !== "number" ||
      !Number.isFinite(spo2) ||
      spo2 < 0 ||
      spo2 > 100 ||
      typeof temperatureC !== "number" ||
      !Number.isFinite(temperatureC) ||
      temperatureC < 20 ||
      temperatureC > 50
    ) {
      return NextResponse.json(
        { error: "Invalid vital reading values" },
        { status: 400 }
      );
    }

    // 3. Save the reading under the device owner's account
    const { data, error } = await supabaseAdmin
      .from("vital_readings")
      .insert({
        user_id: userId,
        heart_rate: heartRate,
        spo2,
        temperature_c: temperatureC,
      })
      .select()
      .single();

    if (error) {
      console.error("Device reading insert failed:", error.message);

      return NextResponse.json(
        { error: "Could not save device reading" },
        { status: 500 }
      );
    }

    // 4. Run the health rules engine
    const insights = evaluateVitals({
      id: data.id,
      heart_rate: data.heart_rate,
      spo2: data.spo2,
      temperature_c: data.temperature_c,
      recorded_at: data.recorded_at,
    });

    // 5. Save generated health insights
    const savedInsights = [];

    for (const insight of insights) {
      const { data: saved, error: insightError } = await supabaseAdmin
        .from("health_insights")
        .insert({
          user_id: userId,
          reading_id: data.id,
          ...insight,
        })
        .select()
        .single();

      if (insightError) {
        console.error(
          "Device insight insert failed:",
          insightError.message
        );
      } else if (saved) {
        savedInsights.push(saved);
      }
    }

    // 6. Update device communication timestamp
    const { error: updateError } = await supabaseAdmin
      .from("user_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    if (updateError) {
      console.error("Device last-seen update failed:", updateError.message);
    }

    return NextResponse.json(
      {
        success: true,
        deviceId: device.id,
        reading: data,
        insights: savedInsights,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Device API error:", error);

    return NextResponse.json(
      { error: "Invalid request or server error" },
      { status: 400 }
    );
  }
}
