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


SYSTEMS = [
    {
        "slug": "grab-go",
        "title": "5-Minute Grab-and-Go Bag",
        "time_label": "05 MIN",
        "illustration_key": "backpack",
        "access_tier": "core",
        "sort_order": 10,
        "description": "A backpack near the exit for when you need to leave. This is the minimum critical layer, not the whole preparedness system.",
        "sections": [
            {
                "slug": "communication",
                "title": "Communication & Light",
                "intro": "Keep these charged and next to the door.",
                "items": [
                    qs("grab.communication.phone", "Cell phone", "One per adult, fully charged, with important contacts saved on the device."),
                    qs("grab.communication.powerbank", "Correct charging cable", "The cable that actually fits your phone."),
                    qs("grab.communication.bank", "Compact power bank", "Charged, and small enough for the bag."),
                    qs("grab.survival.flashlight", "Small flashlight or headlamp", "Fresh batteries or a hand-crank option."),
                    qs("grab.communication.whistle", "Whistle", "One you can reach without opening the whole bag."),
                ],
            },
            {
                "slug": "financial-id",
                "title": "Identification & Money",
                "intro": "One set per adult.",
                "items": [
                    qs("grab.financial.wallet-id", "Driver's license or state ID"),
                    qs("grab.access.keys", "Keys", "House, car, storage unit, mailbox."),
                    qs("grab.financial.cards", "Payment card"),
                    qs("grab.financial.cash", "Small amount of cash", "Small bills, for when cards do not work."),
                    qs("grab.documents.contact-list", "Emergency contacts", "Family, doctors, and one out-of-state contact. Laminate or bag it."),
                ],
            },
            {
                "slug": "access",
                "title": "Grab It",
                "intro": "The bag should be accessible near the exit, not buried in a closet.",
                "items": [
                    qs("grab.access.bag", "Backpack accessible near the exit", "The bag you would actually grab. Not one stored in a closet."),
                    item("grab.access.mobility-aids", "Mobility aids (if needed)", "Keep one within reach of the door, plus any spare batteries or charger."),
                ],
            },
            {
                "slug": "medical",
                "title": "Immediate Personal Needs",
                "intro": "One set per person who needs them.",
                "items": [
                    qs("grab.survival.water", "Water bottle", "16–20 oz per person."),
                    qs("grab.medical.prescriptions", "Essential prescription medication", "The doses you cannot miss. Clearly labeled."),
                    qs("grab.medical.med-card", "Written medication and allergy information", "Names, doses, and allergies on paper. Not stored only in an app."),
                    qs("grab.survival.snack", "High-calorie snack"),
                    qs("grab.survival.n95", "Mask or respirator for smoke and dust", "One per person, in a zip bag. Choose a mask that fits the smoke or dust you actually face."),
                    qs("grab.survival.sanitizer", "Hand sanitizer and tissues"),
                    item("grab.medical.glasses", "Spare glasses or contact supplies", "A spare pair if you have one, plus solution for contacts."),
                    item("grab.medical.hearing-aids", "Hearing-aid supplies", "Include spare batteries."),
                    item("grab.medical.mini-kit", "First-aid supplies", "A few bandages, gauze, and wipes in a small pouch."),
                    item("grab.medical.device-accessories", "Medical-device accessories", "Spare sensors, batteries, or tubing you already use."),
                ],
            },
            {
                "slug": "documents",
                "title": "Additional Grab-and-Go Items",
                "more_title": "Additional Grab-and-Go Items",
                "intro": "Useful once the bag by the door is already packed.",
                "items": [
                    item("grab.documents.passport", "Passport and vital document copies", "Copies, not the only original, if you can grab them quickly."),
                    item("grab.documents.insurance-cards", "Insurance information", "Health, auto, and home. A photo on your phone helps."),
                    item("grab.documents.out-of-area", "Out-of-area contact information", "One person outside your region who can take check-ins."),
                    item("grab.documents.pouch", "Waterproof document pouch"),
                    item("grab.documents.digital", "Secure digital document backup", "Encrypted copies you can open without the bag."),
                    item("grab.documents.batteries", "Spare batteries"),
                    item("grab.documents.map", "Paper map"),
                    item("grab.documents.note", "Pencil and waterproof note card"),
                    item("grab.documents.layer", "Seasonal layer or rain protection"),
                ],
            },
            {
                "slug": "survival",
                "title": "Water, Food & Protection",
                "intro": "Kept for anything you add yourself. The primary water, light, and protection items are in the sections above.",
                "items": [],
            },
        ],
    },
    {
        "slug": "ready-bag",
        "title": "15-Minute Ready Duffel",
        "time_label": "15 MIN",
        "illustration_key": "duffel",
        "access_tier": "core",
        "sort_order": 20,
        "description": "72-Hour Continuity Kit. A larger duffel for about 72 hours, adjusted for climate, travel, medical needs, children, and pets.",
        "sections": [
            {
                "slug": "documents",
                "title": "Documents",
                "more_title": "Documents & Copies",
                "intro": "Store originals in a fireproof, waterproof safe. Carry copies in the bag.",
                "items": [
                    item("ready.documents.passport", "Passport copies (current, 1 per family member)"),
                    item("ready.documents.state-id", "Driver's license / state ID copies"),
                    hidden("ready.documents.ssn", "Social Security card copies"),
                    item("ready.documents.birth-certs", "Birth certificates"),
                    item("ready.documents.marriage", "Marriage certificate (if needed)"),
                    item("ready.documents.property", "Property deeds or lease agreements"),
                    item("ready.documents.vehicle-titles", "Vehicle titles / registration"),
                    item("ready.documents.legal", "Wills, power of attorney, advanced directives"),
                    item("ready.documents.medical-records", "Medical records summary", "Conditions, allergies, medications, blood types."),
                    item("ready.documents.vaccinations", "Vaccination records"),
                    item("ready.documents.health-insurance", "Health insurance cards"),
                    item("ready.documents.policies", "Home, auto, and life insurance policies"),
                    item("ready.documents.bank", "Bank emergency phone number", "Customer-service number only. Keep account numbers and PINs off paper."),
                    item("ready.documents.credit", "Card issuer phone numbers", "Issuer numbers and last four digits only. Know how to freeze your credit if cards are lost."),
                    item("ready.documents.cash", "Backup cash reserve ($100–$300 per household, small bills)", "Separate from the cash in your grab-and-go bag. Keep it in a hidden pocket."),
                    item("ready.documents.emergency-sheet", "Laminated emergency contact sheet", "Names, phones, doctors, vet, school, work, poison control, and an out-of-state check-in person."),
                    hidden("ready.documents.phone-list", "Important phone numbers", "Doctors, veterinarians, schools, employers."),
                    item("ready.documents.usb", "Encrypted USB drive", "Encrypted copies of IDs, policies, photos, and your Social Security card. Test that it opens on another computer."),
                    item("ready.documents.cloud", "Cloud and password-manager recovery info", "Write recovery steps, not passwords. Keep any recovery codes sealed and separate."),
                ],
            },
            {
                "slug": "clothing",
                "title": "Clothing & Protection",
                "more_title": "More Clothing & Protection",
                "intro": "Three days per person. Prioritize durable, quick-drying layers.",
                "items": [
                    qs("ready.clothing.tees", "Shirts and base layers"),
                    item("ready.clothing.warm-shirt", "Extra warm layer"),
                    qs("ready.clothing.jacket", "Weather-appropriate outer layer"),
                    qs("ready.clothing.pants", "Durable pants"),
                    item("ready.clothing.shorts", "1 pair of shorts (if needed)"),
                    qs("ready.clothing.underwear", "3 days of underwear"),
                    qs("ready.clothing.socks", "3 days of socks"),
                    item("ready.clothing.rain", "Rain poncho or lightweight rain jacket"),
                    qs("ready.clothing.hat", "Appropriate hat"),
                    qs("ready.clothing.gloves", "Gloves"),
                    qs("ready.clothing.shoes", "Closed-toe shoes or boots"),
                    item("ready.clothing.sleep", "Comfortable sleeping clothes or extra base layers"),
                ],
            },
            {
                "slug": "hygiene",
                "title": "Hygiene",
                "more_title": "Expanded Hygiene & Sanitation",
                "intro": "Travel-sized items for three days per person.",
                "items": [
                    qs("ready.hygiene.toothbrush", "Toothbrush and toothpaste"),
                    item("ready.hygiene.toothpaste", "Travel-sized toothpaste"),
                    item("ready.hygiene.floss", "Dental floss"),
                    qs("ready.hygiene.soap", "Soap"),
                    item("ready.hygiene.shampoo", "Travel shampoo or solid shampoo bar"),
                    qs("ready.hygiene.wipes", "Wet wipes (large pack, 1 per family)"),
                    qs("ready.hygiene.sanitizer", "Alcohol-based hand sanitizer"),
                    item("ready.hygiene.deodorant", "Travel-sized deodorant"),
                    qs("ready.hygiene.tp", "Toilet paper (1–2 compact rolls)"),
                    item("ready.hygiene.trowel", "Small trowel for burying waste"),
                    qs("ready.hygiene.feminine", "Personal hygiene and menstrual supplies"),
                    qs("ready.hygiene.waste-bags", "Waste bags"),
                    item("ready.hygiene.razor", "Razor and small shaving cream (if needed)"),
                    item("ready.hygiene.nails", "Nail clippers and small file"),
                    item("ready.hygiene.mirror", "Small mirror"),
                ],
            },
            {
                "slug": "medical",
                "title": "Medical",
                "more_title": "Expanded Medical",
                "intro": "Customize to your household. Check expiration dates.",
                "items": [
                    qs("ready.medical.bandages", "Assorted adhesive bandages"),
                    qs("ready.medical.gauze", "Sterile gauze pads (2x2 and 4x4)"),
                    item("ready.medical.tape", "Adhesive medical tape"),
                    item("ready.medical.antiseptic", "Antiseptic wipes or solution"),
                    item("ready.medical.antibiotic", "Antibiotic ointment"),
                    item("ready.medical.hydrocortisone", "Hydrocortisone cream"),
                    item("ready.medical.burn", "Burn gel or cream"),
                    qs("ready.medical.pain", "Regular over-the-counter pain relievers"),
                    qs("ready.medical.allergy", "Allergy medication, if you use it"),
                    item("ready.medical.antidiarrheal", "Anti-diarrheal medication"),
                    item("ready.medical.antacid", "Antacid"),
                    item("ready.medical.laxative", "Mild laxative"),
                    qs("ready.medical.electrolytes", "Electrolyte packets"),
                    item("ready.medical.scissors", "Small scissors"),
                    item("ready.medical.tweezers", "Tweezers"),
                    item("ready.medical.pins", "Safety pins"),
                    item("ready.medical.thermometer", "Digital thermometer with spare batteries"),
                    item("ready.medical.gloves", "Disposable gloves"),
                    item("ready.medical.cpr", "CPR face shield"),
                    item("ready.medical.blister", "Moleskin or blister treatment"),
                    item("ready.medical.eyewash", "Eye wash solution"),
                    qs("ready.medical.prescriptions", "Personal medications"),
                    qs("ready.medical.devices", "Personal medical supplies", "Devices you already use, such as a glucose meter, plus spare batteries."),
                    item("ready.medical.tourniquet", "Tourniquet", "Trained users only. Learn from a qualified course before you rely on it."),
                    item("ready.medical.pressure-bandage", "Pressure bandage or elastic wrap"),
                    item("ready.medical.triangular-bandage", "Triangular bandage"),
                    item("ready.medical.splint", "Compact splint (SAM-style)"),
                ],
            },
            {
                "slug": "communications",
                "title": "Communication & Navigation",
                "more_title": "Expanded Communications",
                "intro": "Stay informed when networks are strained.",
                "items": [
                    qs("ready.comms.noaa", "Weather radio", "Hand-crank or battery. Set a SAME code if it has one."),
                    item("ready.comms.amfm", "AM/FM radio"),
                    hidden("ready.comms.hand-crank", "Hand-crank or solar-powered radio backup"),
                    qs("ready.comms.powerbanks", "Power banks"),
                    qs("ready.comms.cables", "Charging cables"),
                    item("ready.comms.solar", "Solar charger"),
                    qs("ready.comms.batteries", "Spare batteries"),
                    item("ready.comms.whistle", "Whistle (1 per person)"),
                    item("ready.comms.signal-mirror", "Signal mirror"),
                    qs("ready.comms.maps", "Paper map"),
                    item("ready.comms.compass", "Compass"),
                    item("ready.comms.regional-maps", "Regional maps"),
                    item("ready.comms.meeting-points", "Meeting-point information", "Local and out-of-area."),
                    qs("ready.comms.out-of-state", "Important phone numbers"),
                    item("ready.comms.written-numbers", "Laminated important-phone-number list"),
                ],
            },
            {
                "slug": "food-water",
                "title": "Food & Water",
                "more_title": "More Food",
                "intro": "About three days of no-cook food. Cooking gear is in the next section.",
                "items": [
                    qs("ready.food.water", "Drinking water", "Carry what you can. Stage the rest at home or in the vehicle."),
                    qs("ready.food.bars", "3-day no-cook food"),
                    qs("ready.food.special", "Special-diet, infant, or allergy-safe food, when needed"),
                    item("ready.food.dried-fruit", "Dried fruit"),
                    item("ready.food.nuts", "Nuts and seeds"),
                    item("ready.food.peanut-butter", "Peanut butter (plastic jar or packets)"),
                    item("ready.food.canned-meat", "Canned meat, pop-top preferred"),
                    item("ready.food.canned-veg", "Canned vegetables, pop-top preferred"),
                    item("ready.food.oatmeal", "Instant oatmeal packets"),
                    item("ready.food.crackers", "Crackers or pilot bread"),
                    item("ready.food.candy", "Hard candy or gum"),
                    qs("ready.food.can-opener", "Manual can opener"),
                    item("ready.food.baby", "Baby formula and baby food (if needed)"),
                    item("ready.food.pet", "Pet food (if needed)"),
                    hidden("ready.food.electrolytes", "Electrolyte packets"),
                ],
            },
            {
                "slug": "cooking",
                "title": "Cooking & Water",
                "intro": "Outdoor cooking only. Never use a camp stove, grill, charcoal, or generator indoors or in an enclosed space.",
                "items": [
                    item("ready.food.purification", "Water-treatment method", "Tablets, a filter, or a known boil plan."),
                    item("ready.food.stove", "Portable stove and compatible fuel", "Outdoor use only. Never use a camp stove, grill, charcoal, or generator indoors or in an enclosed space."),
                    item("ready.food.matches", "Waterproof lighter or matches", "For outdoor cooking only."),
                    item("ready.food.mess-kit", "Pot, cup, bowl, and utensils"),
                    item("ready.food.foil", "Heavy-duty aluminum foil"),
                ],
            },
            {
                "slug": "shelter-tools",
                "title": "Emergency Protection",
                "more_title": "More Shelter & Tools",
                "intro": "Protection for weather, smoke, and a night away from home.",
                "items": [
                    item("ready.shelter.headlamp", "Headlamp or flashlight with spare batteries", "Test it before you zip the bag."),
                    qs("ready.shelter.mylar", "Emergency blanket or compact sleeping bag"),
                    item("ready.shelter.sleeping-bag", "Compact sleeping bag or warm blanket"),
                    item("ready.shelter.tarp", "Lightweight tarp and paracord"),
                    item("ready.shelter.multitool", "Multi-tool"),
                    item("ready.shelter.duct-tape", "Duct tape (small roll)"),
                    item("ready.shelter.notepad", "Notepad and pencil"),
                    qs("ready.hygiene.sunscreen", "Sunscreen"),
                    qs("ready.hygiene.lip-balm", "SPF lip balm"),
                    qs("ready.hygiene.insect", "Insect repellent"),
                    qs("ready.shelter.n95", "Appropriate respirator", "For smoke, dust, and debris. Use the type that fits the risk where you live."),
                ],
            },
        ],
    },
    {
        "slug": "vehicle-suitcase",
        "title": "20-Minute Vehicle OR Suitcase Prep",
        "time_label": "20 MIN",
        "illustration_key": "suv",
        "access_tier": "core",
        "sort_order": 30,
        "description": "Choose a vehicle kit or an evacuation suitcase. These are two paths, not one combined chore.",
        "sections": [
            {
                "slug": "vehicle-repair",
                "lane": "vehicle",
                "title": "Vehicle Safety & Recovery",
                "intro": "Keep a durable kit in the trunk. Review quarterly.",
                "items": [
                    qs("vehicle.safety.jumper-cables", "Jumper cables or tested jump starter"),
                    qs("vehicle.safety.tire-inflator", "Tire inflator"),
                    item("vehicle.safety.tool-kit", "Basic tools"),
                    item("vehicle.safety.tow-strap", "Tow strap"),
                    item("vehicle.safety.tape", "Duct tape and electrical tape"),
                    item("vehicle.safety.fuses", "Spare fuses"),
                    qs("vehicle.safety.spare-tire", "Spare tire or mobility solution", "Know where the jack and lug wrench are, or know your sealant and tow plan."),
                    qs("vehicle.safety.gauge", "Tire-pressure gauge"),
                    qs("vehicle.safety.roadside", "Roadside-assistance information", "Membership number and phone on paper and in your phone."),
                    item("vehicle.safety.traction", "Traction aids"),
                    item("vehicle.safety.chains", "Tire chains, where appropriate"),
                    item("vehicle.safety.ev-plan", "EV charging route, adapter, or backup plan"),
                    item("vehicle.safety.maintenance", "Vehicle maintenance checks", "Tires, fluids, wipers, and lights, on the schedule you already use."),
                ],
            },
            {
                "slug": "vehicle-visibility",
                "lane": "vehicle",
                "title": "Warning & Visibility",
                "items": [
                    qs("vehicle.visibility.flares", "Warning triangles or flares"),
                    qs("vehicle.visibility.vest", "Reflective vest"),
                    item("vehicle.visibility.extinguisher", "Automotive fire extinguisher"),
                    item("vehicle.visibility.window-tool", "Seat-belt cutter and window breaker"),
                ],
            },
            {
                "slug": "vehicle-survival",
                "lane": "vehicle",
                "title": "Vehicle Supplies",
                "items": [
                    item("vehicle.comfort.blankets", "Blankets or sleeping bags"),
                    item("vehicle.comfort.ponchos", "Rain ponchos"),
                    qs("vehicle.comfort.shoes", "Sturdy footwear"),
                    item("vehicle.comfort.ice-scraper", "Seasonal shovel and ice scraper"),
                    qs("vehicle.comfort.gloves", "Work gloves"),
                    qs("vehicle.comfort.lights", "Flashlight or headlamp"),
                    qs("vehicle.comfort.maps", "Paper map"),
                    qs("vehicle.comfort.alt-route", "Printed alternate route"),
                    qs("vehicle.comfort.water", "Water"),
                    qs("vehicle.comfort.snacks", "1–2 days of food"),
                    qs("vehicle.comfort.charger", "Phone charger"),
                    qs("vehicle.comfort.bank", "Power bank"),
                    qs("vehicle.comfort.first-aid", "First-aid kit"),
                    hidden("vehicle.comfort.fuel-can", "Empty fuel can stored safely", "Fill only when needed and follow local regulations."),
                    qs("vehicle.comfort.half-tank", "Fuel or charge at the household minimum", "Top off when a storm or fire is forecast. For an EV, keep the charge you decided is your minimum."),
                    item("vehicle.comfort.n95", "N95 masks", "One per person, for smoke and dust."),
                ],
            },
            {
                "slug": "suitcase",
                "lane": "suitcase",
                "title": "Suitcase Prep",
                "more_title": "Additional Suitcase Items",
                "intro": "If you have about 20 minutes, pack continuity — not just survival.",
                "items": [
                    qs("vehicle.suitcase.ids", "ID and protected copies"),
                    qs("vehicle.suitcase.meds", "Medication bottles"),
                    qs("vehicle.suitcase.profile", "Medical profile", "Conditions, allergies, doses, and emergency contacts."),
                    qs("vehicle.suitcase.clothes", "3–5 days of clothing"),
                    qs("vehicle.suitcase.toiletries", "Toiletry kit"),
                    qs("vehicle.suitcase.chargers", "Chargers and a power bank"),
                    qs("vehicle.suitcase.work", "Work, school, or professional essentials"),
                    qs("vehicle.suitcase.comfort", "Child comfort items, when needed"),
                    qs("vehicle.suitcase.pets", "Pet supplies, when needed"),
                    qs("vehicle.suitcase.destination", "Destination or host information"),
                    qs("vehicle.suitcase.route", "Printed evacuation route and an alternate route"),
                    item("vehicle.suitcase.valuables", "Irreplaceable small valuables", "Only what you can carry. Photos of the rest help insurance."),
                    item("vehicle.suitcase.more-clothes", "Additional clothing"),
                    item("vehicle.suitcase.more-meds", "Additional medical supplies"),
                    item("vehicle.suitcase.more-docs", "Additional documents"),
                    item("vehicle.suitcase.destination-needs", "Destination-specific necessities"),
                ],
            },
            {
                "slug": "pets",
                "lane": "suitcase",
                "title": "Additional Pet Supplies",
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
                "lane": "suitcase",
                "title": "Additional Child Supplies",
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
                "lane": "suitcase",
                "title": "Additional Care Supplies",
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
        "title": "60-Minute Home Resilience",
        "time_label": "60 MIN",
        "illustration_key": "cabin",
        "access_tier": "core",
        "sort_order": 40,
        "description": "Sixty minutes for the highest-priority safety and continuity needs inside the home.",
        "sections": [
            {
                "slug": "detection",
                "title": "Fire, Smoke & Carbon Monoxide",
                "intro": "Test alarms. Know two ways out.",
                "items": [
                    qs("home.safety.smoke", "Smoke alarms working"),
                    qs("home.safety.co", "Carbon monoxide alarms working"),
                    qs("home.safety.extinguishers", "Fire extinguishers accessible"),
                    qs("home.safety.escape", "Two exit paths identified"),
                    qs("home.safety.exits-clear", "Exit paths clear"),
                    qs("home.ready.shoes", "Shoes, flashlight, and gloves available near beds"),
                    qs("home.safety.meeting", "Household meeting point established"),
                    item("home.safety.hazards", "Know your area's main hazards and evacuation zone", "Check your county emergency management site. Write your zone number on the household plan."),
                ],
            },
            {
                "slug": "utilities",
                "title": "Utilities",
                "intro": "Know the shutoffs before you need them. Follow utility guidance.",
                "items": [
                    qs("home.utilities.water-main", "Main water shutoff identified"),
                    qs("home.utilities.water-wrench", "Water shutoff tool available"),
                    qs("home.utilities.gas-tool", "Gas or propane shutoff identified"),
                    qs("home.utilities.panel", "Electrical panel identified and labeled"),
                    qs("home.utilities.practice", "Utility shutoff procedure known"),
                    item("home.utilities.anchor", "Tall furniture and water heater anchored, if needed", "Anchor tall furniture and strap the water heater so they cannot fall."),
                ],
            },
            {
                "slug": "lighting",
                "title": "Light & Power",
                "more_title": "More Light & Power",
                "items": [
                    qs("home.power.lanterns", "Flashlights and headlamps accessible"),
                    qs("home.power.lantern", "Lantern available"),
                    qs("home.power.batteries", "Spare batteries"),
                    qs("home.power.charge-plan", "Charging plan"),
                    qs("home.power.backup", "Backup power identified"),
                    qs("home.power.priority", "Essential devices prioritized"),
                    item("home.power.power-station", "Portable power station for phones and medical devices"),
                    item("home.power.cords", "Heavy-duty extension cords and power strips"),
                    item("home.power.generator-plan", "Generator plan if you own one", "Never run a generator indoors or in a garage. Know the fuel-storage rules."),
                ],
            },
            {
                "slug": "water",
                "title": "Water",
                "more_title": "More Water",
                "items": [
                    qs("home.water.baseline", "Household drinking-water baseline calculated", "About 1 gallon per person per day is a common starting point. Count pets."),
                    qs("home.water.storage", "Emergency water available"),
                    qs("home.water.filter", "Water-treatment method identified"),
                    item("home.water.containers", "Food-grade water containers, labeled and dated"),
                    item("home.water.rotation", "Water rotation schedule (every 6–12 months)"),
                    item("home.water.bleach", "Unscented household bleach for emergency disinfection", "Follow CDC or Ready.gov guidance only."),
                    item("home.water.bathtub-bag", "Tub-liner water bladder or known fill method"),
                ],
            },
            {
                "slug": "food",
                "title": "Food",
                "more_title": "More Food",
                "items": [
                    qs("home.food.three-day", "3-day no-cook food supply"),
                    qs("home.food.manual-opener", "Manual can opener"),
                    qs("home.food.special-diet", "Special dietary needs covered"),
                    item("home.food.two-week", "Longer pantry of no-cook or low-cook meals"),
                    item("home.food.rotation", "First-in, first-out rotation labels"),
                    item("home.food.cooking", "Off-grid cooking method that is safe outdoors", "Never use charcoal, a camp stove, a grill, or a generator indoors or in an enclosed space."),
                ],
            },
            {
                "slug": "communications",
                "title": "Communications",
                "more_title": "More Communications",
                "items": [
                    qs("home.comms.alert", "Emergency alerts enabled"),
                    qs("home.power.radio", "Weather radio available"),
                    qs("home.comms.plan", "Emergency contacts accessible"),
                    item("home.comms.out-of-area", "Out-of-area contact who will take check-ins"),
                    item("home.comms.radio", "Battery or crank radio with extra power"),
                    item("home.comms.paper-list", "Paper copy of important contacts"),
                ],
            },
            {
                "slug": "home-readiness",
                "title": "Emergency Supplies",
                "more_title": "More Home Supplies",
                "items": [
                    qs("home.ready.go-bags", "Go-bags accessible"),
                    qs("home.ready.tools", "Basic repair supplies"),
                    qs("home.ready.gloves", "Gloves"),
                    qs("home.ready.contacts", "Emergency contacts accessible"),
                    item("home.ready.flashlights", "Extra flashlight in occupied rooms"),
                    item("home.ready.cash", "Small cash reserve at home"),
                    item("home.ready.plastic", "Plastic sheeting, duct tape, and a tarp"),
                    item("home.ready.sanitation", "Emergency sanitation supplies", "Bucket, heavy bags, and wipes. The sanitation list is in Have More Time."),
                    item("home.ready.insurance", "Home inventory photos stored off-site or in the cloud"),
                    item("home.ready.n95", "Masks for smoke, dust, and cleanup"),
                ],
            },
            {
                "slug": "comfort",
                "title": "Heat & Cooling",
                "intro": "One room you can cool, and one room you can keep warm.",
                "items": [
                    qs("home.comfort.cool-room", "Coolest room identified"),
                    qs("home.comfort.cooling", "Cooling plan"),
                    qs("home.comfort.warm-room", "Winter warm-room plan"),
                    qs("home.comfort.blankets", "Blankets and warm clothing accessible"),
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
        "title": "Rural, Off-Grid & Remote Property",
        "time_label": "MORE",
        "illustration_key": "lantern",
        "access_tier": "core",
        "sort_order": 220,
        "description": "Low-tech tools, outdoor cooking, and manual household systems for a rural or remote property.",
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
                "slug": "cooking",
                "title": "Alternative Cooking",
                "items": [
                    item("offgrid.cooking.outdoor", "Outdoor-only cooking method identified", "Name the method and the fuel. Never use charcoal, a camp stove, a grill, or a generator indoors or in an enclosed space."),
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
                    hidden("offgrid.house.heat", "Passive warmth: layers, blankets, one-room strategy"),
                    hidden("offgrid.house.cooling", "Passive cooling: shade, airflow, hydration", "Shade, night air, hydration. Skip indoor combustion \"cooling.\""),
                    item("offgrid.house.security", "Simple home security without powered cameras"),
                ],
            },
        ],
    },
    {
        "slug": "water-purification",
        "title": "Water Storage, Purification & Collection",
        "time_label": "MORE",
        "illustration_key": "filter",
        "access_tier": "core",
        "sort_order": 120,
        "description": "Storage, filtration, purification, rotation, and emergency collection.",
        "sections": [
            {
                "slug": "storage",
                "title": "Water Storage",
                "items": [
                    item("water.storage.volume", "Plan beyond 14 days", "If you have space, calculate gallons for 30 days. People x 1 gallon x 30 days. Count pets too."),
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
        "title": "Cooling, Heat & Weather Resilience",
        "time_label": "MORE",
        "illustration_key": "compass",
        "access_tier": "core",
        "sort_order": 150,
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
                    item("climate.heat.no-indoor-burn", "No indoor charcoal, camp stoves, or unvented combustion", "No charcoal, camp stoves, or unvented fuel inside. CO risk."),
                    item("climate.heat.co", "Working CO detector if any fuel appliance is used"),
                    item("climate.heat.pipes", "Pipe-protection plan in freezing weather"),
                ],
            },
        ],
    },
    {
        "slug": "battery-solar",
        "title": "Generator, Battery, Solar & Fuel Safety",
        "time_label": "MORE",
        "illustration_key": "solar",
        "access_tier": "core",
        "sort_order": 110,
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
                    item("power.cap.station", "Size a power station for multi-day essentials", "Watt-hours of essentials per day x days you want to cover, plus 20% headroom."),
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
            {
                "slug": "fuel",
                "title": "Generator & Fuel Safety",
                "items": [
                    item("power.fuel.outdoor", "Generator stays outdoors, away from doors and windows", "Never run a generator indoors, in a garage, or in any enclosed space."),
                    item("power.fuel.co", "Carbon monoxide alarm is working wherever fuel appliances are used"),
                    item("power.fuel.storage", "Fuel stored only in approved containers, away from living space"),
                    item("power.fuel.cool", "Let equipment cool before refueling"),
                    item("power.fuel.manual", "Follow the manufacturer shutoff and maintenance steps"),
                ],
            },
        ],
    },
    {
        "slug": "long-term-food",
        "title": "Food, Cooking & Long-Term Supplies",
        "time_label": "MORE",
        "illustration_key": "pine",
        "access_tier": "core",
        "sort_order": 130,
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
    {
        "slug": "medical-continuity",
        "title": "Medical Continuity & Accessibility",
        "time_label": "MORE",
        "illustration_key": "lantern",
        "access_tier": "core",
        "sort_order": 100,
        "description": "Keep care going through a short disruption. This is planning, not medical advice.",
        "sections": [
            {
                "slug": "continuity",
                "title": "Medication & Care Continuity",
                "intro": "Follow your clinicians. This list does not replace their instructions.",
                "items": [
                    item("med.list", "Current medication and allergy list on paper"),
                    item("med.refill", "Refill plan for a few days away from home"),
                    item("med.contacts", "Pharmacy, prescriber, and caregiver phone numbers"),
                    item("med.devices", "Medical devices, spare power, and the supplies you already use"),
                    item("med.access", "Mobility, hearing, vision, and communication needs written down"),
                    item("med.temp", "Medications that need cooling or warmth identified"),
                    item("med.trained", "Specialized medical gear limited to people trained to use it"),
                ],
            },
        ],
    },
    {
        "slug": "sanitation",
        "title": "Sanitation & Contamination Control",
        "time_label": "MORE",
        "illustration_key": "lantern",
        "access_tier": "core",
        "sort_order": 140,
        "description": "Toilets, handwashing, trash, and keeping clean water clean when utilities fail.",
        "sections": [
            {
                "slug": "plan",
                "title": "Sanitation",
                "items": [
                    item("offgrid.sanitation.toilet-plan", "Toilet plan if water or sewer fails"),
                    item("offgrid.sanitation.bags", "Heavy waste bags and absorbent material"),
                    item("offgrid.sanitation.handwash", "Handwashing station independent of tap water"),
                    item("offgrid.sanitation.hygiene", "Two-week hygiene supply"),
                    item("offgrid.sanitation.trash", "Trash storage plan that keeps pests out"),
                    item("sanitation.separate", "Keep sanitation supplies away from drinking water and food"),
                    item("sanitation.gloves", "Disposable gloves for cleanup"),
                    item("sanitation.disinfect", "Disinfectant you already know how to use, following the label"),
                ],
            },
        ],
    },
    {
        "slug": "wildfire",
        "title": "Wildfire & Smoke",
        "time_label": "MORE",
        "illustration_key": "compass",
        "access_tier": "core",
        "sort_order": 160,
        "description": "Leave early when told. Protect breathing while you can still do it calmly.",
        "sections": [
            {
                "slug": "prepare",
                "title": "Wildfire & Smoke",
                "intro": "Follow evacuation orders and local fire guidance first.",
                "items": [
                    item("fire.zone", "Evacuation zone and alert sign-up known"),
                    item("fire.bag", "Grab-and-go bag kept near the exit during fire season"),
                    item("fire.mask", "Masks for smoke, one per person, stored in a bag"),
                    item("fire.windows", "Plan to close windows and set HVAC to recirculate when smoke is heavy"),
                    item("fire.car", "Vehicle fuel or charge kept at your household minimum"),
                    item("fire.routes", "Two ways out of the neighborhood written down"),
                    item("fire.space", "Follow local guidance on clearing vegetation near the home"),
                ],
            },
        ],
    },
    {
        "slug": "flood",
        "title": "Flood & Flash Flood",
        "time_label": "MORE",
        "illustration_key": "filter",
        "access_tier": "core",
        "sort_order": 170,
        "description": "Water rises faster than it looks. Do not drive through it.",
        "sections": [
            {
                "slug": "prepare",
                "title": "Flood",
                "intro": "Turn around. Do not walk or drive through floodwater.",
                "items": [
                    item("flood.zone", "Flood zone and local alert method known"),
                    item("flood.routes", "Higher-ground route that does not use low crossings"),
                    item("flood.move", "Plan for moving important papers and electronics up"),
                    item("flood.shutoff", "Utility shutoff steps known, and used only when officials or the utility say to"),
                    item("flood.bag", "Go-bag ready if you may need to leave"),
                    item("flood.after", "Afterward, avoid standing water and damaged buildings until they are checked"),
                ],
            },
        ],
    },
    {
        "slug": "earthquake",
        "title": "Earthquake",
        "time_label": "MORE",
        "illustration_key": "cabin",
        "access_tier": "core",
        "sort_order": 180,
        "description": "Protect yourself during shaking, then check the home before you use utilities.",
        "sections": [
            {
                "slug": "prepare",
                "title": "Earthquake",
                "items": [
                    item("quake.practice", "Drop, cover, and hold on practiced with the household"),
                    item("quake.secure", "Tall furniture and water heater secured"),
                    item("quake.shoes", "Shoes and a flashlight by each bed"),
                    item("quake.gas", "Gas shutoff known, and used if you smell gas after shaking"),
                    item("quake.water", "Stored water, because pipes can break"),
                    item("quake.out", "Outdoor meeting point away from buildings and wires"),
                ],
            },
        ],
    },
    {
        "slug": "tornado",
        "title": "Tornado & Severe Wind",
        "time_label": "MORE",
        "illustration_key": "compass",
        "access_tier": "core",
        "sort_order": 190,
        "description": "Know the safest room before the warning.",
        "sections": [
            {
                "slug": "prepare",
                "title": "Wind",
                "items": [
                    item("wind.room", "Lowest interior room identified, away from windows"),
                    item("wind.alerts", "Weather radio and phone alerts able to wake you"),
                    item("wind.shoes", "Shoes, helmets or hard hats, and a flashlight staged for that room"),
                    item("wind.practice", "Household has practiced getting to that room"),
                    item("wind.after", "Stay clear of downed lines and damaged structures"),
                ],
            },
        ],
    },
    {
        "slug": "hazmat",
        "title": "Hazardous Materials & Chemical Release",
        "time_label": "MORE",
        "illustration_key": "lantern",
        "access_tier": "core",
        "sort_order": 200,
        "description": "If officials say shelter in place or evacuate, do that.",
        "sections": [
            {
                "slug": "prepare",
                "title": "Shelter or Leave",
                "intro": "Follow the alert. Do not go toward the source.",
                "items": [
                    item("hazmat.alerts", "Know how a shelter-in-place or evacuation alert will reach you"),
                    item("hazmat.close", "Plan to close windows and doors and turn off fans if told to shelter"),
                    item("hazmat.room", "Interior room chosen, with a radio and a way to seal obvious gaps if instructed"),
                    item("hazmat.leave", "Evacuation route that moves away from the reported source"),
                    item("hazmat.after", "Wait for the all-clear before airing out the home"),
                ],
            },
        ],
    },
    {
        "slug": "public-health",
        "title": "Public Health",
        "time_label": "MORE",
        "illustration_key": "lantern",
        "access_tier": "core",
        "sort_order": 210,
        "description": "Short-term illness and outbreak preparedness. Follow public-health instructions.",
        "sections": [
            {
                "slug": "prepare",
                "title": "Household Health",
                "items": [
                    item("health.instructions", "Know where you will read official public-health instructions"),
                    item("health.hygiene", "Soap, sanitizer, and masks on hand"),
                    item("health.space", "A room and a bathroom plan if someone needs to stay apart"),
                    item("health.meds", "Fever and comfort supplies you already use, plus prescription continuity"),
                    item("health.care", "How you will reach a clinician or urgent care if someone gets worse"),
                ],
            },
        ],
    },
    {
        "slug": "urban",
        "title": "Urban, Apartment & Shared Building",
        "time_label": "MORE",
        "illustration_key": "cabin",
        "access_tier": "core",
        "sort_order": 230,
        "description": "Stairs, neighbors, limited storage, and a building plan.",
        "sections": [
            {
                "slug": "building",
                "title": "Shared Building",
                "items": [
                    item("urban.exits", "Building exits and stairs known. Do not plan on the elevator"),
                    item("urban.manager", "Building contact and utility shutoff notes, if residents are allowed to use them"),
                    item("urban.storage", "Water and food sized to the storage you actually have"),
                    item("urban.stairs", "Bag light enough to carry down stairs"),
                    item("urban.neighbor", "Check-in plan with a neighbor"),
                    item("urban.window", "Window and balcony limits understood. Do not block fire escapes"),
                ],
            },
        ],
    },
    {
        "slug": "care-circle",
        "title": "Children, Seniors, Pets & Caregivers",
        "time_label": "MORE",
        "illustration_key": "duffel",
        "access_tier": "core",
        "sort_order": 240,
        "description": "Plans for the people and animals who depend on you. Supplies for the suitcase live on the suitcase path.",
        "sections": [
            {
                "slug": "plans",
                "title": "Care Plans",
                "items": [
                    item("care.pickup", "School, daycare, and caregiver pickup plan written down"),
                    item("care.meds", "Medications and doses for each child, senior, or dependent"),
                    item("care.comfort", "Comfort items and a simple explanation for children"),
                    item("care.mobility", "Mobility aids, extra time, and a backup caregiver"),
                    item("care.pets", "Pet carriers, a shelter or friend who can take animals, and ID"),
                    item("care.contacts", "Out-of-area person who knows the plan"),
                ],
            },
        ],
    },
    {
        "slug": "documents-recovery",
        "title": "Documents, Finances, Privacy & Recovery",
        "time_label": "MORE",
        "illustration_key": "backpack",
        "access_tier": "core",
        "sort_order": 250,
        "description": "What you need to restart after a disruption. Keep account numbers and PINs off paper.",
        "sections": [
            {
                "slug": "recovery",
                "title": "Recovery",
                "items": [
                    item("docs.inventory", "Home inventory photos stored outside the home"),
                    item("docs.insurance", "Insurance claim contacts saved, not full policy numbers on a loose sheet"),
                    item("docs.backup", "Encrypted backup of IDs and policies you can open from another device"),
                    item("docs.freeze", "You know how to freeze credit if cards are lost"),
                    item("docs.bills", "Bill and benefit contacts written as phone numbers, not account numbers"),
                    item("docs.privacy", "Social Security numbers stay out of the grab bag"),
                    item("docs.safe", "Originals in a fire- and water-resistant place. Copies travel if you leave"),
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
