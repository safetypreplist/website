-- Have More Time? optional extras. Extended items never count toward list completion.

alter table public.checklist_items
  add column if not exists item_type text not null default 'core';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checklist_items_item_type_check') then
    alter table public.checklist_items
      add constraint checklist_items_item_type_check check (item_type in ('core', 'extended', 'vault'));
  end if;
end $$;

update public.checklist_items i
set item_type = 'vault'
from public.checklist_sections s
join public.checklist_systems y on y.id = s.system_id
where i.section_id = s.id
  and y.slug in ('off-grid', 'water-purification', 'cooling-heat', 'battery-solar', 'long-term-food')
  and i.item_type = 'core';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '9ee03f40-4995-5ecc-9f7e-193f1d0bbee4'::uuid, y.id, 'extra-personal-safety', 'Personal Safety', '', 200
from public.checklist_systems y where y.slug = 'grab-go'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('2013e8ce-bb32-5042-b045-ac3f522a0ed3', 'grab.extra-personal-safety.small-personal-alarm', 'Small personal alarm', 0),
  ('317ea642-af7d-5072-b76b-10bf3936b6e5', 'grab.extra-personal-safety.basic-emergency-blanket', 'Basic emergency blanket', 10),
  ('6a283c87-e852-5137-970a-b6c7fd294024', 'grab.extra-personal-safety.small-roll-of-duct-tape', 'Small roll of duct tape', 20),
  ('bc2f20fb-7375-5b66-a4d8-863b28efad8e', 'grab.extra-personal-safety.compact-multitool', 'Compact multitool', 30),
  ('87552baf-44c9-5ffa-9a6d-2447e1f6d9e3', 'grab.extra-personal-safety.extra-pair-of-socks', 'Extra pair of socks', 40),
  ('bc6f87cc-dd2d-5b60-9642-ab73aaef5dbf', 'grab.extra-personal-safety.disposable-gloves', 'Disposable gloves', 50)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'grab-go'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-personal-safety'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '6ff05837-f6fe-5ad3-9c27-0f75efbbd842'::uuid, y.id, 'extra-food-water', 'Food & Water', '', 210
from public.checklist_systems y where y.slug = 'grab-go'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('0b4a88cc-a19f-53f9-ac38-b2a43daa7bcd', 'grab.extra-food-water.water-purification-tablets', 'Water purification tablets', 0),
  ('48161401-1de4-5be5-84ba-d08777e345ee', 'grab.extra-food-water.additional-high-calorie-snack', 'Additional high-calorie snack', 10),
  ('563818e9-f632-563e-ba6c-75f71395030b', 'grab.extra-food-water.electrolyte-packets', 'Electrolyte packets', 20)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'grab-go'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-food-water'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '14bae21a-568d-58d0-9022-f07c0ab48cf8'::uuid, y.id, 'extra-communication', 'Communication', '', 220
from public.checklist_systems y where y.slug = 'grab-go'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('10a287b2-010f-5877-91dc-5d557b05e8c2', 'grab.extra-communication.small-emergency-am-fm-radio', 'Small emergency AM/FM radio', 0),
  ('3b45bcf3-5214-5409-b557-4a114185e16f', 'grab.extra-communication.backup-charging-cable', 'Backup charging cable', 10),
  ('173d08a5-1875-51c6-8280-ba164c937c8f', 'grab.extra-communication.written-emergency-meeting-location', 'Written emergency meeting location', 20)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'grab-go'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-communication'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '528e5775-057a-5bc0-b009-206cc3db307a'::uuid, y.id, 'extra-documents', 'Documents', '', 230
from public.checklist_systems y where y.slug = 'grab-go'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('1fe68dca-9063-524b-b76c-57f42a3838d0', 'grab.extra-documents.additional-emergency-cash', 'Additional emergency cash', 0),
  ('07c4ef8c-4203-596e-b5c4-72cfe2c02f71', 'grab.extra-documents.spare-key-when-appropriate', 'Spare key (when appropriate)', 10),
  ('3356c043-494d-5fd9-8259-bddd3e228d11', 'grab.extra-documents.laminated-copy-of-critical-medical-information', 'Laminated copy of critical medical information', 20)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'grab-go'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-documents'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '6e9820f9-5cb7-5170-bd5d-805efaa89a32'::uuid, y.id, 'extra-food-water', 'Food & Water', '', 200
from public.checklist_systems y where y.slug = 'ready-bag'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('689fa1bb-3645-523c-95b4-eaf16d284782', 'ready.extra-food-water.extra-water', 'Extra water', 0),
  ('5f5d0634-3545-5209-8359-17c3f438ee47', 'ready.extra-food-water.additional-water-storage-container', 'Additional water storage container', 10),
  ('18ad7cfb-825f-5e7e-acdd-94c5c6daeef6', 'ready.extra-food-water.backup-water-treatment-method', 'Backup water-treatment method', 20),
  ('d0032e11-b55c-56ed-a5a4-4120a17c68ca', 'ready.extra-food-water.additional-electrolyte-packets', 'Additional electrolyte packets', 30),
  ('9b5c6e8d-fd75-51b5-81a0-96f3ab2c3397', 'ready.extra-food-water.familiar-comfort-foods', 'Familiar comfort foods', 40),
  ('f01bd12b-bfdf-51be-a878-b4d079045689', 'ready.extra-food-water.reusable-or-collapsible-water-container', 'Reusable or collapsible water container', 50)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'ready-bag'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-food-water'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select 'a55286a0-5510-50cb-98f7-8a789fe41979'::uuid, y.id, 'extra-shelter-sleep', 'Shelter & Sleep', '', 210
from public.checklist_systems y where y.slug = 'ready-bag'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('b0440e91-1636-5378-9b5a-e88e2717b26f', 'ready.extra-shelter-sleep.sleeping-pad', 'Sleeping pad', 0),
  ('be252f58-3a13-5343-b8e3-541dad374d86', 'ready.extra-shelter-sleep.emergency-bivy', 'Emergency bivy', 10),
  ('89d90e64-8b67-5289-8df4-d95b57af0bc4', 'ready.extra-shelter-sleep.compact-tent-or-shelter-when-appropriate', 'Compact tent or shelter (when appropriate)', 20),
  ('a3bdec2b-03eb-5475-8aa5-0523bb229952', 'ready.extra-shelter-sleep.earplugs', 'Earplugs', 30),
  ('a3441074-f915-5986-b544-bc611450344f', 'ready.extra-shelter-sleep.eye-mask', 'Eye mask', 40)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'ready-bag'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-shelter-sleep'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '1c4b370b-fda9-574d-a12e-054cbc58b7e0'::uuid, y.id, 'extra-medical', 'Medical', '', 220
from public.checklist_systems y where y.slug = 'ready-bag'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('042b2c7e-7444-52e7-9316-d61666a608af', 'ready.extra-medical.additional-critical-medication-supplies-when-appropriate', 'Additional critical medication supplies (when appropriate)', 0),
  ('f5139a91-d33b-5c35-8535-110131d7f4b6', 'ready.extra-medical.spare-prescription-glasses', 'Spare prescription glasses', 10),
  ('12f9fbd0-37d8-5920-843c-6eab5ab2a9c3', 'ready.extra-medical.personal-medical-monitoring-equipment-when-applicable', 'Personal medical monitoring equipment (when applicable)', 20),
  ('987efb95-96e0-550e-9ba5-3d930c8828f0', 'ready.extra-medical.extra-medical-device-batteries', 'Extra medical-device batteries', 30),
  ('f73e92d1-b29d-51d3-b02c-01e4f5066af4', 'ready.extra-medical.copies-of-prescriptions', 'Copies of prescriptions', 40)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'ready-bag'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-medical'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '886e3350-4d90-5a39-878d-0a4acf01a3f1'::uuid, y.id, 'extra-communication', 'Communication', '', 230
from public.checklist_systems y where y.slug = 'ready-bag'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('c72911cf-38b2-53ee-84d4-73fd271447a5', 'ready.extra-communication.hand-crank-or-solar-radio', 'Hand-crank or solar radio', 0),
  ('249a3659-47f4-5882-b9f3-4c023a07f567', 'ready.extra-communication.extra-charging-cable', 'Extra charging cable', 10),
  ('f180c361-e8b6-5c75-9cee-1b17fd907c92', 'ready.extra-communication.usb-vehicle-adapter', 'USB vehicle adapter', 20),
  ('6154b695-0bee-5bef-bb3d-dd3c0f070aac', 'ready.extra-communication.additional-signaling-device', 'Additional signaling device', 30)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'ready-bag'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-communication'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '11ccde59-ec2c-571f-87b3-d52301c3e789'::uuid, y.id, 'extra-clothing', 'Clothing', '', 240
from public.checklist_systems y where y.slug = 'ready-bag'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('9a4e5621-15b0-547d-94fa-25b03d1ae7f3', 'ready.extra-clothing.additional-underwear-and-socks', 'Additional underwear and socks', 0),
  ('60f8c365-1a0c-523a-8905-9b3daccc2fe5', 'ready.extra-clothing.extra-base-layer', 'Extra base layer', 10),
  ('8ca41a92-3953-57d8-991c-9bee40b90bca', 'ready.extra-clothing.work-gloves', 'Work gloves', 20),
  ('90071d99-7773-558d-8e27-7c567c502d53', 'ready.extra-clothing.additional-rain-protection', 'Additional rain protection', 30)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'ready-bag'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-clothing'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '9145bd12-01f9-5b84-bc2b-3d025a91e72e'::uuid, y.id, 'extra-repair-practical', 'Repair & Practical', '', 250
from public.checklist_systems y where y.slug = 'ready-bag'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('f23950a8-c7da-57a3-a77a-9e1e526ddfd0', 'ready.extra-repair-practical.small-sewing-or-repair-kit', 'Small sewing or repair kit', 0),
  ('bfaff0ce-9aa9-5b44-bc16-24388c12dcec', 'ready.extra-repair-practical.zip-top-storage-bags', 'Zip-top storage bags', 10),
  ('e807d3d6-7eb5-5a22-8ef5-52a23788b9a9', 'ready.extra-repair-practical.heavy-duty-trash-bags', 'Heavy-duty trash bags', 20),
  ('fd9ef729-f79a-5f1e-a447-6187d97f9042', 'ready.extra-repair-practical.paracord', 'Paracord', 30),
  ('87035746-c65e-5f7e-b26e-92c77cbad747', 'ready.extra-repair-practical.permanent-marker', 'Permanent marker', 40),
  ('25909c4e-9def-57a4-950a-cabd756e7f22', 'ready.extra-repair-practical.backup-flashlight', 'Backup flashlight', 50)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'ready-bag'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-repair-practical'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '9b702fbc-b70f-5aa0-9787-c3992c291750'::uuid, y.id, 'extra-vehicle-extras', 'Vehicle Extras', '', 200
from public.checklist_systems y where y.slug = 'vehicle-suitcase'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('bb336d88-61b4-589d-b590-c4175c7b84b4', 'vehicle.extra-vehicle-extras.spare-vehicle-key-stored-securely', 'Spare vehicle key stored securely', 0),
  ('b60100b1-266a-5bfa-b636-3d6cfca665d1', 'vehicle.extra-vehicle-extras.vehicle-registration-and-insurance-copies', 'Vehicle registration and insurance copies', 10),
  ('f0a14822-2ab2-5d4a-bb10-a7a0a23c3249', 'vehicle.extra-vehicle-extras.vehicle-owner-s-manual', 'Vehicle owner''s manual', 20),
  ('cefc8454-5ee2-55e5-bcab-eae65dc09adc', 'vehicle.extra-vehicle-extras.tire-repair-kit', 'Tire-repair kit', 30),
  ('2364bb81-b21d-55e9-b0dd-2abb5caa4f60', 'vehicle.extra-vehicle-extras.emergency-blanket', 'Emergency blanket', 40),
  ('83c09108-ec0e-5512-a93d-6c3b29237d91', 'vehicle.extra-vehicle-extras.additional-drinking-water', 'Additional drinking water', 50),
  ('f46263aa-b8e0-55b2-8e83-6a0829917341', 'vehicle.extra-vehicle-extras.additional-shelf-stable-snacks', 'Additional shelf-stable snacks', 60),
  ('fb6b4ec0-edf6-5450-99ed-15f3f7cd7d45', 'vehicle.extra-vehicle-extras.seasonal-hand-warmers-or-cooling-supplies', 'Seasonal hand warmers or cooling supplies', 70),
  ('1aa4c6f9-0708-56e9-9cc8-25e2358a8b09', 'vehicle.extra-vehicle-extras.usb-vehicle-charger', 'USB vehicle charger', 80),
  ('63467c0c-3bd4-57bd-b5a0-a0b2fde5014a', 'vehicle.extra-vehicle-extras.backup-flashlight', 'Backup flashlight', 90),
  ('3b4355bf-d549-501e-8943-ba5693c7c10c', 'vehicle.extra-vehicle-extras.heavy-duty-trash-bags', 'Heavy-duty trash bags', 100),
  ('829e19d5-e9e1-5e58-9e5b-b4c27e5953af', 'vehicle.extra-vehicle-extras.zip-ties', 'Zip ties', 110),
  ('060d483d-842f-57c3-84b5-10d22bf067ce', 'vehicle.extra-vehicle-extras.additional-work-gloves', 'Additional work gloves', 120),
  ('0b16e63c-3844-5a14-a8f8-e286cdcd90ab', 'vehicle.extra-vehicle-extras.additional-basic-repair-supplies', 'Additional basic repair supplies', 130)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'vehicle-suitcase'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-vehicle-extras'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select 'faacc00c-6c7d-5c0b-a46a-d46e659c1595'::uuid, y.id, 'extra-suitcase-extras', 'Suitcase Extras', '', 210
from public.checklist_systems y where y.slug = 'vehicle-suitcase'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('9f3bc13d-0f9e-5e1e-8b4b-77fa7a64bc6a', 'vehicle.extra-suitcase-extras.additional-1-2-days-of-clothing', 'Additional 1–2 days of clothing', 0),
  ('c074e582-1a09-5a14-aed9-bf78178037b5', 'vehicle.extra-suitcase-extras.additional-medication-and-supplies', 'Additional medication and supplies', 10),
  ('1801b481-d385-5131-8885-2f08b2b46dc2', 'vehicle.extra-suitcase-extras.backup-identification', 'Backup identification', 20),
  ('68b070f8-3ded-5cce-82af-d059fc3bc08b', 'vehicle.extra-suitcase-extras.copies-of-travel-reservations', 'Copies of travel reservations', 30),
  ('de39d69c-e8bc-5315-ae76-8f07ceb3335c', 'vehicle.extra-suitcase-extras.destination-specific-weather-gear', 'Destination-specific weather gear', 40),
  ('2f5d6d8b-fb6b-5158-840e-309272f5f300', 'vehicle.extra-suitcase-extras.destination-specific-power-adapters', 'Destination-specific power adapters', 50),
  ('4b06917c-0168-5048-8fcb-640f22bac004', 'vehicle.extra-suitcase-extras.portable-laundry-supplies', 'Portable laundry supplies', 60),
  ('5df1eb33-cbf8-5620-b5ff-07eaab31e9db', 'vehicle.extra-suitcase-extras.small-first-aid-kit', 'Small first-aid kit', 70),
  ('a951b645-4981-593a-8855-34d9e0e6cc92', 'vehicle.extra-suitcase-extras.additional-snacks', 'Additional snacks', 80),
  ('71e7a3d7-33cf-566c-8c3f-75dd9be05820', 'vehicle.extra-suitcase-extras.empty-collapsible-water-bottle', 'Empty collapsible water bottle', 90),
  ('6808acd0-6ee2-5433-be50-7a55ff5f5c03', 'vehicle.extra-suitcase-extras.comfort-item', 'Comfort item', 100),
  ('d76dbf25-50e4-5fce-b050-c0cc36225038', 'vehicle.extra-suitcase-extras.backup-payment-method', 'Backup payment method', 110),
  ('56ef35ae-a74b-5e01-a21e-6266751a0634', 'vehicle.extra-suitcase-extras.emergency-contact-card', 'Emergency contact card', 120),
  ('5f491663-c2dc-5a0e-898a-4065d71c842b', 'vehicle.extra-suitcase-extras.small-sewing-or-repair-kit', 'Small sewing or repair kit', 130)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'vehicle-suitcase'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-suitcase-extras'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '19428206-ace3-5147-91c6-fcf082e7a50d'::uuid, y.id, 'extra-water', 'Water', '', 200
from public.checklist_systems y where y.slug = 'home-resilience'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('31a974ab-6e75-5f11-bcd4-7814525ec04f', 'home.extra-water.additional-stored-water', 'Additional stored water', 0),
  ('aef7e37d-6307-5e61-abfa-0f9519cdc04b', 'home.extra-water.additional-water-containers', 'Additional water containers', 10),
  ('4d5a91f4-bfb5-5a00-ab01-eaea02689d3f', 'home.extra-water.backup-purification-method', 'Backup purification method', 20),
  ('1422f789-82f9-58bc-a6bb-994a7a9d9f0e', 'home.extra-water.water-dispensing-method', 'Water dispensing method', 30),
  ('cf753dc2-aaf4-5186-974a-41a18011b400', 'home.extra-water.water-inventory-labels', 'Water inventory labels', 40),
  ('bc99722e-f6c2-505d-8300-80dc5bafd788', 'home.extra-water.household-water-use-priority-plan', 'Household water-use priority plan', 50)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'home-resilience'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-water'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '195ab1b7-077f-5cb7-ab9f-76dee0baeca7'::uuid, y.id, 'extra-power', 'Power', '', 210
from public.checklist_systems y where y.slug = 'home-resilience'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('8e0dba9d-54e4-5e1e-b174-00723eda25a7', 'home.extra-power.additional-backup-batteries', 'Additional backup batteries', 0),
  ('c921b118-5b50-50fb-a30d-3e6164bbcbe5', 'home.extra-power.additional-appropriate-extension-cords', 'Additional appropriate extension cords', 10),
  ('f9147f94-9c21-5545-8995-9219079c327f', 'home.extra-power.battery-charging-rotation', 'Battery charging rotation', 20),
  ('496ea15a-0a01-5219-86b0-fa107e083a62', 'home.extra-power.solar-charging-option', 'Solar charging option', 30),
  ('c474821b-2b0e-583b-8d1e-f524efc19f8c', 'home.extra-power.written-power-priority-list', 'Written power-priority list', 40),
  ('f93729e7-0140-5b32-a90d-664aa31d6e85', 'home.extra-power.backup-lighting-in-commonly-occupied-areas', 'Backup lighting in commonly occupied areas', 50)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'home-resilience'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-power'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select 'b56591ea-ee87-5969-88cf-9aa7633fcdca'::uuid, y.id, 'extra-food', 'Food', '', 220
from public.checklist_systems y where y.slug = 'home-resilience'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('e6c4c139-dc80-5d25-9a7b-e694c7770d41', 'home.extra-food.additional-7-30-days-of-familiar-food', 'Additional 7–30 days of familiar food', 0),
  ('adc06086-a175-5c8b-9491-428207a684cf', 'home.extra-food.additional-no-cook-meals', 'Additional no-cook meals', 10),
  ('46819c05-f162-56a7-a188-b1652582aa45', 'home.extra-food.manual-food-preparation-tools', 'Manual food-preparation tools', 20),
  ('5fe67562-91c5-5ad1-a206-a6a0521f9c02', 'home.extra-food.food-storage-containers', 'Food-storage containers', 30),
  ('5f9ac08b-731a-5e0c-9106-100b9f8e4b25', 'home.extra-food.pest-resistant-storage', 'Pest-resistant storage', 40),
  ('c7b2293f-20e8-56ef-adf2-875b1946ae99', 'home.extra-food.food-rotation-schedule', 'Food rotation schedule', 50)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'home-resilience'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-food'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select 'c0ae0c82-a1e8-5a85-ad1d-1593d4d2960c'::uuid, y.id, 'extra-emergency-sanitation', 'Emergency Sanitation', '', 230
from public.checklist_systems y where y.slug = 'home-resilience'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('ddf02c5a-dee5-5359-857d-2d24c7d535cb', 'home.extra-emergency-sanitation.emergency-toilet-system', 'Emergency toilet system', 0),
  ('53ebc204-1c9f-5596-bf7d-8ae9e9e19aa8', 'home.extra-emergency-sanitation.toilet-liners', 'Toilet liners', 10),
  ('a438678c-60f2-5142-9afe-940d55137934', 'home.extra-emergency-sanitation.heavy-duty-waste-bags', 'Heavy-duty waste bags', 20),
  ('45a4236e-0ffa-5381-bde4-35a7021b016e', 'home.extra-emergency-sanitation.absorbent-material', 'Absorbent material', 30),
  ('5602bf5a-e6bd-5ce4-9d0d-7b7c443a15d4', 'home.extra-emergency-sanitation.portable-toilet-option', 'Portable toilet option', 40),
  ('7ebe5c5c-a541-5932-b079-ee5fb5fccde9', 'home.extra-emergency-sanitation.handwashing-station', 'Handwashing station', 50),
  ('9db24153-a9b4-5b2a-891a-1f92133d0342', 'home.extra-emergency-sanitation.additional-soap', 'Additional soap', 60),
  ('f0588e43-1740-59fb-a625-c2860a8da520', 'home.extra-emergency-sanitation.disinfecting-supplies', 'Disinfecting supplies', 70),
  ('e85f8fb1-9ece-5ddf-9c26-13fb899a6e40', 'home.extra-emergency-sanitation.hygiene-water-management-plan', 'Hygiene water-management plan', 80),
  ('b52c316d-dc15-5d00-acfd-fd338e6912e1', 'home.extra-emergency-sanitation.waste-storage-and-disposal-plan', 'Waste storage and disposal plan', 90)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'home-resilience'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-emergency-sanitation'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '4ef2f866-f53c-514a-9339-228741d76074'::uuid, y.id, 'extra-household-continuity', 'Household Continuity', '', 240
from public.checklist_systems y where y.slug = 'home-resilience'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('69956749-4216-5163-9be2-bd047353766f', 'home.extra-household-continuity.written-family-emergency-plan', 'Written family emergency plan', 0),
  ('9446e3c5-b859-51c3-9949-d91f12b4ab15', 'home.extra-household-continuity.family-meeting-locations', 'Family meeting locations', 10),
  ('8a640877-c5ff-5716-a07d-10b70b04fda1', 'home.extra-household-continuity.out-of-area-contact-plan', 'Out-of-area contact plan', 20),
  ('dd6c1585-3c44-5b35-95b2-cb462b12d718', 'home.extra-household-continuity.school-emergency-information', 'School emergency information', 30),
  ('9c3be97a-d063-5979-8455-4db0b7339f48', 'home.extra-household-continuity.pet-emergency-plan', 'Pet emergency plan', 40),
  ('813608d1-336d-5252-af81-85c3d9ae69e8', 'home.extra-household-continuity.caregiver-backup-plan', 'Caregiver backup plan', 50),
  ('851231bc-7146-5b58-9495-6ea851f8d005', 'home.extra-household-continuity.accessibility-and-disability-considerations', 'Accessibility and disability considerations', 60),
  ('3f5c4aef-dadf-5650-a52d-e4635f939957', 'home.extra-household-continuity.paper-backup-of-important-information', 'Paper backup of important information', 70),
  ('4c65c180-0eac-5f20-8df4-194f40f2e913', 'home.extra-household-continuity.digital-backup-of-important-information', 'Digital backup of important information', 80)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'home-resilience'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-household-continuity'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';

insert into public.checklist_sections (id, system_id, slug, title, intro, sort_order)
select '120f7af9-76c4-5ee0-9c07-76f4c2f306fd'::uuid, y.id, 'extra-household-security', 'Household Security', '', 250
from public.checklist_systems y where y.slug = 'home-resilience'
on conflict (system_id, slug) do update set title = excluded.title, sort_order = excluded.sort_order;

insert into public.checklist_items (id, section_id, permanent_key, text, description, sort_order, active, quick_start, item_type)
select v.id::uuid, s.id, v.permanent_key, v.text, '', v.sort_order, true, false, 'extended'
from (values
  ('5266e0cc-ce33-5836-93ee-2e46218714e5', 'home.extra-household-security.door-and-window-reinforcement-plan', 'Door and window reinforcement plan', 0),
  ('f6a6f999-d0b0-50ef-b851-1619cbf8c7e6', 'home.extra-household-security.backup-access-and-key-plan', 'Backup access and key plan', 10),
  ('b2a5c458-53d8-5149-adb1-b124bac7b7ef', 'home.extra-household-security.important-keys-identified', 'Important keys identified', 20),
  ('4df4f473-7c6a-59bb-846a-8a8da6cc532f', 'home.extra-household-security.neighbor-check-in-plan', 'Neighbor check-in plan', 30),
  ('223b71ca-7c6d-5c18-9046-cd5a7499a3af', 'home.extra-household-security.household-communication-plan', 'Household communication plan', 40)
) as v (id, permanent_key, text, sort_order)
join public.checklist_systems y on y.slug = 'home-resilience'
join public.checklist_sections s on s.system_id = y.id and s.slug = 'extra-household-security'
on conflict (permanent_key) do update
set text = excluded.text, sort_order = excluded.sort_order, active = true, quick_start = false, item_type = 'extended';
