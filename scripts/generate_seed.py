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


def item(key: str, text: str, description: str = "") -> dict:
    return {"key": key, "text": text, "description": description}


SYSTEMS = [
    {
        "slug": "grab-go",
        "title": "Grab & Go Bag",
        "time_label": "05 MIN",
        "illustration_key": "backpack",
        "access_tier": "core",
        "sort_order": 10,
        "description": "Immediate evacuation essentials you can secure in minutes.",
        "sections": [
            {
                "slug": "communication",
                "title": "Personal Communication",
                "intro": "Keep these charged and next to the door.",
                "items": [
                    item("grab.communication.phone", "Cell phone (1 per adult), fully charged", "Important contacts saved on the device."),
                    item("grab.communication.powerbank", "Portable phone charger (1 per adult), fully charged", "Include the correct charging cables."),
                ],
            },
            {
                "slug": "financial-id",
                "title": "Financial & Identification",
                "intro": "One set per adult.",
                "items": [
                    item("grab.financial.wallet-id", "Wallet with primary identification", "Driver's license or state ID."),
                    item("grab.financial.cards", "Credit and debit cards"),
                    item("grab.financial.cash", "Cash in small bills", "At least $50–$100 per adult for when electronic systems are down."),
                ],
            },
            {
                "slug": "access",
                "title": "Access & Mobility",
                "intro": "One set per household.",
                "items": [
                    item("grab.access.keys", "Keys", "House, car, storage unit, mailbox."),
                ],
            },
            {
                "slug": "medical",
                "title": "Immediate Medical & Vision",
                "intro": "One set per person who needs them.",
                "items": [
                    item("grab.medical.prescriptions", "Prescription medications (3-day supply)", "Clearly labeled with dosage. Include inhaler, EpiPen, or other devices."),
                    item("grab.medical.glasses", "Glasses or contacts plus solution", "A spare pair if you have one."),
                    item("grab.medical.hearing-aids", "Hearing aids and spare batteries"),
                ],
            },
            {
                "slug": "documents",
                "title": "Vital Documents",
                "intro": "One household set, if easily accessible.",
                "items": [
                    item("grab.documents.passport", "Passport", "If needed as secondary ID or for travel."),
                    item("grab.documents.insurance-cards", "Insurance cards", "Health, auto, and home. Digital copies on your phone help."),
                    item("grab.documents.contact-list", "Family emergency contact list", "Laminated physical list with family, doctors, and an out-of-state contact."),
                ],
            },
            {
                "slug": "survival",
                "title": "Immediate Survival",
                "intro": "One set per person.",
                "items": [
                    item("grab.survival.water", "Water bottle (16–20 oz per person)"),
                    item("grab.survival.flashlight", "Compact flashlight", "Fresh batteries or a hand-crank option."),
                ],
            },
        ],
    },
    {
        "slug": "ready-bag",
        "title": "Ready Duffel",
        "time_label": "15 MIN",
        "illustration_key": "duffel",
        "access_tier": "core",
        "sort_order": 20,
        "description": "A complete 72-hour preparedness bag, packed and ready.",
        "sections": [
            {
                "slug": "documents",
                "title": "Documents",
                "intro": "Store originals in a fireproof, waterproof safe. Carry copies in the bag.",
                "items": [
                    item("ready.documents.passport", "Passport copies (current, 1 per family member)"),
                    item("ready.documents.state-id", "Driver's license / state ID copies"),
                    item("ready.documents.ssn", "Social Security card copies"),
                    item("ready.documents.birth-certs", "Birth certificates"),
                    item("ready.documents.marriage", "Marriage certificate (if applicable)"),
                    item("ready.documents.property", "Property deeds or lease agreements"),
                    item("ready.documents.vehicle-titles", "Vehicle titles / registration"),
                    item("ready.documents.legal", "Wills, power of attorney, advanced directives"),
                    item("ready.documents.medical-records", "Medical records summary", "Conditions, allergies, medications, blood types."),
                    item("ready.documents.vaccinations", "Vaccination records"),
                    item("ready.documents.health-insurance", "Health insurance cards"),
                    item("ready.documents.policies", "Home, auto, and life insurance policies"),
                    item("ready.documents.bank", "Bank account information", "Account numbers and bank contact info."),
                    item("ready.documents.credit", "Credit card information", "Emergency contact numbers for banks."),
                    item("ready.documents.cash", "Small-bill cash ($100–$300 per household)"),
                    item("ready.documents.emergency-sheet", "Laminated emergency contact sheet", "Include out-of-state contacts."),
                    item("ready.documents.phone-list", "Important phone numbers", "Doctors, veterinarians, schools, employers."),
                    item("ready.documents.usb", "Encrypted USB drive", "Scanned copies of vital documents."),
                    item("ready.documents.cloud", "Cloud storage access details"),
                ],
            },
            {
                "slug": "clothing",
                "title": "Clothing",
                "intro": "Three days per person. Prioritize durable, quick-drying layers.",
                "items": [
                    item("ready.clothing.tees", "2–3 moisture-wicking T-shirts"),
                    item("ready.clothing.warm-shirt", "1 warm long-sleeved shirt"),
                    item("ready.clothing.jacket", "1 waterproof / windproof jacket"),
                    item("ready.clothing.pants", "1–2 pairs of durable pants"),
                    item("ready.clothing.shorts", "1 pair of shorts (if climate appropriate)"),
                    item("ready.clothing.underwear", "3 pairs of quick-drying underwear"),
                    item("ready.clothing.socks", "3 pairs of wool or synthetic socks"),
                    item("ready.clothing.rain", "Rain poncho or lightweight rain jacket"),
                    item("ready.clothing.hat", "Warm hat and/or sun hat"),
                    item("ready.clothing.gloves", "Work gloves and warm gloves"),
                    item("ready.clothing.shoes", "Sturdy, broken-in hiking shoes or boots"),
                    item("ready.clothing.sleep", "Comfortable sleeping clothes or extra base layers"),
                ],
            },
            {
                "slug": "hygiene",
                "title": "Hygiene",
                "intro": "Travel-sized items for three days per person.",
                "items": [
                    item("ready.hygiene.toothbrush", "Toothbrush"),
                    item("ready.hygiene.toothpaste", "Travel-sized toothpaste"),
                    item("ready.hygiene.floss", "Dental floss"),
                    item("ready.hygiene.soap", "Soap or travel body wash"),
                    item("ready.hygiene.shampoo", "Travel shampoo or solid shampoo bar"),
                    item("ready.hygiene.wipes", "Wet wipes (large pack, 1 per family)"),
                    item("ready.hygiene.sanitizer", "Alcohol-based hand sanitizer"),
                    item("ready.hygiene.deodorant", "Travel-sized deodorant"),
                    item("ready.hygiene.tp", "Toilet paper (1–2 compact rolls)"),
                    item("ready.hygiene.trowel", "Small trowel for burying waste"),
                    item("ready.hygiene.feminine", "Feminine hygiene products"),
                    item("ready.hygiene.waste-bags", "Small plastic bags for waste"),
                    item("ready.hygiene.razor", "Razor and small shaving cream (if essential)"),
                    item("ready.hygiene.nails", "Nail clippers and small file"),
                    item("ready.hygiene.mirror", "Small mirror"),
                    item("ready.hygiene.sunscreen", "Sunscreen SPF 30+, broad-spectrum"),
                    item("ready.hygiene.lip-balm", "Lip balm with SPF"),
                    item("ready.hygiene.insect", "Insect repellent"),
                ],
            },
            {
                "slug": "medical",
                "title": "Medical",
                "intro": "Customize to your household. Check expiration dates.",
                "items": [
                    item("ready.medical.bandages", "Assorted adhesive bandages"),
                    item("ready.medical.gauze", "Sterile gauze pads (2x2 and 4x4)"),
                    item("ready.medical.tape", "Adhesive medical tape"),
                    item("ready.medical.antiseptic", "Antiseptic wipes or solution"),
                    item("ready.medical.antibiotic", "Antibiotic ointment"),
                    item("ready.medical.hydrocortisone", "Hydrocortisone cream"),
                    item("ready.medical.burn", "Burn gel or cream"),
                    item("ready.medical.pain", "Pain relievers (ibuprofen, acetaminophen)"),
                    item("ready.medical.allergy", "Antihistamines"),
                    item("ready.medical.antidiarrheal", "Anti-diarrheal medication"),
                    item("ready.medical.antacid", "Antacid"),
                    item("ready.medical.laxative", "Mild laxative"),
                    item("ready.medical.electrolytes", "Oral rehydration salts or electrolyte packets"),
                    item("ready.medical.scissors", "Small scissors"),
                    item("ready.medical.tweezers", "Tweezers"),
                    item("ready.medical.pins", "Safety pins"),
                    item("ready.medical.thermometer", "Digital thermometer with spare batteries"),
                    item("ready.medical.gloves", "Disposable gloves"),
                    item("ready.medical.cpr", "CPR face shield"),
                    item("ready.medical.blister", "Moleskin or blister treatment"),
                    item("ready.medical.eyewash", "Eye wash solution"),
                    item("ready.medical.prescriptions", "Prescription medications (7–30 day supply)"),
                    item("ready.medical.devices", "Personal medical devices", "Glucose meter, BP cuff, spare glasses."),
                ],
            },
            {
                "slug": "communications",
                "title": "Communications",
                "intro": "Stay informed when networks are strained.",
                "items": [
                    item("ready.comms.noaa", "NOAA weather radio", "Battery-powered or hand-crank."),
                    item("ready.comms.amfm", "Portable AM/FM radio"),
                    item("ready.comms.hand-crank", "Hand-crank or solar-powered radio backup"),
                    item("ready.comms.powerbanks", "Portable power banks (10,000 mAh+)"),
                    item("ready.comms.cables", "Charging cables for all phones and devices"),
                    item("ready.comms.solar", "Solar charger"),
                    item("ready.comms.batteries", "Extra batteries (AA, AAA, D, 9V)"),
                    item("ready.comms.whistle", "Whistle (1 per person)"),
                    item("ready.comms.signal-mirror", "Signal mirror"),
                    item("ready.comms.maps", "Physical local and regional maps"),
                    item("ready.comms.compass", "Compass"),
                    item("ready.comms.meeting-points", "Family meeting points written down", "Local and out-of-area."),
                    item("ready.comms.out-of-state", "Out-of-state check-in contact"),
                    item("ready.comms.written-numbers", "Laminated list of important phone numbers"),
                ],
            },
            {
                "slug": "food-water",
                "title": "Food & Water",
                "intro": "Aim for 2,000 calories per person per day for 3 days. No-cook foods first.",
                "items": [
                    item("ready.food.water", "1 gallon of water per person per day (3-day supply)"),
                    item("ready.food.purification", "Water purification tablets or portable filter"),
                    item("ready.food.bars", "Energy / granola bars (9–12 per person)"),
                    item("ready.food.dried-fruit", "Dried fruit"),
                    item("ready.food.nuts", "Nuts and seeds"),
                    item("ready.food.peanut-butter", "Peanut butter (plastic jar or packets)"),
                    item("ready.food.canned-meat", "Canned meat, pop-top preferred"),
                    item("ready.food.canned-veg", "Canned vegetables, pop-top preferred"),
                    item("ready.food.oatmeal", "Instant oatmeal packets"),
                    item("ready.food.crackers", "Crackers or pilot bread"),
                    item("ready.food.candy", "Hard candy or gum"),
                    item("ready.food.can-opener", "Manual can opener"),
                    item("ready.food.mess-kit", "Mess kit (plate, cup, fork, spoon)"),
                    item("ready.food.stove", "Portable stove and fuel (outdoor use only)"),
                    item("ready.food.matches", "Waterproof matches or lighter"),
                    item("ready.food.foil", "Heavy-duty aluminum foil"),
                    item("ready.food.baby", "Baby formula and baby food (if needed)"),
                    item("ready.food.pet", "Pet food (if needed)"),
                    item("ready.food.electrolytes", "Electrolyte packets"),
                ],
            },
        ],
    },
    {
        "slug": "vehicle-suitcase",
        "title": "Vehicle & Suitcase",
        "time_label": "20 MIN",
        "illustration_key": "suv",
        "access_tier": "core",
        "sort_order": 30,
        "description": "Vehicle readiness, evacuation packing, and special considerations.",
        "sections": [
            {
                "slug": "vehicle-repair",
                "title": "Vehicle Maintenance & Repair",
                "intro": "Keep a durable kit in the trunk. Review quarterly.",
                "items": [
                    item("vehicle.safety.jumper-cables", "Jumper cables or portable jump starter"),
                    item("vehicle.safety.tire-inflator", "12V tire inflator and plug kit"),
                    item("vehicle.safety.tool-kit", "Basic tool kit"),
                    item("vehicle.safety.tow-strap", "Tow strap rated for your vehicle"),
                    item("vehicle.safety.tape", "Duct tape or electrical tape"),
                    item("vehicle.safety.fuses", "Spare fuses"),
                ],
            },
            {
                "slug": "vehicle-visibility",
                "title": "Safety & Visibility",
                "items": [
                    item("vehicle.visibility.flares", "Road flares or reflective triangles"),
                    item("vehicle.visibility.vest", "Reflective safety vest"),
                    item("vehicle.visibility.extinguisher", "ABC-rated automotive fire extinguisher"),
                    item("vehicle.visibility.window-tool", "Seat belt cutter and window breaker"),
                ],
            },
            {
                "slug": "vehicle-survival",
                "title": "Personal Comfort & Survival",
                "items": [
                    item("vehicle.comfort.blankets", "Warm blankets or sleeping bags"),
                    item("vehicle.comfort.ponchos", "Rain ponchos"),
                    item("vehicle.comfort.shoes", "Extra shoes or boots"),
                    item("vehicle.comfort.ice-scraper", "Ice scraper and small shovel"),
                    item("vehicle.comfort.gloves", "Work gloves"),
                    item("vehicle.comfort.lights", "Flashlights or headlamps with extra batteries"),
                    item("vehicle.comfort.maps", "Physical maps (local and regional)"),
                    item("vehicle.comfort.water", "Emergency water bottles"),
                    item("vehicle.comfort.snacks", "Non-perishable snacks (1–2 day supply)"),
                    item("vehicle.comfort.charger", "Car phone charger and power bank"),
                    item("vehicle.comfort.first-aid", "Basic vehicle first aid kit"),
                    item("vehicle.comfort.fuel-can", "Empty fuel can stored safely", "Fill only when needed and follow local regulations."),
                ],
            },
            {
                "slug": "suitcase",
                "title": "Evacuation Suitcase",
                "intro": "If you have about 20 minutes, pack continuity — not just survival.",
                "items": [
                    item("vehicle.suitcase.ids", "Original IDs and a second set of document copies"),
                    item("vehicle.suitcase.meds", "Full current medication bottles"),
                    item("vehicle.suitcase.chargers", "Device chargers and a spare power bank"),
                    item("vehicle.suitcase.clothes", "3–5 days of season-appropriate clothing"),
                    item("vehicle.suitcase.toiletries", "Toiletry kit"),
                    item("vehicle.suitcase.comfort", "Comfort items for children"),
                    item("vehicle.suitcase.work", "Work or school essentials you cannot replace"),
                    item("vehicle.suitcase.valuables", "Irreplaceable small valuables", "Only what you can carry. Photos of the rest help insurance."),
                ],
            },
            {
                "slug": "pets",
                "title": "Special Considerations: Pets",
                "items": [
                    item("vehicle.pets.carrier", "Pet carrier or crate"),
                    item("vehicle.pets.leash", "Leash, harness, and ID tags"),
                    item("vehicle.pets.food-water", "3-day pet food and water"),
                    item("vehicle.pets.meds", "Pet medications and vaccination records"),
                    item("vehicle.pets.waste", "Waste bags and litter supplies"),
                    item("vehicle.pets.photo", "Current photo of each pet"),
                ],
            },
            {
                "slug": "babies",
                "title": "Special Considerations: Babies",
                "items": [
                    item("vehicle.babies.diapers", "Diapers, wipes, and cream"),
                    item("vehicle.babies.formula", "Formula, bottles, and extra water"),
                    item("vehicle.babies.food", "Baby food and feeding spoons"),
                    item("vehicle.babies.clothes", "Extra clothes and swaddles"),
                    item("vehicle.babies.carrier", "Baby carrier"),
                    item("vehicle.babies.comfort", "Pacifiers and a familiar comfort item"),
                ],
            },
            {
                "slug": "seniors",
                "title": "Special Considerations: Seniors",
                "items": [
                    item("vehicle.seniors.meds", "Medications, list of doses, and prescriber contacts"),
                    item("vehicle.seniors.devices", "Mobility aids, spare batteries, glasses"),
                    item("vehicle.seniors.records", "Medical summary and advance directives"),
                    item("vehicle.seniors.comfort", "Incontinence supplies and extra layers"),
                    item("vehicle.seniors.contacts", "Caregiver and facility contact numbers"),
                ],
            },
        ],
    },
    {
        "slug": "home-resilience",
        "title": "Home Resilience",
        "time_label": "60 MIN",
        "illustration_key": "cabin",
        "access_tier": "core",
        "sort_order": 40,
        "description": "Water, food, power, communications, and home preparedness.",
        "sections": [
            {
                "slug": "detection",
                "title": "Safety & Detection",
                "intro": "Test monthly. Replace batteries on a schedule.",
                "items": [
                    item("home.safety.smoke", "Smoke detectors on each floor and sleeping area"),
                    item("home.safety.co", "Carbon monoxide detectors near sleeping areas"),
                    item("home.safety.extinguishers", "ABC fire extinguishers (1 per floor)"),
                    item("home.safety.escape", "Two exit paths from every bedroom"),
                    item("home.safety.meeting", "Household meeting place posted inside the home"),
                ],
            },
            {
                "slug": "utilities",
                "title": "Utility Management",
                "items": [
                    item("home.utilities.water-wrench", "Water shutoff wrench", "Know the main valve location."),
                    item("home.utilities.gas-tool", "Gas shutoff tool (if applicable)"),
                    item("home.utilities.panel", "Electrical panel diagram with labeled circuits"),
                    item("home.utilities.practice", "Practice shutting off water, gas, and power"),
                ],
            },
            {
                "slug": "lighting",
                "title": "Lighting & Power",
                "items": [
                    item("home.power.lanterns", "Backup lanterns or headlamps (1–2 per room)"),
                    item("home.power.batteries", "Extra batteries in common sizes"),
                    item("home.power.radio", "NOAA weather radio in a central location"),
                    item("home.power.power-station", "Portable power station for phones and medical devices"),
                    item("home.power.cords", "Heavy-duty extension cords and power strips"),
                    item("home.power.generator-plan", "Generator plan if you own one", "Never run indoors. Know fuel storage rules."),
                ],
            },
            {
                "slug": "water",
                "title": "Water",
                "items": [
                    item("home.water.storage", "Stored water: 1 gallon per person per day, 14 days"),
                    item("home.water.containers", "Food-grade water containers, labeled and dated"),
                    item("home.water.rotation", "Water rotation schedule (every 6–12 months)"),
                    item("home.water.bleach", "Unscented household bleach for emergency disinfection", "Follow CDC / Ready.gov guidance only."),
                    item("home.water.filter", "Household water filter or gravity filter"),
                    item("home.water.bathtub-bag", "Tub-liner water bladder or known fill method"),
                ],
            },
            {
                "slug": "food",
                "title": "Food Stores",
                "items": [
                    item("home.food.two-week", "Two-week pantry of no-cook or low-cook meals"),
                    item("home.food.manual-opener", "Manual can opener (plus a spare)"),
                    item("home.food.rotation", "First-in, first-out rotation labels"),
                    item("home.food.special-diet", "Special diet, infant, and pet supplies"),
                    item("home.food.cooking", "Off-grid cooking method that is safe outdoors"),
                ],
            },
            {
                "slug": "communications",
                "title": "Communications",
                "items": [
                    item("home.comms.plan", "Written family communication plan"),
                    item("home.comms.out-of-area", "Out-of-area contact who will take check-ins"),
                    item("home.comms.radio", "Battery or crank radio with extra power"),
                    item("home.comms.paper-list", "Paper copy of Safety Prep List contacts"),
                    item("home.comms.alert", "Wireless emergency alerts enabled on phones"),
                ],
            },
            {
                "slug": "home-readiness",
                "title": "Home Readiness",
                "items": [
                    item("home.ready.flashlights", "Flashlight in every occupied bedroom"),
                    item("home.ready.shoes", "Closed-toe shoes under each bed"),
                    item("home.ready.cash", "Small cash reserve at home"),
                    item("home.ready.tools", "Basic hand tools and work gloves"),
                    item("home.ready.plastic", "Plastic sheeting, duct tape, and a tarp"),
                    item("home.ready.sanitation", "Emergency sanitation supplies"),
                    item("home.ready.insurance", "Home inventory photos stored off-site or in the cloud"),
                    item("home.ready.go-bags", "Go-bags staged near an exit"),
                ],
            },
            {
                "slug": "skills",
                "title": "Skills Checklist",
                "items": [
                    item("home.skills.first-aid", "Household members know basic first aid and CPR"),
                    item("home.skills.fire", "Everyone can use a fire extinguisher"),
                    item("home.skills.shutoffs", "Adults can locate and operate utility shutoffs"),
                    item("home.skills.routes", "Two evacuation routes from home are practiced"),
                    item("home.skills.water", "Someone can treat water by boiling or filtering"),
                    item("home.skills.radio", "Someone can operate the weather radio"),
                ],
            },
        ],
    },
    {
        "slug": "off-grid",
        "title": "Off-Grid Systems",
        "time_label": "FULL",
        "illustration_key": "lantern",
        "access_tier": "full",
        "sort_order": 50,
        "description": "Low-tech tools, sanitation, cooking, and manual household systems.",
        "sections": [
            {
                "slug": "low-tech",
                "title": "Low-Tech Preparedness",
                "items": [
                    item("offgrid.lowtech.hand-tools", "Hand tools that do not require electricity"),
                    item("offgrid.lowtech.manual-pump", "Manual water transfer method"),
                    item("offgrid.lowtech.light", "Non-electric lighting plan"),
                    item("offgrid.lowtech.analog", "Analog clock, paper maps, paper records"),
                    item("offgrid.lowtech.repair", "Basic repair kit: fasteners, cordage, tape, glue"),
                ],
            },
            {
                "slug": "sanitation",
                "title": "Emergency Sanitation",
                "items": [
                    item("offgrid.sanitation.toilet-plan", "Toilet plan if water or sewer fails"),
                    item("offgrid.sanitation.bags", "Heavy waste bags and absorbent material"),
                    item("offgrid.sanitation.handwash", "Handwashing station independent of tap water"),
                    item("offgrid.sanitation.hygiene", "Two-week hygiene supply"),
                    item("offgrid.sanitation.trash", "Trash storage plan that keeps pests out"),
                ],
            },
            {
                "slug": "cooking",
                "title": "Alternative Cooking",
                "items": [
                    item("offgrid.cooking.outdoor", "Outdoor-only cooking method identified"),
                    item("offgrid.cooking.fuel", "Stored fuel appropriate to that method"),
                    item("offgrid.cooking.kettle", "Kettle or pot that works on that heat source"),
                    item("offgrid.cooking.ventilation", "Ventilation and carbon monoxide awareness"),
                    item("offgrid.cooking.fire-safe", "Fire-safe surface and extinguisher nearby"),
                ],
            },
            {
                "slug": "household",
                "title": "Manual Household Systems",
                "items": [
                    item("offgrid.house.laundry", "No-power laundry method"),
                    item("offgrid.house.dishes", "Dishwashing with limited water"),
                    item("offgrid.house.heat", "Passive warmth: layers, blankets, one-room strategy"),
                    item("offgrid.house.cooling", "Passive cooling: shade, airflow, hydration"),
                    item("offgrid.house.security", "Simple home security without powered cameras"),
                ],
            },
        ],
    },
    {
        "slug": "water-purification",
        "title": "Water Purification",
        "time_label": "FULL",
        "illustration_key": "filter",
        "access_tier": "full",
        "sort_order": 60,
        "description": "Storage, filtration, purification, rotation, and emergency collection.",
        "sections": [
            {
                "slug": "storage",
                "title": "Water Storage",
                "items": [
                    item("water.storage.volume", "Calculate household gallons for 14 days"),
                    item("water.storage.containers", "Food-grade containers only"),
                    item("water.storage.cool-dark", "Store in a cool, dark place off concrete when possible"),
                    item("water.storage.date", "Date every container"),
                    item("water.storage.spigot", "A way to dispense without contaminating the supply"),
                ],
            },
            {
                "slug": "treatment",
                "title": "Filtration & Purification",
                "items": [
                    item("water.treat.filter", "Mechanical filter rated for bacteria (and protozoa)"),
                    item("water.treat.backup", "Backup method: boil or chemical"),
                    item("water.treat.boil", "Boil plan: pot, heat source, rolling boil time"),
                    item("water.treat.chemical", "Chemical treatment stored correctly", "Follow the product label and public-health guidance."),
                    item("water.treat.clear", "Pre-filter cloudy water through cloth"),
                ],
            },
            {
                "slug": "hygiene-water",
                "title": "Clean vs Dirty Containers",
                "items": [
                    item("water.hygiene.color", "Mark clean and dirty containers differently"),
                    item("water.hygiene.never-mix", "Never dip a used cup in stored water"),
                    item("water.hygiene.sanitize", "Sanitize containers before refill"),
                    item("water.hygiene.rotation", "Rotate stored water on a calendar"),
                ],
            },
            {
                "slug": "collection",
                "title": "Emergency Collection",
                "items": [
                    item("water.collect.hot-water-tank", "Know whether your water heater can be a reserve"),
                    item("water.collect.ice", "Use freezer ice as known-clean water"),
                    item("water.collect.rain", "Rain collection only with a planned, treatable method"),
                    item("water.collect.avoid", "Avoid floodwater, chemical runoff, and unknown wells until treated"),
                ],
            },
        ],
    },
    {
        "slug": "cooling-heat",
        "title": "Cooling & Heat Resilience",
        "time_label": "FULL",
        "illustration_key": "compass",
        "access_tier": "full",
        "sort_order": 70,
        "description": "Blackout cooling, safe warmth, hydration, and room planning.",
        "sections": [
            {
                "slug": "cooling",
                "title": "Battery-Powered Cooling",
                "items": [
                    item("climate.cool.fan", "Battery or USB fan for a single sleep space"),
                    item("climate.cool.power", "Power budget for fans vs medical devices"),
                    item("climate.cool.towels", "Cooling towels and water for wrists/neck"),
                    item("climate.cool.hydration", "Extra water and electrolytes in heat"),
                    item("climate.cool.shade", "Shade the sun-facing windows"),
                ],
            },
            {
                "slug": "rooms",
                "title": "Shaded Rooms & Ventilation",
                "items": [
                    item("climate.rooms.coolest", "Identify the coolest room in the home"),
                    item("climate.rooms.night-air", "Night-air strategy: open when outdoor air is cooler"),
                    item("climate.rooms.block-sun", "Blackout or reflective window coverings"),
                    item("climate.rooms.one-room", "One-room living plan during a heat or cold event"),
                ],
            },
            {
                "slug": "blackout",
                "title": "Blackout Strategies",
                "items": [
                    item("climate.blackout.meds", "Know which medications need temperature control"),
                    item("climate.blackout.fridge", "Fridge/freezer: keep closed; freeze water bottles"),
                    item("climate.blackout.neighbors", "Check-on plan for neighbors at higher risk"),
                    item("climate.blackout.cooling-center", "Know how you will learn about local cooling or warming centers"),
                ],
            },
            {
                "slug": "heat",
                "title": "Safe Warmth",
                "items": [
                    item("climate.heat.layers", "Layered clothing and blankets staged"),
                    item("climate.heat.no-indoor-burn", "No indoor charcoal, camp stoves, or unvented combustion"),
                    item("climate.heat.co", "Working CO detector if any fuel appliance is used"),
                    item("climate.heat.pipes", "Pipe-protection plan in freezing weather"),
                ],
            },
        ],
    },
    {
        "slug": "battery-solar",
        "title": "Home Battery & Solar",
        "time_label": "FULL",
        "illustration_key": "solar",
        "access_tier": "full",
        "sort_order": 80,
        "description": "Essential loads, portable power, solar input, and safe charging.",
        "sections": [
            {
                "slug": "loads",
                "title": "Essential Load Planning",
                "items": [
                    item("power.loads.list", "List devices that must stay on"),
                    item("power.loads.watts", "Write wattage for each essential device"),
                    item("power.loads.priority", "Priority order: medical, comms, lighting, food"),
                    item("power.loads.cut", "List what you will turn off first"),
                ],
            },
            {
                "slug": "capacity",
                "title": "Battery Capacity & Stations",
                "items": [
                    item("power.cap.station", "Portable power station sized to overnight essentials"),
                    item("power.cap.banks", "Phone power banks kept charged"),
                    item("power.cap.cables", "Correct cables labeled and stored together"),
                    item("power.cap.test", "Quarterly discharge/recharge test"),
                ],
            },
            {
                "slug": "solar",
                "title": "Solar Input",
                "items": [
                    item("power.solar.panel", "Foldable or rooftop panel compatible with your station"),
                    item("power.solar.placement", "Known sunny placement that is theft-aware"),
                    item("power.solar.weather", "Cloud/short-winter-day expectations written down"),
                    item("power.solar.charge-controller", "Do not improvise incompatible charging"),
                ],
            },
            {
                "slug": "safety",
                "title": "Safe Charging & Maintenance",
                "items": [
                    item("power.safe.ventilation", "Charge batteries in a dry, ventilated place"),
                    item("power.safe.no-overstack", "Do not daisy-chain cheap inverters unsafely"),
                    item("power.safe.medical", "Medical-device charging is never optional in the queue"),
                    item("power.safe.manuals", "Keep manufacturer manuals with the kit"),
                ],
            },
        ],
    },
    {
        "slug": "long-term-food",
        "title": "Long-Term Food",
        "time_label": "FULL",
        "illustration_key": "pine",
        "access_tier": "full",
        "sort_order": 90,
        "description": "Pantry planning, rotation, staples, preservation, and manual prep.",
        "sections": [
            {
                "slug": "pantry",
                "title": "Pantry Planning",
                "items": [
                    item("food.pantry.calories", "Estimate daily calories for everyone in the home"),
                    item("food.pantry.thirty", "Build toward 30 days of familiar foods"),
                    item("food.pantry.no-cook", "Keep a no-cook subset for the first 72 hours"),
                    item("food.pantry.diet", "Account for allergies and medical diets"),
                ],
            },
            {
                "slug": "staples",
                "title": "Long-Term Staples",
                "items": [
                    item("food.staples.grains", "Rice, oats, or other household grains"),
                    item("food.staples.beans", "Beans or other proteins you already eat"),
                    item("food.staples.oils", "Cooking oil with a realistic shelf life"),
                    item("food.staples.salt-sugar", "Salt, sugar, and spices you will actually use"),
                    item("food.staples.comfort", "A few morale foods"),
                ],
            },
            {
                "slug": "rotation",
                "title": "Rotation & Preservation",
                "items": [
                    item("food.rotate.labels", "Date every package"),
                    item("food.rotate.fifo", "Use oldest first"),
                    item("food.rotate.pests", "Pest-proof storage"),
                    item("food.rotate.preserve", "One preservation method you already practice", "Freezing, canning, dehydrating, or fermenting — only methods you know."),
                ],
            },
            {
                "slug": "garden-prep",
                "title": "Gardening & Manual Prep",
                "items": [
                    item("food.grow.seeds", "A small seed kit for foods you will eat"),
                    item("food.grow.tools", "Hand tools for a patio or yard plot"),
                    item("food.grow.water", "Water plan for plants that does not compete with drinking water in a crisis"),
                    item("food.grow.manual", "Manual food prep: grinder, mill, or just a good knife and board"),
                ],
            },
        ],
    },
]


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


VIDEOS = [
    {
        "title": "Build a kit — start with water, food, and light",
        "description": "Owner: replace this placeholder with a licensed or original Safety Prep List video. Kept inactive until a URL is added.",
        "video_url": None,
        "thumbnail_url": None,
        "category": "Home Readiness",
        "source_name": "Safety Prep List",
        "sort_order": 10,
        "active": False,
    },
    {
        "title": "Water: store, treat, rotate",
        "description": "Placeholder for a short lesson on household water. Add a video URL in Supabase to publish.",
        "video_url": None,
        "thumbnail_url": None,
        "category": "Water",
        "source_name": "Safety Prep List",
        "sort_order": 20,
        "active": False,
    },
    {
        "title": "Power when the grid is down",
        "description": "Placeholder for battery, charging, and load-priority teaching.",
        "video_url": None,
        "thumbnail_url": None,
        "category": "Power",
        "source_name": "Safety Prep List",
        "sort_order": 30,
        "active": False,
    },
    {
        "title": "Off-grid sanitation and cooking",
        "description": "Placeholder for low-tech household systems.",
        "video_url": None,
        "thumbnail_url": None,
        "category": "Off Grid",
        "source_name": "Safety Prep List",
        "sort_order": 40,
        "active": False,
    },
    {
        "title": "Pantry that you will actually eat",
        "description": "Placeholder for long-term food planning.",
        "video_url": None,
        "thumbnail_url": None,
        "category": "Food",
        "source_name": "Safety Prep List",
        "sort_order": 50,
        "active": False,
    },
    {
        "title": "Stay reachable: radios and family plans",
        "description": "Placeholder for communications skills.",
        "video_url": None,
        "thumbnail_url": None,
        "category": "Communications",
        "source_name": "Safety Prep List",
        "sort_order": 60,
        "active": False,
    },
    {
        "title": "Heat and cooling without HVAC",
        "description": "Placeholder for climate-resilience skills.",
        "video_url": None,
        "thumbnail_url": None,
        "category": "Cooling / Heat",
        "source_name": "Safety Prep List",
        "sort_order": 70,
        "active": False,
    },
    {
        "title": "Emergency skills: extinguishers, shutoffs, first aid",
        "description": "Placeholder for practical home-readiness skills.",
        "video_url": None,
        "thumbnail_url": None,
        "category": "Emergency Skills",
        "source_name": "Safety Prep List",
        "sort_order": 80,
        "active": False,
    },
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
                    f"insert into public.checklist_items (section_id, permanent_key, text, description, sort_order, active)"
                    f" select sec.id, {esc(it['key'])}, {esc(it['text'])}, {esc(it.get('description') or '')}, {ii * 10}, true"
                    f" from public.checklist_sections sec"
                    f" join public.checklist_systems sys on sys.id = sec.system_id"
                    f" where sys.slug = {esc(sys['slug'])} and sec.slug = {esc(sec['slug'])}"
                    f" on conflict (permanent_key) do update set text = excluded.text, description = excluded.description, sort_order = excluded.sort_order, section_id = excluded.section_id, active = true;"
                )
        lines.append("")

    catalog_sql = "\n".join(lines) + "\n"
    extra = [
        "-- Generated by scripts/generate_seed.py — safety contacts and video placeholders.",
        "-- Run AFTER supabase/seed.sql.",
        "",
    ]

    for rec in NATIONAL_SAFETY:
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(rec['state'])}, {esc(rec['category'])}, {esc(rec['agency_name'])}, {esc(rec['phone'])}, {esc(rec['website'])}, {esc(rec['source_url'])}, {esc(rec['notes'])}, {esc(rec['verified_at'])}::date, true, {rec['sort_order']}"
            ");"
        )

    extra.append("")
    for code, name, url in STATE_EMA:
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'state_emergency_management', {esc(name)}, NULL, {esc(url)}, {esc('https://www.usa.gov/state-emergency-management')}, {esc('Official state emergency-management website. Confirm the current public phone number on the agency site before publishing it here.')}, '2026-09-03'::date, true, 100"
            ");"
        )
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'weather', 'National Weather Service', NULL, {esc('https://www.weather.gov')}, {esc('https://www.weather.gov')}, {esc('Enter a local city on weather.gov for forecasts and alerts.')}, '2026-09-03'::date, true, 110"
            ");"
        )
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'poison_control', 'Poison Control', {esc('1-800-222-1222')}, {esc('https://www.poison.org')}, {esc('https://www.poison.org')}, {esc('National number; routes to the poison center serving this state.')}, '2026-09-03'::date, true, 120"
            ");"
        )
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'crisis_support', '988 Suicide & Crisis Lifeline', {esc('988')}, {esc('https://988lifeline.org')}, {esc('https://www.samhsa.gov/find-help/988')}, {esc('National 24/7 lifeline.')}, '2026-09-03'::date, true, 130"
            ");"
        )
        extra.append(
            "insert into public.safety_contacts (state, category, agency_name, phone, website, source_url, notes, verified_at, active, sort_order) values ("
            f"{esc(code)}, 'disaster_assistance', 'FEMA Disaster Assistance', {esc('1-800-621-3362')}, {esc('https://www.disasterassistance.gov')}, {esc('https://www.fema.gov/about/contact')}, {esc('Apply at DisasterAssistance.gov after a declared disaster.')}, '2026-09-03'::date, true, 140"
            ");"
        )

    extra.append("")
    for v in VIDEOS:
        extra.append(
            "insert into public.video_resources (title, description, video_url, thumbnail_url, category, source_name, sort_order, active) values ("
            f"{esc(v['title'])}, {esc(v['description'])}, {esc(v['video_url'])}, {esc(v['thumbnail_url'])}, {esc(v['category'])}, {esc(v['source_name'])}, {v['sort_order']}, {sql_bool(v['active'])}"
            ");"
        )

    extra.append("")
    catalog = {
        "systems": [
            {
                "slug": s["slug"],
                "title": s["title"],
                "item_count": sum(len(sec["items"]) for sec in s["sections"]),
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
                        "active": True,
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
    videos = [
        {
            "id": uid("video", v["title"]),
            "title": v["title"],
            "description": v["description"],
            "video_url": v["video_url"],
            "thumbnail_url": v["thumbnail_url"],
            "category": v["category"],
            "source_name": v["source_name"],
            "sort_order": v["sort_order"],
            "active": v["active"],
        }
        for v in VIDEOS
    ]
    products = [
        {
            "slug": "core",
            "name": "Core",
            "description": "Four core preparedness systems, contacts, printing, and two devices.",
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
        "videos": videos,
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
