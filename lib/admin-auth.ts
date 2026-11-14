import "server-only";

import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { User } from "@supabase/supabase-js";

export type AdminAuthResult =
  | { authorized: true; user: User }
  | { authorized: false; error: string; status: number };

/**
 * Verifies that the current request has an authenticated session
 * and that the authenticated user possesses the "admin" role.
 * Server-only; uses supabaseAdmin to verify role securely.
 *
 * Evaluated at request time using Supabase auth cookies.
 */
export async function verifyAdminSession(): Promise<AdminAuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      error: "Authentication required.",
      status: 401,
    };
  }

  const { data: roleData, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || roleData?.role !== "admin") {
    return {
      authorized: false,
      error: "Administrator privileges required.",
      status: 403,
    };
  }

  return {
    authorized: true,
    user,
  };
}
