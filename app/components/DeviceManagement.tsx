
"use client";

import { useCallback, useEffect, useState } from "react";

type Device = {
  id: string;
  device_name: string;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

export default function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch("/api/devices", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load devices.");
      }

      setDevices(result.devices ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load devices."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deviceName.trim()) return;

    setRegistering(true);
    setError("");
    setMessage("");
    setDeviceToken("");
    setCopied(false);

    try {
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceName: deviceName.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Device registration failed.");
      }

      setDeviceToken(result.deviceToken);
      setDeviceName("");
      setMessage("Device registered successfully.");
      await fetchDevices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Device registration failed."
      );
    } finally {
      setRegistering(false);
    }
  }

  async function handleCopyToken() {
    try {
      await navigator.clipboard.writeText(deviceToken);
      setCopied(true);
    } catch {
      setError(
        "Clipboard access failed. Select and copy the token manually."
      );
    }
  }

  async function handleRevoke(deviceId: string) {
    if (
      !window.confirm(
        "Are you sure you want to revoke this device? It will no longer be able to send readings."
      )
    ) {
      return;
    }

    setRevokingId(deviceId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/devices", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not revoke device.");
      }

      setMessage("Device revoked successfully.");
      await fetchDevices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not revoke device."
      );
    } finally {
      setRevokingId(null);
    }
  }

  const activeCount = devices.filter(
    (device) => !device.revoked_at
  ).length;

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm backdrop-blur-md sm:p-7 dark:border-slate-800 dark:bg-slate-900/90">
      {/* Section heading */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
            Hardware Connectivity
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Device Management
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Register and manage hardware connected to your ORBIT account.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
          <span className="h-2 w-2 rounded-full bg-cyan-500" />
          {activeCount} / 10 active devices
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          {message}
        </div>
      )}

      {/* One-time device token */}
      {deviceToken && (
        <div className="mb-6 rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            Device credentials generated
          </p>

          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Copy and securely store this token. It will not be displayed again.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              {deviceToken}
            </code>

            <button
              type="button"
              onClick={handleCopyToken}
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
            >
              {copied ? "Copied" : "Copy Token"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setDeviceToken("");
              setCopied(false);
            }}
            className="mt-3 text-xs font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300"
          >
            Hide token
          </button>
        </div>
      )}

      {/* Register device */}
      <form
        onSubmit={handleRegister}
        className="mb-7 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40"
      >
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Register a new device
        </h3>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Add a name for your ESP32 or compatible hardware.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            maxLength={80}
            minLength={1}
            required
            placeholder="e.g. ORBIT Band 01"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />

          <button
            type="submit"
            disabled={registering || !deviceName.trim() || activeCount >= 10}
            className="rounded-lg bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {registering ? "Registering..." : "Register Device"}
          </button>
        </div>
      </form>

      {/* Registered devices */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Registered Devices
        </h3>

        <button
          type="button"
          onClick={fetchDevices}
          disabled={loading}
          className="text-xs font-semibold text-cyan-700 transition hover:text-cyan-900 disabled:opacity-50 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">
          Loading registered devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-5 py-9 text-center dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No devices registered
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Register your first hardware device to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => {
            const revoked = Boolean(device.revoked_at);

            return (
              <div
                key={device.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center dark:border-slate-800"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {device.device_name}
                    </h4>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        revoked
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      }`}
                    >
                      {revoked ? "Revoked" : "Active"}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Registered: {new Date(device.created_at).toLocaleString()}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Last communication:{" "}
                    {device.last_seen_at
                      ? new Date(device.last_seen_at).toLocaleString()
                      : "No readings received yet"}
                  </p>
                </div>

                {!revoked && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(device.id)}
                    disabled={revokingId === device.id}
                    className="shrink-0 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                  >
                    {revokingId === device.id ? "Revoking..." : "Revoke Device"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
