import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { evaluateVitals } from "@/lib/health-rules";

export async function POST(request: Request) {
  try {
    // Verify the device token
    const deviceToken = request.headers.get("x-device-token");

    if (
      !process.env.ORBIT_DEVICE_TOKEN ||
      deviceToken !== process.env.ORBIT_DEVICE_TOKEN
    ) {
      return NextResponse.json(
        { error: "Unauthorized device" },
        { status: 401 }
      );
    }

    // Get the astronaut account assigned to this device
    const userId = process.env.ORBIT_DEVICE_USER_ID;

    if (!userId) {
      return NextResponse.json(
        { error: "Device user is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    const heartRate = body.heartRate;
    const spo2 = body.spo2;
    const temperatureC = body.temperatureC;

    // Validate incoming measurements
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

    // Save the reading using the server-only admin client
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

    // Run the health rules engine
    const insights = evaluateVitals({
      id: data.id,
      heart_rate: data.heart_rate,
      spo2: data.spo2,
      temperature_c: data.temperature_c,
      recorded_at: data.recorded_at,
    });

    // Save generated insights
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
        console.error("Device insight insert failed:", insightError.message);
      } else if (saved) {
        savedInsights.push(saved);
      }
    }

    return NextResponse.json(
      {
        success: true,
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
