import process from "node:process";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export async function verifyAdminRequest(request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return { error: "Request origin was rejected.", status: 403 };
    } catch { return { error: "Request origin was rejected.", status: 403 }; }
  }

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: "Sign in with an authorized admin account first.", status: 401 };
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { error: "Server-side Supabase URL and anon key are not configured.", status: 503 };

  let userResponse;
  try {
    userResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { error: "Could not verify the Supabase session.", status: 502 };
  }
  if (!userResponse.ok) return { error: "Your admin session is invalid or expired. Sign in again.", status: 401 };
  const user = await userResponse.json().catch(() => null);
  if (!user?.id) return { error: "Supabase did not return an authenticated user.", status: 401 };

  const membershipUrl = new URL(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/admin_users`);
  membershipUrl.searchParams.set("select", "user_id");
  membershipUrl.searchParams.set("user_id", `eq.${user.id}`);
  let membershipResponse;
  try {
    membershipResponse = await fetch(membershipUrl, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { error: "Could not verify admin membership.", status: 502 };
  }
  if (!membershipResponse.ok) return { error: "Could not verify admin membership through the existing admin_users policy.", status: 403 };
  const memberships = await membershipResponse.json().catch(() => []);
  if (!Array.isArray(memberships) || !memberships.some((entry) => entry.user_id === user.id)) {
    return { error: "This account is not authorized to upload Cloudflare videos.", status: 403 };
  }
  return { user };
}
