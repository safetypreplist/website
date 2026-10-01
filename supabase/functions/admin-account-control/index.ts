import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  action?: string;
  account_id?: string;
  new_password?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anonKey || !serviceKey || !authorization) {
      return json({ error: "Account service is not configured." }, 500);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sign in is required." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: ownerProfile, error: ownerError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (ownerError) return json({ error: "Could not verify account permissions." }, 500);
    if (ownerProfile?.role !== "owner") return json({ error: "Owner access is required." }, 403);

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    if (body.action === "list_accounts") {
      const { data, error } = await admin
        .from("profiles")
        .select("id,email,full_name,role,plan,access_status,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return json({ error: "Could not load accounts." }, 500);
      return json({ accounts: data || [] });
    }

    if (body.action === "set_password") {
      const accountId = typeof body.account_id === "string" ? body.account_id.trim() : "";
      const password = typeof body.new_password === "string" ? body.new_password : "";
      const passwordBytes = new TextEncoder().encode(password).length;
      if (!accountId) return json({ error: "Choose an account." }, 400);
      if (passwordBytes < 8 || passwordBytes > 128) {
        return json({ error: "Password must be between 8 and 128 bytes." }, 400);
      }

      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", accountId)
        .maybeSingle();
      if (targetError) return json({ error: "Could not verify the selected account." }, 500);
      if (!target) return json({ error: "Account not found." }, 404);

      const { error: updateError } = await admin.auth.admin.updateUserById(accountId, { password });
      if (updateError) return json({ error: updateError.message || "Password update failed." }, 400);
      console.info("Owner changed an account password", {
        actor_user_id: authData.user.id,
        target_user_id: accountId,
      });
      return json({ ok: true });
    }

    return json({ error: "Unknown account action." }, 400);
  } catch {
    return json({ error: "Account operation failed." }, 500);
  }
});
