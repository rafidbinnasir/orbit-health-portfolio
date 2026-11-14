# ORBIT Health

**Astronaut Health Monitoring and Telemetry Platform**

ORBIT Health is a health-monitoring platform designed to collect, process, and visualize vital health data. It supports multiple users and multiple connected hardware devices, allowing users to monitor readings such as heart rate, blood oxygen saturation (SpO₂), and body temperature through a centralized dashboard.

## Features

- User authentication and personalized dashboards.
- Real-time hardware data ingestion through an API.
- Multiple hardware devices per user account.
- Secure, individual device authentication tokens.
- Vital sign monitoring and visualization.
- Automated health insights based on incoming readings.
- Machine learning-based anomaly monitoring.
- Device registration, activity tracking, and revocation.

## Getting Started

### 1. Access ORBIT Health

Visit the application:

**https://orbit-health-h6vf.vercel.app/**

Create an account or log in using your existing credentials.

Each user has an individual dashboard where their health readings and registered hardware devices are managed.

### 2. Register a Hardware Device

After logging in:

1. Navigate to the **Devices** section of your dashboard.
2. Find the **Device Management** panel.
3. Enter a name for your hardware device (for example, `ORBIT Band 01`).
4. Click **Register Device**.

ORBIT Health will generate a unique authentication token for that device.

**Important:** Copy and securely store this token immediately. It is displayed only once and cannot be retrieved later.

Each user can register up to 10 active devices.

### 3. Configure Your Hardware

Configure your compatible Wi-Fi-enabled microcontroller (such as an ESP32) to communicate with the ORBIT Health API.

Your device needs:

- A compatible microcontroller with internet connectivity.
- Appropriate sensors for collecting vital measurements.
- The device authentication token generated during registration.
- Firmware capable of sending HTTP POST requests.

The hardware must send its readings to the following endpoint:

**Production API endpoint:**

`https://orbit-health-h6vf.vercel.app/api/device/vitals`

Include the device token in the HTTP request header:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `x-device-token` | Your registered device token |

### 4. Send Health Readings

The device must send an HTTP POST request containing the following JSON structure:

```json
{
  "heartRate": 78,
  "spo2": 98,
  "temperatureC": 36.8
}
```

Supported measurements:

| Parameter | Description | Accepted range |
|---|---|---|
| `heartRate` | Heart rate in beats per minute | 1–300 (integer) |
| `spo2` | Blood oxygen saturation percentage | 0–100 |
| `temperatureC` | Temperature in Celsius | 20–50 |

The API validates incoming measurements and authenticates the device before accepting the data.

### 5. Data Processing and Dashboard Updates

Once a valid reading is received:

1. ORBIT Health identifies the device using its authentication token.
2. The associated user account is determined automatically.
3. The reading is validated and stored in the database under that user.
4. Health rules evaluate the incoming measurements and generate applicable health insights.
5. The device's last communication timestamp is updated.

Users can then view their incoming readings and monitoring information through their ORBIT Health dashboard.

### 6. Manage Registered Devices

Users can manage their connected hardware through the **Device Management** section.

Available operations include:

- **Register Device:** Add another hardware device.
- **View Devices:** See registered devices and their current status.
- **Last Communication:** Check when a device last successfully submitted a reading.
- **Revoke Device:** Disable a device's access to the ingestion API.

Revoking a device invalidates its authentication token. Any subsequent requests using that token will be rejected.

If a token is lost, revoke the associated device and register a new one.

## API Reference

### Device Data Ingestion

| Property | Details |
|---|---|
| Endpoint | `/api/device/vitals` |
| Method | `POST` |
| Authentication | `x-device-token` header |
| Content Type | `application/json` |
| Success status | `201 Created` |
| Invalid token | `401 Unauthorized` |
| Invalid readings | `400 Bad Request` |

A successful request returns a response containing:

- `success`: Indicates successful ingestion.
- `deviceId`: Identifies the registered hardware device.
- `reading`: Contains the saved vital reading.
- `insights`: Contains the health insights generated for that reading.

### Device Management

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/devices` | `GET` | List the authenticated user's devices |
| `/api/devices` | `POST` | Register a new device |
| `/api/devices` | `DELETE` | Revoke a registered device |

Device management operations require an authenticated ORBIT Health user session.

## Security

ORBIT Health uses individual authentication tokens for registered hardware devices.

- Each device receives a unique, randomly generated token.
- Only a cryptographic hash of the token is stored in the database.
- Device tokens are never returned through the device-listing endpoint.
- Device readings are associated with the user who registered the device.
- Revoked devices cannot submit additional readings.

**Never share your device token or include it in publicly accessible source code or repositories.**

## Important Notes

- Hardware readings must come from appropriately configured sensors and device firmware.
- The API currently accepts heart rate, SpO₂, and temperature measurements.
- The software infrastructure supports hardware ingestion, but physical sensor accuracy depends on the hardware and its calibration.
- ORBIT Health is a monitoring and research project, not a certified medical diagnostic device. Its insights should not replace professional medical advice.

## Local Development

ORBIT Health is built using Next.js, TypeScript, Supabase, and other supporting technologies.

### Requirements

- Node.js
- npm
- A Supabase project with the required database configuration

### Installation

Clone the repository:

```bash
git clone https://github.com/rafidbinnasir/orbit-health.git
cd orbit-health
```

Install dependencies:

```bash
npm install
```

Configure the required environment variables using the project's environment variable template. Keep private credentials in `.env.local` and never commit that file.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To create a production build:

```bash
npm run build
```

## Deployment

ORBIT Health is deployed using [Vercel](https://vercel.com/).

The production application is available at:

**https://orbit-health-h6vf.vercel.app/**

The main application source code is maintained in the [ORBIT Health GitHub repository](https://github.com/rafidbinnasir/orbit-health).

---

**ORBIT Health — Connecting Hardware, Health Data, and Intelligent Monitoring.**