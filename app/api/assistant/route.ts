import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  // 1. Check server-side Gemini API key configuration
  const requestStarted = performance.now();

const logTiming = (stage: string, started: number) => {
  console.info(
    `[ORBIT AI Timing] ${stage}: ${
      (performance.now() - started).toFixed(0)
    } ms`
  );
};
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI assistant service is currently unavailable. Server configuration required.",
      },
      { status: 503 }
    );
  }

  // 2. Verify authenticated user session server-side via Supabase SSR client
  const authStarted = performance.now();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  logTiming("Authentication", authStarted);

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 3. Parse and validate incoming JSON payload
  let body: unknown;
  const vitalsStarted = performance.now();
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }
logTiming("Vital readings", vitalsStarted);

  if (
    !body ||
    typeof body !== "object" ||
    !("message" in body) ||
    typeof (body as { message: unknown }).message !== "string"
  ) {
    return NextResponse.json(
      { error: "Field 'message' is required and must be a string." },
      { status: 400 }
    );
  }

  const userMessage = (body as { message: string }).message.trim();

  if (!userMessage) {
    return NextResponse.json(
      { error: "Message cannot be empty." },
      { status: 400 }
    );
  }

  if (userMessage.length > 2000) {
    return NextResponse.json(
      {
        error:
          "Message exceeds maximum allowed length of 2,000 characters.",
      },
      { status: 400 }
    );
  }

  // 4. Safely query only the authenticated user's authorized vital readings under RLS
  let vitalsSummary = "No recent vital signs recorded for this astronaut.";
  let vitalsNotice = "";

  try {
    const { data: vitals, error: vitalsError } = await supabase
      .from("vital_readings")
      .select("heart_rate, spo2, temperature_c, recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (vitalsError) {
      console.error("Vitals query error:", vitalsError.message);
      vitalsNotice =
        "Note: Could not retrieve recent vital readings from database. Answering general health questions only.";
    } else if (vitals && vitals.length > 0) {
      vitalsSummary = vitals
        .map(
          (v, idx) =>
            `[Reading ${idx + 1}] Timestamp: ${v.recorded_at} | Heart Rate: ${
              v.heart_rate ?? "N/A"
            } BPM | SpO2: ${v.spo2 ?? "N/A"}% | Temp: ${
              v.temperature_c ?? "N/A"
            } °C`
        )
        .join("\n");
    }
  } catch (err) {
    console.error(
      "Vitals fetch failure:",
      err instanceof Error ? err.message : "Unknown query error"
    );
    vitalsNotice =
      "Note: Could not access private vitals data. Answering general health questions only.";
  }

  // 5. Build system instruction with medical safety, brevity, and organized structure
  const systemInstruction = `
You are the ORBIT Health Flight Surgeon AI Assistant for astronauts onboard the mission network.

=== CRITICAL RESPONSE FORMAT & BREVITY RULES ===
1. CONCISE & DIRECT: Keep responses under 100-140 words. Get straight to the key point without introductory pleasantries or repeating disclaimers (a medical disclaimer is already pinned in the UI).
2. HIGHLY ORGANIZED: Structure assessments with clean bullet points and bold labels (e.g., • **Metric / Finding:** Direct observation).
3. ACTIONABLE SUMMARY: Conclude with 1 brief recommendation or telemetry status.
4. MEDICAL BOUNDARIES: Do not provide official clinical diagnoses. If vital signs show severe crisis (e.g. SpO2 < 90%, extreme tachycardia > 160 BPM, chest pain), immediately and emphatically direct the astronaut to contact the Flight Surgeon or emergency medical officer.
5. DATA INTEGRITY: Only consider the verified database telemetry below as authoritative.

=== AUTHENTICATED ASTRONAUT'S VERIFIED RECENT READINGS (MOST RECENT FIRST) ===
${vitalsNotice ? vitalsNotice : vitalsSummary}
`.trim();

  // 6. Invoke Gemini API securely using the official @google/genai SDK
  try {
    const geminiStarted = performance.now();
    const ai = new GoogleGenAI({ apiKey });
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: userMessage,
        config: {
          systemInstruction,
          maxOutputTokens: 350,
          temperature: 0.2,
        },
      });
    } catch (primaryErr) {
      console.warn(
        "Primary model failed, attempting fallback:",
        primaryErr instanceof Error ? primaryErr.message : primaryErr
      );
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMessage,
        config: {
          systemInstruction,
          maxOutputTokens: 350,
          temperature: 0.2,
        },
      });
    }
    logTiming("Gemini generation", geminiStarted);
logTiming("Total request", requestStarted);

    const reply =
      response.text ??
      "I was unable to formulate a response. Please try rephrasing your question.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error(
      "Gemini API request failed:",
      err instanceof Error ? err.message : "Unknown error"
    );

    return NextResponse.json(
      {
        error:
          "Failed to generate health advice. Please try again later.",
      },
      { status: 500 }
    );
  }
}
