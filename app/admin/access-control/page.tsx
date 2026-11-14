"use client";

import { useEffect, useState, useMemo } from "react";
import AdminShell from "../AdminShell";

type AccountUser = {
  id: string;
  email: string;
  fullName: string;
  astronautId: string;
  role: "admin" | "astronaut";
  createdAt: string;
  lastSignInAt: string | null;
  avatarUrl: string | null;
};

type AuditLog = {
  id: number;
  action: "promoted" | "demoted";
  createdAt: string;
  actorId: string;
  actorEmail: string;
  actorName: string;
  targetId: string;
  targetEmail: string;
  targetName: string;
};

export default function AccessControlPage() {
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "astronaut">("all");

  // Form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "astronaut">("admin");
  const [submitting, setSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function loadUsersAndLogs() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load access control directory (HTTP ${res.status})`);
      }
      const data = await res.json();
      setUsers(data.users || []);
      setAuditLogs(data.auditLogs || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching user directory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsersAndLogs();
  }, []);

  async function executeRoleChange(targetEmail: string, targetRole: "admin" | "astronaut") {
    const normalizedEmail = targetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setActionFeedback({
        type: "error",
        message: "Please specify a registered account email.",
      });
      return;
    }

    const actionVerb = targetRole === "admin" ? "Promote" : "Demote";
    const confirmed = window.confirm(
      `${actionVerb} ${normalizedEmail} to ${
        targetRole === "admin" ? "Administrator" : "Astronaut"
      }?\n\nThis will modify system permissions immediately.`
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);
      setActionFeedback(null);

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, role: targetRole }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update account permissions.");
      }

      setActionFeedback({
        type: "success",
        message: result.message || `Account permissions updated for ${normalizedEmail}.`,
      });
      setEmail("");
      await loadUsersAndLogs();
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.astronautId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const adminCount = users.filter((u) => u.role === "admin").length;
  const astronautCount = users.filter((u) => u.role === "astronaut").length;

  return (
    <AdminShell
      activeSection="access-control"
      title="Security & System Access Control"
      subtitle="Role-based access management, privilege escalation, and security audit logs."
      headerActions={
        <button
          type="button"
          onClick={() => loadUsersAndLogs()}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/30 hover:bg-cyan-400/10 hover:text-cyan-200 transition"
        >
          ↻ Refresh Directory
        </button>
      }
    >
      <div className="space-y-8">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-cyan-400/20 bg-[#0A1222] p-4">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Registered Accounts
            </p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {users.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">Supabase Auth database</p>
          </div>

          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4">
            <p className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase">
              Administrators
            </p>
            <p className="mt-1 text-2xl font-black text-cyan-300 sm:text-3xl">
              {adminCount}
            </p>
            <p className="mt-1 text-xs text-slate-400">Elevated system control</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A1222] p-4">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Astronauts
            </p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {astronautCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Personal telemetry access</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0A1222] p-4">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Audit Logs Recorded
            </p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {auditLogs.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">Role changes logged</p>
          </div>
        </div>

        {/* FEEDBACK ALERT */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-[#0A1222] p-8 text-center text-xs text-cyan-400">
            Loading security and access directory...
          </div>
        )}

        {actionFeedback && (
          <div
            role="status"
            className={`rounded-2xl border p-4 text-xs sm:text-sm font-medium flex items-center justify-between ${
              actionFeedback.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
            }`}
          >
            <span>{actionFeedback.message}</span>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-xs opacity-75 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* MAIN ACCESS CONTROL GRID: FORM + DIRECTORY */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* LEFT: UPDATE ROLE CARD (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 sm:p-7 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/30 font-bold">
                  ◈
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Update Account Role
                  </h3>
                  <p className="text-xs text-slate-400">
                    Modify permissions for an existing registered user.
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeRoleChange(email, role);
                }}
                className="mt-6 space-y-4"
              >
                <div>
                  <label
                    htmlFor="target-email"
                    className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                  >
                    Registered Account Email
                  </label>
                  <input
                    id="target-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. astronaut@orbit.nas"
                    className="w-full rounded-xl border border-white/10 bg-[#070C18] px-4 py-3 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400 transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="target-role"
                    className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
                  >
                    Assigned Clearance Role
                  </label>
                  <select
                    id="target-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as "admin" | "astronaut")}
                    className="w-full rounded-xl border border-white/10 bg-[#070C18] px-4 py-3 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    <option value="admin">Administrator (Elevated System Access)</option>
                    <option value="astronaut">Astronaut (Standard Health Monitoring)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-cyan-400 py-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                >
                  {submitting ? "Applying Changes..." : "Apply Role Modification"}
                </button>
              </form>
            </section>

            {/* SECURITY POLICY CARD */}
            <section className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Security & Role Integrity Rules
              </h4>
              <ul className="mt-3 space-y-2 text-xs text-slate-400 leading-relaxed list-disc list-inside">
                <li>
                  <strong className="text-white">Last Administrator Protection:</strong> The system automatically prevents demoting the final remaining administrator.
                </li>
                <li>
                  <strong className="text-white">Self-Demotion Safeguard:</strong> You cannot demote your own active account from this interface.
                </li>
                <li>
                  <strong className="text-white">Immutable Audit Logging:</strong> Every promotion or demotion action is recorded in the <code className="text-cyan-300">admin_audit_logs</code> database table.
                </li>
              </ul>
            </section>
          </div>

          {/* RIGHT: REGISTERED USER DIRECTORY TABLE (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Registered Accounts Directory
                  </h3>
                  <p className="text-xs text-slate-400">
                    Search and manage privileges directly from the roster.
                  </p>
                </div>

                <div className="flex rounded-xl border border-white/10 bg-[#070C18] p-1 text-xs">
                  {(["all", "admin", "astronaut"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 font-semibold capitalize transition ${
                        roleFilter === r
                          ? "bg-cyan-400 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* SEARCH */}
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Filter accounts by email, name, or astronaut ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#070C18] px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>

              {/* TABLE */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-white/10 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((u) => {
                      const isAdmin = u.role === "admin";
                      return (
                        <tr key={u.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-3">
                            <p className="font-bold text-white text-xs">{u.fullName}</p>
                            <p className="text-[11px] text-slate-500">{u.email}</p>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-cyan-300">
                            {u.astronautId}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                isAdmin
                                  ? "bg-cyan-400 text-slate-950"
                                  : "border border-white/10 bg-white/5 text-slate-300"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isAdmin ? (
                              <button
                                type="button"
                                disabled={submitting || adminCount <= 1}
                                onClick={() => executeRoleChange(u.email, "astronaut")}
                                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                title={
                                  adminCount <= 1
                                    ? "Cannot remove the final administrator"
                                    : "Demote to Astronaut"
                                }
                              >
                                Demote
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => executeRoleChange(u.email, "admin")}
                                className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-400/20 transition disabled:opacity-50"
                              >
                                Make Admin
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>

        {/* AUDIT LOG HISTORY SECTION */}
        <section className="rounded-3xl border border-white/10 bg-[#0A1222] p-6 sm:p-7 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Role Modification Audit Trail
              </h3>
              <p className="text-xs text-slate-400">
                Cryptographic security record from <code className="text-cyan-300">admin_audit_logs</code>.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono text-slate-400">
              {auditLogs.length} Events Logged
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            {auditLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 italic">
                No role modification audit events on record.
              </p>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-white/10 text-[10px] uppercase font-bold text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Event ID</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Acting Administrator</th>
                    <th className="py-2.5 px-3">Target Account</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 text-slate-500">#{log.id}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            log.action === "promoted"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">
                        {log.actorName} ({log.actorEmail})
                      </td>
                      <td className="py-2.5 px-3 font-sans text-white font-semibold">
                        {log.targetName} ({log.targetEmail})
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
