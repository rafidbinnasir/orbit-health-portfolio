"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export type AdminShellProps = {
  children: ReactNode;
  activeSection?: "overview" | "alerts" | "reports" | "monitoring" | "access-control";
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
};

export default function AdminShell({
  children,
  activeSection = "overview",
  title,
  subtitle,
  headerActions,
}: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState("Administrator");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (roleError || roleData?.role !== "admin") {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      setAdminName(profile?.full_name || user.email?.split("@")[0] || "Administrator");
      setLoading(false);
    }

    verifyAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      href: "/admin",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: "alerts",
      label: "Health Alerts",
      href: "/admin/alerts",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      id: "reports",
      label: "Reports",
      href: "/admin/reports",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "monitoring",
      label: "Monitoring Center",
      href: "/admin/monitoring",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070B16] text-cyan-400">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-xs font-semibold tracking-[0.25em] text-cyan-300">
            INITIALIZING MISSION CONTROL SECURE SESSION...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B16] text-slate-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-200">
      <div className="flex min-h-screen">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#0A1120] lg:flex">
          {/* BRAND */}
          <div className="border-b border-white/10 px-6 py-6">
            <Link href="/admin" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="12" cy="12" r="2" />
                  <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-30 12 12)" />
                  <circle cx="19.5" cy="7.5" r="1" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-[0.2em] text-white">
                  ORBIT HEALTH
                </p>
                <p className="text-[10px] font-semibold tracking-[0.25em] text-cyan-400">
                  HEALTH CONTROL CENTER
                </p>
              </div>
            </Link>
          </div>

          {/* NAVIGATION LINKS */}
          <div className="flex-1 px-4 py-6">
            <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.25em] text-slate-500 uppercase">
              Operations Center
            </p>

            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = activeSection === item.id || pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`group flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition duration-150 ${
                      isActive
                        ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                        : "text-slate-400 hover:border-white/5 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                  >
                    <span className={`${isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ASTRONAUT VIEW SHORTCUT */}
          <div className="border-t border-white/10 px-4 py-4">
            <Link
              href="/"
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-xs text-slate-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/5 hover:text-cyan-300"
            >
              <span>Switch to Astronaut View</span>
              <span>↗</span>
            </Link>
          </div>

          {/* ADMIN BADGE FOOTER */}
          <div className="border-t border-white/10 p-5">
            <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 to-transparent p-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <p className="text-[11px] font-bold tracking-wider text-cyan-300">
                  SYSTEM ADMIN ONLINE
                </p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Encrypted multi-astronaut telemetry feed active.
              </p>
            </div>
          </div>
        </aside>

        {/* MOBILE MENU DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex w-72 flex-col bg-[#0A1120] p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between pb-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/30">
                    ◎
                  </div>
                  <span className="font-bold text-sm tracking-widest text-cyan-300">ORBIT ADMIN</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <nav className="mt-6 space-y-2 flex-1">
                {navItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
                      activeSection === item.id
                        ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/30"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="pt-6 border-t border-white/10 space-y-3">
                <Link
                  href="/admin/access-control"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 py-2.5 text-xs font-semibold text-cyan-300"
                >
                  Access Control
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full rounded-xl border border-white/10 py-2.5 text-xs text-rose-300 hover:bg-rose-500/10"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN WORKSPACE WRAPPER */}
        <div className="min-w-0 flex-1 flex flex-col">
          {/* STICKY TOP HEADER */}
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B16]/95 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
              {/* LEFT: TITLE & MOBILE TOGGLE */}
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
                  aria-label="Open sidebar"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-[0.25em] text-cyan-400 uppercase">
                      MISSION CONTROL
                    </span>
                    <span className="text-slate-600">/</span>
                    <span className="text-[10px] font-semibold tracking-wider text-slate-400">
                      ADMINISTRATOR INTERFACE
                    </span>
                  </div>
                  {title && (
                    <h1 className="mt-0.5 text-lg font-bold text-white sm:text-xl">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-xs text-slate-400">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* RIGHT: ONLY ONE ACCESS CONTROL BUTTON + ADMIN PROFILE + SIGN OUT */}
              <div className="flex items-center gap-2.5 sm:gap-4">
                {headerActions}

                {/* THE SINGLE ACCESS CONTROL BUTTON AS REQUIRED */}
                <Link
                  href="/admin/access-control"
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold tracking-wide transition duration-150 ${
                    activeSection === "access-control"
                      ? "border border-cyan-400 bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                      : "border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 hover:border-cyan-300 hover:bg-cyan-400/20 hover:text-white shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                  }`}
                  title="Manage Administrator and Astronaut Roles"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Access Control</span>
                </Link>

                <div className="hidden h-7 w-px bg-white/10 sm:block" />

                {/* ADMIN PROFILE */}
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-bold text-white">
                    {adminName}
                  </p>
                  <p className="text-[10px] font-semibold tracking-wider text-cyan-400 uppercase">
                    Administrator
                  </p>
                </div>

                {/* SIGN OUT */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs font-medium text-slate-300 transition duration-150 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  Sign out
                </button>
              </div>
            </div>
          </header>

          {/* MAIN PAGE BODY */}
          <main className="flex-1">
            <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
              {children}
            </div>
          </main>

          {/* GLOBAL ADMIN FOOTER */}
          <footer className="border-t border-white/10 bg-[#070B16] py-5">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 text-xs text-slate-500 sm:px-8">
              <p>
                ORBIT HEALTH · Central Astronaut Health Monitoring & Administration Console
              </p>
              <p className="font-mono text-[11px] text-slate-600">
                TELEMETRY ENCRYPTED · SUPABASE AUTH & RLS ENFORCED
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
