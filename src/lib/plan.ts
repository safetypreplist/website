import { planTypeLabel } from "./identity";

export function planLabel(plan?: string | null, familySize = 1) {
  return planTypeLabel({ plan, familySize });
}

export function hasPersonalChecklist(plan?: string | null) {
  return plan === "core" || plan === "full";
}

export function hasSurvivalVault(plan?: string | null, groupFlag?: boolean) {
  return groupFlag === true || plan === "full";
}
