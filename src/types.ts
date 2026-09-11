export type PlanTier = "none" | "core" | "full";
export type AccessTier = "core" | "full";
export type ProductKind = "core" | "full" | "extra_device" | "upgrade_full" | "extra_items" | "access_monthly" | "access_annual";
export type ChecklistPermission = "view" | "edit";
export type ChecklistStatus = "active" | "pending_claim" | "cancelled";
export type ViewingKind = "personal" | "household";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  plan: PlanTier;
  access_interval?: "monthly" | "annual" | null;
  access_status?: "none" | "active" | "grandfathered" | "past_due";
  access_renews_at?: string | null;
  checklist_fee_paid?: boolean;
  device_limit: number;
  custom_item_bonus: number;
  role: "customer" | "owner";
  preferred_state: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonalChecklist = {
  id: string;
  publicId: string;
  ownerUserId: string | null;
  purchasedByUserId: string | null;
  status: ChecklistStatus;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type ConnectedChecklist = PersonalChecklist & {
  permission: ChecklistPermission | "own";
  pending?: boolean;
};

export type ViewingContext = {
  kind: ViewingKind;
  checklistId: string | null;
  ownerUserId: string | null;
  publicId: string | null;
  title: string;
  ownerName: string;
  avatarUrl: string | null;
  permission: "own" | ChecklistPermission;
  isOwn: boolean;
  canEdit: boolean;
};

export type FamilyInvitation = {
  id: string;
  checklistId: string;
  invitedEmail: string;
  invitedName: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  createdAt: string;
};

export type PlanGroup = {
  id: string;
  name: string | null;
  createdBy: string;
  hasSharedHousehold: boolean;
};

export type Product = {
  slug: string;
  name: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  kind: ProductKind;
  grants_plan: PlanTier | null;
  device_slots: number;
  active: boolean;
};

export type Device = {
  id: string;
  user_id: string;
  device_token_hash: string;
  nickname: string;
  device_description: string | null;
  created_at: string;
  last_seen_at: string;
};

export type ChecklistSystem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  time_label: string | null;
  illustration_key: string | null;
  access_tier: AccessTier;
  sort_order: number;
  active: boolean;
};

export type ChecklistSection = {
  id: string;
  system_id: string;
  slug: string;
  title: string;
  intro: string | null;
  sort_order: number;
};

export type ChecklistItem = {
  id: string;
  section_id: string;
  permanent_key: string;
  text: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

export type CustomChecklistItem = {
  id: string;
  user_id: string;
  section_id: string;
  text: string;
  description: string | null;
  sort_order: number;
  checked: boolean;
  note: string;
  created_at: string;
  updated_at: string;
};

export type ProgressRow = {
  id: string;
  user_id: string;
  checklist_item_id: string;
  checked: boolean;
  note: string;
  updated_by_device_id: string | null;
  updated_at: string;
};

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  label: string;
  created_at: string;
  updated_at: string;
};

export type SafetyContact = {
  id: string;
  state: string | null;
  category: string;
  agency_name: string;
  phone: string | null;
  website: string | null;
  source_url: string | null;
  notes: string | null;
  verified_at: string | null;
  active: boolean;
  sort_order: number;
};

export type VideoResource = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  category: string;
  source_name: string | null;
  sort_order: number;
  active: boolean;
};

export type PricingConfig = {
  core: { slug: string; amount_cents: number; currency: string };
  full: { slug: string; amount_cents: number; currency: string };
  extra_device: { slug: string; amount_cents: number; currency: string };
  upgrade_core_to_full: {
    slug: string;
    amount_cents: number;
    currency: string;
    credits_core_purchase: boolean;
  };
};
