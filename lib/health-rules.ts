
export type VitalReading = {
  id: number;
  heart_rate: number | null;
  spo2: number | null;
  temperature_c: number | null;
  recorded_at: string;
};

export type HealthInsight = {
  rule_key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommended_action: string;
  evidence: Record<string, number | string>;
};

export function evaluateVitals(reading: VitalReading): HealthInsight[] {
  const insights: HealthInsight[] = [];

  // SpO2: critical below 90%; warning below 95%.
  if (reading.spo2 != null && Number.isFinite(reading.spo2)) {
    if (reading.spo2 < 90) {
      insights.push({
        rule_key: "low_spo2_critical",
        severity: "critical",
        title: `Critical Low Oxygen Saturation (${reading.spo2}%)`,
       description: "",
        recommended_action:
          "Immediately verify that the sensor is attached correctly and repeat the measurement using an approved method. " +
          "Check the quality and consistency of the signal, review the astronaut's symptoms and other available vital signs, " +
          "and notify the responsible medical team according to the mission escalation protocol. " +
          "Do not dismiss a persistently low reading as a sensor fault.",
        evidence: { spo2: reading.spo2, threshold: 90, unit: "%" },
      });
    } else if (reading.spo2 < 95) {
      insights.push({
        rule_key: "low_spo2_warning",
        severity: "warning",
        title: `Low Oxygen Saturation (${reading.spo2}%)`,
       description: "",
        recommended_action:
          "Check sensor placement, skin contact, and signal quality, then repeat the measurement. " +
          "Compare the result with recent readings and the mission's approved operating limits. " +
          "If the value falls further, persists, or symptoms occur, escalate according to the medical response protocol.",
        evidence: { spo2: reading.spo2, threshold: 95, unit: "%" },
      });
    }
  }

  // Heart rate: illustrative thresholds for prototype classification.
  if (reading.heart_rate != null && Number.isFinite(reading.heart_rate)) {
    if (reading.heart_rate > 140) {
      insights.push({
        rule_key: "high_heart_rate_critical",
        severity: "critical",
        title: `Critical High Heart Rate (${reading.heart_rate} BPM)`,
        description: "",
        recommended_action:
          "Verify the sensor signal and repeat the measurement promptly. Review activity level, symptoms, " +
          "recent heart-rate trends, and other available vital signs. Notify the responsible medical team " +
          "immediately according to the mission escalation protocol, particularly if the rate remains elevated " +
          "or the astronaut reports chest discomfort, breathlessness, dizziness, or faintness.",
        evidence: { heart_rate: reading.heart_rate, threshold: 140, unit: "BPM" },
      });
    } else if (reading.heart_rate > 120) {
      insights.push({
        rule_key: "high_heart_rate_warning",
        severity: "warning",
        title: `Elevated Heart Rate (${reading.heart_rate} BPM)`,
       description: "",
        recommended_action:
          "Check sensor contact and signal quality, record whether the astronaut is resting or exercising, " +
          "and repeat the measurement after an appropriate period of rest if safe to do so. " +
          "Review the trend and other symptoms. Escalate if the reading persists, rises into the critical range, " +
          "or the mission's medical protocol requires earlier review.",
        evidence: { heart_rate: reading.heart_rate, threshold: 120, unit: "BPM" },
      });
    } else if (reading.heart_rate < 40) {
      insights.push({
        rule_key: "low_heart_rate_critical",
        severity: "critical",
        title: `Critical Low Heart Rate (${reading.heart_rate} BPM)`,
       description: "",
        recommended_action:
          "Promptly verify sensor contact and repeat the measurement using an approved method. " +
          "Assess symptoms and available cardiac data, and notify the responsible medical team immediately " +
          "under the mission escalation protocol. If the astronaut is faint, confused, breathless, or otherwise unwell, " +
          "follow the emergency response procedure.",
        evidence: { heart_rate: reading.heart_rate, threshold: 40, unit: "BPM" },
      });
    } else if (reading.heart_rate < 50) {
      insights.push({
        rule_key: "low_heart_rate_warning",
        severity: "warning",
        title: `Low Heart Rate (${reading.heart_rate} BPM)`,
        description: "",
        recommended_action:
          "Check sensor placement and repeat the measurement. Review the astronaut's baseline and recent readings, " +
          "and check for dizziness, unusual fatigue, or faintness. Follow the mission's escalation protocol if the " +
          "reading persists, symptoms occur, or the value enters the critical range.",
        evidence: { heart_rate: reading.heart_rate, threshold: 50, unit: "BPM" },
      });
    }
  }

  // Temperature: illustrative prototype thresholds.
  if (
    reading.temperature_c != null &&
    Number.isFinite(reading.temperature_c)
  ) {
    if (reading.temperature_c >= 39) {
      insights.push({
        rule_key: "high_temperature_critical",
        severity: "critical",
        title: `Critical High Temperature (${reading.temperature_c}°C)`,
       description: "",
        recommended_action:
          "Verify the measurement method and repeat the reading promptly. Review the trend, sensor reliability, " +
          "environmental conditions, and other available vital signs. Notify the responsible medical team immediately " +
          "according to the mission escalation protocol. Do not rely on this reading alone to diagnose a cause.",
        evidence: { temperature_c: reading.temperature_c, threshold: 39, unit: "°C" },
      });
    } else if (reading.temperature_c >= 38) {
      insights.push({
        rule_key: "high_temperature_warning",
        severity: "warning",
        title: `Elevated Temperature (${reading.temperature_c}°C)`,
        description: "",
        recommended_action:
          "Verify sensor placement and repeat the reading using the approved measurement method. " +
          "Review recent temperature trends, activity, environmental conditions, and any reported symptoms. " +
          "Follow the mission's medical protocol for persistent elevations or worsening values, and escalate promptly " +
          "if the reading reaches the critical threshold.",
        evidence: { temperature_c: reading.temperature_c, threshold: 38, unit: "°C" },
      });
    } else if (reading.temperature_c < 35) {
      insights.push({
        rule_key: "low_temperature_critical",
        severity: "critical",
        title: `Critical Low Temperature (${reading.temperature_c}°C)`,
      description: "",
        recommended_action:
          "Promptly verify the reading with the approved measurement method and check sensor function. " +
          "Notify the responsible medical team immediately and follow the mission's thermal-safety and emergency procedures. " +
          "Review environmental conditions and other vital signs, and do not delay escalation if the astronaut is unwell.",
        evidence: { temperature_c: reading.temperature_c, threshold: 35, unit: "°C" },
      });
    }
  }

  return insights;
}


export type SleepReport = {
  id: string;
  sleep_minutes: number;
  submitted_at: string;
};

export function evaluateSleep(report: SleepReport): HealthInsight[] {
  const insights: HealthInsight[] = [];
  const hours = report.sleep_minutes / 60;

  // Critical: strictly less than 5 hours.
  if (report.sleep_minutes < 300) {
    insights.push({
      rule_key: "low_sleep_critical",
      severity: "critical",
      title: `Critical Sleep Deficit (${hours.toFixed(1)} hours)`,
      description:
       "",
      recommended_action:
        "Prioritize recovery sleep and increase the available sleep opportunity toward the mission-planned " +
        "8–8.5 hours. Review circadian disruption, schedule changes, cabin noise, and lighting conditions. " +
        "Flag the sleep deficit for mission medical review before safety-critical duties, following the " +
        "approved mission protocol.",
      evidence: {
        sleep_minutes: report.sleep_minutes,
        sleep_hours: Number(hours.toFixed(2)),
        threshold_hours: 5,
        reported_at: report.submitted_at,
      },
    });
  }
  // Warning: 5 hours inclusive, but strictly less than 6 hours.
  else if (report.sleep_minutes < 360) {
    insights.push({
      rule_key: "low_sleep_warning",
      severity: "warning",
      title: `Low Sleep Duration (${hours.toFixed(1)} hours)`,
      description:
     "",
      recommended_action:
        "Aim to increase sleep opportunity toward the mission-planned 8–8.5 hours. " +
        "Maintain a consistent 24-hour schedule where mission operations allow, reduce cabin noise " +
        "and other disruptions, and consider appropriate bright light during the planned morning " +
        "and dimmer, less blue-enriched lighting in the evening. Review the next sleep report.",
      evidence: {
        sleep_minutes: report.sleep_minutes,
        sleep_hours: Number(hours.toFixed(2)),
        threshold_hours: 6,
        reported_at: report.submitted_at,
      },
    });
  }

  return insights;
}
