import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin, listAllUsers } from "@/lib/supabase-admin";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [
      allUsers,
      { data: profiles },
      { data: roles },
      { data: auditLogs },
    ] = await Promise.all([
      listAllUsers(),
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("*"),
      supabaseAdmin
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    const usersList = allUsers.map((u) => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email || "",
        fullName:
          p?.full_name || u.email?.split("@")[0].toUpperCase() || "Astronaut",
        astronautId: p?.astronaut_id || `AST-${u.id.slice(0, 8).toUpperCase()}`,
        role: roleMap.get(u.id) || "astronaut",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
        avatarUrl: p?.avatar_url || null,
      };
    });

    const enrichedAuditLogs = (auditLogs || []).map((log) => {
      const actor = userMap.get(log.actor_user_id);
      const actorProfile = profileMap.get(log.actor_user_id);
      const target = userMap.get(log.target_user_id);
      const targetProfile = profileMap.get(log.target_user_id);

      return {
        id: log.id,
        action: log.action,
        createdAt: log.created_at,
        actorId: log.actor_user_id,
        actorEmail: actor?.email || "Unknown admin",
        actorName: actorProfile?.full_name || actor?.email || "Administrator",
        targetId: log.target_user_id,
        targetEmail: target?.email || "Unknown user",
        targetName: targetProfile?.full_name || target?.email || "User",
      };
    });

    return NextResponse.json({
      users: usersList,
      auditLogs: enrichedAuditLogs,
    });
  } catch (error) {
    console.error("Admin list users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user directory." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 1. Verify the signed-in user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // 2. Verify the caller is an administrator.
    const { data: callerRole, error: roleError } =
      await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (roleError || callerRole?.role !== "admin") {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    // 3. Validate the requested change.
    const body = await request.json();

    const { email, role } = body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      !["admin", "astronaut"].includes(role)
    ) {
      return NextResponse.json(
        { error: "Valid email and role are required." },
        { status: 400 }
      );
    }

    // 4. Find the existing account across all registered users.
    const normalizedEmail = email.trim().toLowerCase();
    const allUsers = await listAllUsers();

    const target = allUsers.find(
      (item) =>
        item.email?.toLowerCase() === normalizedEmail
    );

    if (!target) {
      return NextResponse.json(
        { error: "No account found with that email." },
        { status: 404 }
      );
    }

    if (target.id === user.id) {
      return NextResponse.json(
        { error: "You cannot change your own administrator role here." },
        { status: 400 }
      );
    }

    // 5. Check the existing role.
    const { data: existingRole, error: existingRoleError } =
      await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", target.id)
        .maybeSingle();

    if (existingRoleError) {
      throw existingRoleError;
    }

    const previousRole = existingRole?.role ?? "astronaut";

    if (previousRole === role) {
      return NextResponse.json(
        { error: "The account already has this role." },
        { status: 409 }
      );
    }

    // 6. Protect the last administrator.
    if (role === "astronaut" && previousRole === "admin") {
      const { count, error: countError } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        throw countError;
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "The last administrator cannot be removed." },
          { status: 409 }
        );
      }
    }

    // 7. Update or create the role.
    const { error: updateError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: target.id,
        role,
      });

    if (updateError) {
      throw updateError;
    }

    // 8. Record the change in the immutable security audit log.
    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        actor_user_id: user.id,
        target_user_id: target.id,
        action: role === "admin" ? "promoted" : "demoted",
      });

    if (auditError) {
      console.error("Admin audit log insertion failed, rolling back role change:", auditError);
      // Rollback role change to ensure audit consistency
      await supabaseAdmin.from("user_roles").upsert({
        user_id: target.id,
        role: previousRole,
      });

      return NextResponse.json(
        { error: "Security audit logging failed. Role modification was aborted." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        role === "admin"
          ? "User promoted to administrator."
          : "Administrator privileges removed.",
    });
  } catch (error) {
    console.error("Admin management error:", error);

    return NextResponse.json(
      { error: "Unable to update administrator permissions." },
      { status: 500 }
    );
  }
}
