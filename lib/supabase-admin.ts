import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Missing Supabase admin environment variables."
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Fetches all registered users from Supabase Auth across paginated pages.
 * Handles fleet sizes larger than the default 50-user page limit.
 */
export async function listAllUsers(): Promise<User[]> {
  const allUsers: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;
    const users = data.users || [];
    allUsers.push(...users);

    if (users.length < perPage) break;
    page++;
  }

  return allUsers;
}
