import { json, preflight } from "../_shared/http.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { user } = await requireUser(req);
  if (!user) return json({ error: "Sign in required" }, 401);

  const admin = serviceClient();
  const confirm = String((await req.json().catch(() => ({}))).confirm || "");
  if (confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);

  const { data: checklists } = await admin
    .from("personal_checklists")
    .select("id")
    .or(`owner_user_id.eq.${user.id},purchased_by_user_id.eq.${user.id}`);

  const checklistIds = (checklists || []).map((row: { id: string }) => row.id);
  if (checklistIds.length) {
    await admin.from("checklist_permissions").delete().in("checklist_id", checklistIds);
    await admin.from("personal_checklists").update({
      owner_user_id: null,
      status: "cancelled",
      invited_email: null,
      invited_first_name: null,
      invited_last_name: null,
    }).in("id", checklistIds);
  }

  await admin.from("checklist_permissions").delete().eq("grantee_user_id", user.id);
  await admin.storage.from("avatars").remove([user.id]).catch(() => undefined);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(error);
    return json({ error: "Could not delete this account." }, 500);
  }

  return json({
    ok: true,
    kept: "Purchase records and terms acceptances are retained as required.",
  });
});
