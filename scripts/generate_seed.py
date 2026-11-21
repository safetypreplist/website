#!/usr/bin/env python3
"""Generate supabase/seed.sql from catalog data. Run from repo root."""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "supabase" / "seed.sql"


def esc(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "$seed$" + value + "$seed$"


def item(key: str, text: str, description: str = "", *, quick_start: bool = False, active: bool = True) -> dict:
    return {"key": key, "text": text, "description": description, "quick_start": quick_start, "active": active}


def qs(key: str, text: str, description: str = "") -> dict:
    return item(key, text, description, quick_start=True)


def hidden(key: str, text: str, description: str = "") -> dict:
    return item(key, text, description, active=False)


def load_product_systems() -> list[dict]:
    """Nine product checklists from the FINAL master PDF (content/product_checklists.json)."""
    payload = json.loads((ROOT / "content" / "product_checklists.json").read_text())
    systems = []
    for sys in payload["systems"]:
        sections = []
        for sec in sys["sections"]:
            section = {
                "slug": sec["slug"],
                "title": sec["title"],
                "intro": sec.get("intro") or "",
                "items": [
                    item(
                        it["key"],
                        it["text"],
                        it.get("description") or "",
                        quick_start=bool(it.get("quick_start")),
                        active=bool(it.get("active", True)),
                    )
                    for it in sec["items"]
                ],
            }
            if sec.get("lane"):
                section["lane"] = sec["lane"]
            if sec.get("more_title"):
                section["more_title"] = sec["more_title"]
            sections.append(section)
        systems.append(
            {
                "slug": sys["slug"],
                "title": sys["title"],
                "time_label": sys.get("time_label") or "",
                "illustration_key": sys["illustration_key"],
                "access_tier": sys["access_tier"],
                "sort_order": sys["sort_order"],
                "description": sys.get("description") or "",
                "sections": sections,
            }
        )
    return systems


SYSTEMS = load_product_systems()


NATIONAL_SAFETY = [
    {
        "state": None,
        "category": "emergency",
        "agency_name": "Emergency services (police, fire, EMS)",
        "phone": "911",
        "website": "https://www.ready.gov",
        "source_url": "https://www.ready.gov",
        "notes": "Universal emergency number in the United States.",
        "verified_at": "2026-09-03",
        "sort_order": 10,
    },
    {
        "state": None,
        "category": "crisis_support",
        "agency_name": "988 Suicide & Crisis Lifeline",
        "phone": "988",
        "website": "https://988lifeline.org",
        "source_url": "https://www.samhsa.gov/find-help/988",
        "notes": "24/7 call, text, or chat. SAMHSA / HHS.",
        "verified_at": "2026-09-03",
        "sort_order": 20,
    },
    {
        "state": None,
        "category": "poison_control",
        "agency_name": "Poison Control (America's Poison Centers)",
        "phone": "1-800-222-1222",
        "website": "https://www.poison.org",
        "source_url": "https://www.poison.org",
        "notes": "National number routes to the local poison center.",
        "verified_at": "2026-09-03",
        "sort_order": 30,
    },
    {
        "state": None,
        "category": "disaster_assistance",
        "agency_name": "FEMA Disaster Assistance",
        "phone": "1-800-621-3362",
        "website": "https://www.disasterassistance.gov",
        "source_url": "https://www.fema.gov/about/contact",
        "notes": "TTY 1-800-462-7585. FEMA helpline published on FEMA.gov.",
        "verified_at": "2026-09-03",
        "sort_order": 40,
    },
    {
        "state": None,
        "category": "disaster_assistance",
        "agency_name": "American Red Cross",
        "phone": "1-800-733-2767",
        "website": "https://www.redcross.org",
        "source_url": "https://www.redcross.org/contact-us",
        "notes": "1-800-RED-CROSS.",
        "verified_at": "2026-09-03",
        "sort_order": 50,
    },
    {
        "state": None,
        "category": "weather",
        "agency_name": "National Weather Service",
        "phone": None,
        "website": "https://www.weather.gov",
        "source_url": "https://www.weather.gov",
        "notes": "Official U.S. forecasts, watches, and warnings.",
        "verified_at": "2026-09-03",
        "sort_order": 60,
    },
    {
        "state": None,
        "category": "emergency",
        "agency_name": "Ready.gov household preparedness",
        "phone": None,
        "website": "https://www.ready.gov",
        "source_url": "https://www.ready.gov",
        "notes": "Official U.S. preparedness guidance from DHS / FEMA.",
        "verified_at": "2026-09-03",
        "sort_order": 70,
    },
]


# Official emergency-management agency websites compiled from FEMA / USA.gov
# directories. Phone numbers are omitted unless independently verified in this
# seed — the owner should add numbers after confirming them on the agency site.
STATE_EMA = [
    ("AL", "Alabama Emergency Management Agency", "https://ema.alabama.gov"),
    ("AK", "Alaska Division of Homeland Security and Emergency Management", "https://ready.alaska.gov"),
    ("AZ", "Arizona Department of Emergency and Military Affairs", "https://dema.az.gov"),
    ("AR", "Arkansas Division of Emergency Management", "https://www.dps.arkansas.gov/emergency-management"),
    ("CA", "California Governor's Office of Emergency Services", "https://www.caloes.ca.gov"),
    ("CO", "Colorado Division of Homeland Security and Emergency Management", "https://dhsem.colorado.gov"),
    ("CT", "Connecticut Division of Emergency Management and Homeland Security", "https://portal.ct.gov/demhs"),
    ("DE", "Delaware Emergency Management Agency", "https://dema.delaware.gov"),
    ("DC", "District of Columbia Homeland Security and Emergency Management Agency", "https://hsema.dc.gov"),
    ("FL", "Florida Division of Emergency Management", "https://www.floridadisaster.org"),
    ("GA", "Georgia Emergency Management and Homeland Security Agency", "https://gema.georgia.gov"),
    ("HI", "Hawaii Emergency Management Agency", "https://dod.hawaii.gov/hiema"),
    ("ID", "Idaho Office of Emergency Management", "https://ioem.idaho.gov"),
    ("IL", "Illinois Emergency Management Agency and Office of Homeland Security", "https://iemaohs.illinois.gov"),
    ("IN", "Indiana Department of Homeland Security", "https://www.in.gov/dhs"),
    ("IA", "Iowa Homeland Security and Emergency Management", "https://homelandsecurity.iowa.gov"),
    ("KS", "Kansas Division of Emergency Management", "https://www.kansastag.gov"),
    ("KY", "Kentucky Emergency Management", "https://kyem.ky.gov"),
    ("LA", "Louisiana Governor's Office of Homeland Security and Emergency Preparedness", "https://gohsep.la.gov"),
    ("ME", "Maine Emergency Management Agency", "https://www.maine.gov/mema"),
    ("MD", "Maryland Department of Emergency Management", "https://mdem.maryland.gov"),
    ("MA", "Massachusetts Emergency Management Agency", "https://www.mass.gov/orgs/massachusetts-emergency-management-agency"),
    ("MI", "Michigan State Police Emergency Management and Homeland Security Division", "https://www.michigan.gov/msp/divisions/emhsd"),
    ("MN", "Minnesota Homeland Security and Emergency Management", "https://dps.mn.gov/divisions/hsem"),
    ("MS", "Mississippi Emergency Management Agency", "https://www.msema.org"),
    ("MO", "Missouri State Emergency Management Agency", "https://sema.dps.mo.gov"),
    ("MT", "Montana Disaster and Emergency Services", "https://des.mt.gov"),
    ("NE", "Nebraska Emergency Management Agency", "https://nema.nebraska.gov"),
    ("NV", "Nevada Division of Emergency Management", "https://dem.nv.gov"),
    ("NH", "New Hampshire Homeland Security and Emergency Management", "https://www.nh.gov/safety/divisions/hsem"),
    ("NJ", "New Jersey Office of Emergency Management", "https://www.nj.gov/njoem"),
    ("NM", "New Mexico Department of Homeland Security and Emergency Management", "https://www.nmdhsem.org"),
    ("NY", "New York State Division of Homeland Security and Emergency Services", "https://www.dhses.ny.gov"),
    ("NC", "North Carolina Emergency Management", "https://www.ncdps.gov/our-organization/emergency-management"),
    ("ND", "North Dakota Department of Emergency Services", "https://www.des.nd.gov"),
    ("OH", "Ohio Emergency Management Agency", "https://ema.ohio.gov"),
    ("OK", "Oklahoma Department of Emergency Management", "https://oklahoma.gov/oem"),
    ("OR", "Oregon Department of Emergency Management", "https://www.oregon.gov/oem"),
    ("PA", "Pennsylvania Emergency Management Agency", "https://www.pema.pa.gov"),
    ("RI", "Rhode Island Emergency Management Agency", "https://riema.ri.gov"),
    ("SC", "South Carolina Emergency Management Division", "https://www.scemd.org"),
    ("SD", "South Dakota Office of Emergency Management", "https://dps.sd.gov/emergency-services/emergency-management"),
    ("TN", "Tennessee Emergency Management Agency", "https://www.tn.gov/tema"),
    ("TX", "Texas Division of Emergency Management", "https://tdem.texas.gov"),
    ("UT", "Utah Division of Emergency Management", "https://dem.utah.gov"),
    ("VT", "Vermont Emergency Management", "https://vem.vermont.gov"),
    ("VA", "Virginia Department of Emergency Management", "https://www.vaemergency.gov"),
    ("WA", "Washington Military Department Emergency Management Division", "https://mil.wa.gov/emergency-management-division"),
    ("WV", "West Virginia Emergency Management Division", "https://emd.wv.gov"),
    ("WI", "Wisconsin Emergency Management", "https://wem.wi.gov"),
    ("WY", "Wyoming Office of Homeland Security", "https://hls.wyo.gov"),
]



def sql_bool(v: bool) -> str:
    return "true" if v else "false"


def build() -> str:
    lines = [
        "-- Generated by scripts/generate_seed.py — do not hand-edit item lists here.",
        "-- Re-run: python3 scripts/generate_seed.py",
        "-- Apply AFTER migrations. Checklist upserts are idempotent.",
        "-- Do not wrap this file in begin/commit when using the Supabase SQL Editor.",
        "",
    ]

    for sys in SYSTEMS:
        lines.append(
            f"insert into public.checklist_systems (slug, title, description, time_label, illustration_key, access_tier, sort_order, active)"
            f" values ({esc(sys['slug'])}, {esc(sys['title'])}, {esc(sys['description'])}, {esc(sys['time_label'])}, {esc(sys['illustration_key'])}, '{sys['access_tier']}', {sys['sort_order']}, true)"
            f" on conflict (slug) do update set title = excluded.title, description = excluded.description, time_label = excluded.time_label, illustration_key = excluded.illustration_key, access_tier = excluded.access_tier, sort_order = excluded.sort_order;"
        )
        for si, sec in enumerate(sys["sections"]):
            lines.append(
                f"insert into public.checklist_sections (system_id, slug, title, intro, sort_order)"
                f" select id, {esc(sec['slug'])}, {esc(sec['title'])}, {esc(sec.get('intro') or '')}, {si * 10}"
                f" from public.checklist_systems where slug = {esc(sys['slug'])}"
                f" on conflict (system_id, slug) do update set title = excluded.title, intro = excluded.intro, sort_order = excluded.sort_order;"
            )
            for ii, it in enumerate(sec["items"]):
                lines.append(
                    f"insert into public.checklist_items (section_id, permanent_key, text, description, sort_order, active, quick_start)"
                    f" select sec.id, {esc(it['key'])}, {esc(it['text'])}, {esc(it.get('description') or '')}, {ii * 10}, {sql_bool(it.get('active', True))}, {sql_bool(it.get('quick_start', False))}"
                    f" from public.checklist_sections sec"
                    f" join public.checklist_systems sys on sys.id = sec.system_id"
                    f" where sys.slug = {esc(sys['slug'])} and sec.slug = {esc(sec['slug'])}"
                    f" on conflict (permanent_key) do update set text = excluded.text, description = excluded.description, sort_order = excluded.sort_order, section_id = excluded.section_id, active = excluded.active, quick_start = excluded.quick_start;"
                )
        lines.append("")

    catalog_sql = "\n".join(lines) + "\n"
    extra = [
        "-- Generated by scripts/generate_seed.py — safety contacts.",
        "-- Run AFTER supabase/seed.sql.",
        "",
    ]

    for rec in NATIONAL_SAFETY:
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(rec['state'])}, {esc(rec['category'])}, {esc(rec['agency_name'])}, {esc(rec['phone'])}, {esc(rec['website'])}, {esc(rec['source_url'])}, {esc(rec['notes'])}, {esc(rec['verified_at'])}::date, true, {rec['sort_order']}"
            ") on conflict do nothing;"
        )

    extra.append("")
    for code, name, url in STATE_EMA:
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'state_emergency_management', {esc(name)}, NULL, {esc(url)}, {esc('https://www.usa.gov/state-emergency-management')}, {esc('Official state emergency-management website. Confirm the current public phone number on the agency site before publishing it here.')}, '2026-09-03'::date, true, 100"
            ") on conflict do nothing;"
        )
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'weather', 'National Weather Service', NULL, {esc('https://www.weather.gov')}, {esc('https://www.weather.gov')}, {esc('Enter a local city on weather.gov for forecasts and alerts.')}, '2026-09-03'::date, true, 110"
            ") on conflict do nothing;"
        )
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'poison_control', 'Poison Control', {esc('1-800-222-1222')}, {esc('https://www.poison.org')}, {esc('https://www.poison.org')}, {esc('National number; routes to the poison center serving this state.')}, '2026-09-03'::date, true, 120"
            ") on conflict do nothing;"
        )
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'crisis_support', '988 Suicide & Crisis Lifeline', {esc('988')}, {esc('https://988lifeline.org')}, {esc('https://www.samhsa.gov/find-help/988')}, {esc('National 24/7 lifeline.')}, '2026-09-03'::date, true, 130"
            ") on conflict do nothing;"
        )
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'disaster_assistance', 'FEMA Disaster Assistance', {esc('1-800-621-3362')}, {esc('https://www.disasterassistance.gov')}, {esc('https://www.fema.gov/about/contact')}, {esc('Apply at DisasterAssistance.gov after a declared disaster.')}, '2026-09-03'::date, true, 140"
            ") on conflict do nothing;"
        )


    extra.append("")
    catalog = {
        "systems": [
            {
                "slug": s["slug"],
                "title": s["title"],
                "item_count": sum(len([it for it in sec["items"] if it.get("active", True)]) for sec in s["sections"]),
            }
            for s in SYSTEMS
        ]
    }
    (ROOT / "content" / "catalog-summary.json").write_text(json.dumps(catalog, indent=2) + "\n")
    return catalog_sql, "\n".join(extra) + "\n"


def uid(*parts: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "safety-prep-list:" + ":".join(parts)))


def frontend_catalog() -> dict:
    systems = []
    sections = []
    items = []
    for sys in SYSTEMS:
        sid = uid("system", sys["slug"])
        systems.append(
            {
                "id": sid,
                "slug": sys["slug"],
                "title": sys["title"],
                "description": sys["description"],
                "time_label": sys["time_label"],
                "illustration_key": sys["illustration_key"],
                "access_tier": sys["access_tier"],
                "sort_order": sys["sort_order"],
                "active": True,
            }
        )
        for si, sec in enumerate(sys["sections"]):
            sec_id = uid("section", sys["slug"], sec["slug"])
            sections.append(
                {
                    "id": sec_id,
                    "system_id": sid,
                    "slug": sec["slug"],
                    "title": sec["title"],
                    "intro": sec.get("intro") or "",
                    "sort_order": si * 10,
                    "lane": sec.get("lane"),
                    "more_title": sec.get("more_title") or "",
                }
            )
            for ii, it in enumerate(sec["items"]):
                items.append(
                    {
                        "id": uid("item", it["key"]),
                        "section_id": sec_id,
                        "permanent_key": it["key"],
                        "text": it["text"],
                        "description": it.get("description") or "",
                        "sort_order": ii * 10,
                        "active": it.get("active", True),
                        "quick_start": it.get("quick_start", False),
                    }
                )
    safety = []
    for rec in NATIONAL_SAFETY:
        safety.append(
            {
                "id": uid("safety", rec["category"], rec["agency_name"]),
                "state": rec["state"],
                "category": rec["category"],
                "agency_name": rec["agency_name"],
                "phone": rec["phone"],
                "website": rec["website"],
                "source_url": rec["source_url"],
                "notes": rec["notes"],
                "verified_at": rec["verified_at"],
                "active": True,
                "sort_order": rec["sort_order"],
            }
        )
    for code, name, url in STATE_EMA:
        safety.append(
            {
                "id": uid("safety", code, "ema"),
                "state": code,
                "category": "state_emergency_management",
                "agency_name": name,
                "phone": None,
                "website": url,
                "source_url": "https://www.usa.gov/state-emergency-management",
                "notes": "Official state emergency-management website.",
                "verified_at": "2026-09-03",
                "active": True,
                "sort_order": 100,
            }
        )
        for extra_cat, extra in [
            (
                "weather",
                {
                    "agency_name": "National Weather Service",
                    "phone": None,
                    "website": "https://www.weather.gov",
                    "source_url": "https://www.weather.gov",
                    "notes": "Enter a local city on weather.gov for forecasts and alerts.",
                    "sort_order": 110,
                },
            ),
            (
                "poison_control",
                {
                    "agency_name": "Poison Control",
                    "phone": "1-800-222-1222",
                    "website": "https://www.poison.org",
                    "source_url": "https://www.poison.org",
                    "notes": "National number; routes to the poison center serving this state.",
                    "sort_order": 120,
                },
            ),
            (
                "crisis_support",
                {
                    "agency_name": "988 Suicide & Crisis Lifeline",
                    "phone": "988",
                    "website": "https://988lifeline.org",
                    "source_url": "https://www.samhsa.gov/find-help/988",
                    "notes": "National 24/7 lifeline.",
                    "sort_order": 130,
                },
            ),
            (
                "disaster_assistance",
                {
                    "agency_name": "FEMA Disaster Assistance",
                    "phone": "1-800-621-3362",
                    "website": "https://www.disasterassistance.gov",
                    "source_url": "https://www.fema.gov/about/contact",
                    "notes": "Apply at DisasterAssistance.gov after a declared disaster.",
                    "sort_order": 140,
                },
            ),
        ]:
            safety.append(
                {
                    "id": uid("safety", code, extra_cat),
                    "state": code,
                    "category": extra_cat,
                    "agency_name": extra["agency_name"],
                    "phone": extra["phone"],
                    "website": extra["website"],
                    "source_url": extra["source_url"],
                    "notes": extra["notes"],
                    "verified_at": "2026-09-03",
                    "active": True,
                    "sort_order": extra["sort_order"],
                }
            )
    products = [
        {
            "slug": "core",
            "name": "Core",
            "description": "Four core preparedness systems, contacts, printing, and offline access on one device.",
            "amount_cents": 999,
            "currency": "USD",
            "kind": "core",
            "grants_plan": "core",
            "device_slots": 2,
            "active": True,
        },
        {
            "slug": "full",
            "name": "Full System",
            "description": "Everything in Core plus advanced systems and Video Vault.",
            "amount_cents": 1999,
            "currency": "USD",
            "kind": "full",
            "grants_plan": "full",
            "device_slots": 2,
            "active": True,
        },
        {
            "slug": "extra_device",
            "name": "Additional Device",
            "description": "Adds one registered device slot to an existing account.",
            "amount_cents": 500,
            "currency": "USD",
            "kind": "extra_device",
            "grants_plan": None,
            "device_slots": 1,
            "active": True,
        },
        {
            "slug": "upgrade_full",
            "name": "Upgrade to Full System",
            "description": "Upgrade from Core.",
            "amount_cents": 1000,
            "currency": "USD",
            "kind": "upgrade_full",
            "grants_plan": "full",
            "device_slots": 0,
            "active": True,
        },
    ]
    return {
        "systems": systems,
        "sections": sections,
        "items": items,
        "safety": safety,
        "products": products,
    }


def main() -> None:
    (ROOT / "content").mkdir(exist_ok=True)
    catalog_sql, safety_sql = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(catalog_sql)
    safety_path = ROOT / "supabase" / "seed_safety.sql"
    safety_path.write_text(safety_sql)
    catalog_path = ROOT / "src" / "data" / "catalog.json"
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(json.dumps(frontend_catalog(), indent=2) + "\n")
    print(f"Wrote {OUT} ({len(catalog_sql.splitlines())} lines)")
    print(f"Wrote {safety_path} ({len(safety_sql.splitlines())} lines)")
    print(f"Wrote {catalog_path}")


if __name__ == "__main__":
    main()
