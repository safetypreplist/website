import catalog from "../_shared/catalog.json" with { type: "json" };
import { json, preflight } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

type BundledSystem = { id: string; slug: string; [key: string]: unknown };
type BundledSection = { id: string; system_id: string; slug: string; [key: string]: unknown };
type BundledItem = { id: string; section_id: string; permanent_key: string; active?: boolean; [key: string]: unknown };

const systems = catalog.systems as BundledSystem[];
const sections = catalog.sections as BundledSection[];
const items = (catalog.items as BundledItem[]).filter((item) => item.active !== false);

Deno.serve(async (req) => {
  const opt = preflight(req);
  if (opt) return opt;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user, supabase } = await requireUser(req);
    if (!user) return json({ error: "Sign in required" }, 401);

    // checklist_items RLS decides which items this login may read.
    const [systemRows, sectionRows, itemRows] = await Promise.all([
      supabase.from("checklist_systems").select("id, slug"),
      supabase.from("checklist_sections").select("id, system_id, slug"),
      supabase.from("checklist_items").select("id, permanent_key").eq("active", true).range(0, 4999),
    ]);
    if (systemRows.error || sectionRows.error || itemRows.error) {
      console.error(systemRows.error || sectionRows.error || itemRows.error);
      return json({ error: "Could not load checklists" }, 500);
    }

    const liveSystems = (systemRows.data || []) as { id: string; slug: string }[];
    const liveSystemSlug = new Map(liveSystems.map((row) => [row.id, row.slug]));
    const liveSystemId = new Map(liveSystems.map((row) => [row.slug, row.id]));
    const liveSectionId = new Map(
      ((sectionRows.data || []) as { id: string; system_id: string; slug: string }[]).map((row) => [
        `${liveSystemSlug.get(row.system_id)}/${row.slug}`,
        row.id,
      ]),
    );
    const allowed = new Map(
      ((itemRows.data || []) as { id: string; permanent_key: string }[]).map((row) => [row.permanent_key, row.id]),
    );

    const systemSlug = new Map(systems.map((system) => [system.id, system.slug]));
    const sectionId = new Map(
      sections.map((section) => [
        section.id,
        liveSectionId.get(`${systemSlug.get(section.system_id)}/${section.slug}`) || section.id,
      ]),
    );

    return json({
      systems: systems.map((system) => ({ ...system, id: liveSystemId.get(system.slug) || system.id })),
      sections: sections.map((section) => ({
        ...section,
        id: sectionId.get(section.id) || section.id,
        system_id: liveSystemId.get(systemSlug.get(section.system_id) || "") || section.system_id,
      })),
      items: items
        .filter((item) => allowed.has(item.permanent_key))
        .map((item) => {
          const id = allowed.get(item.permanent_key) as string;
          return {
            ...item,
            id,
            section_id: sectionId.get(item.section_id) || item.section_id,
            ...(id !== item.id ? { bundled_id: item.id } : {}),
          };
        }),
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not load checklists" }, 500);
  }
});
