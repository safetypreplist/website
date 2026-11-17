import { useEffect } from "react";
import { SurvivalVaultPurchase } from "../components/SurvivalVaultPurchase";
import { useApp } from "../context/AppContext";
import { VAULT_APP_DESCRIPTION, VAULT_CHECKLISTS } from "../lib/copy";
import { SystemRow, vaultSystems } from "./Dashboard";

export function HouseholdPage() {
  const { catalog, hasSurvivalVault, viewing, switchChecklist } = useApp();

  useEffect(() => {
    if (viewing.kind !== "household") void switchChecklist("household");
  }, [viewing.kind, switchChecklist]);

  if (!hasSurvivalVault) {
    return (
      <div className="locked-panel">
        <p className="eyebrow">Survival Vault</p>
        <h2>Want to go beyond the basics?</h2>
        <p className="muted">{VAULT_APP_DESCRIPTION}</p>
        <SurvivalVaultPurchase />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Survival Vault</h1>
      <div className="system-list" style={{ marginTop: 18 }}>
        {vaultSystems(catalog.systems).map((system) => (
          <SystemRow
            key={system.id}
            slug={system.slug}
            copy={VAULT_CHECKLISTS.find(
              (item) =>
                (system.slug === "off-grid" && item.title === "Off-Grid Systems") ||
                (system.slug === "water-purification" && item.title === "Water Purification") ||
                (system.slug === "battery-solar" && item.title === "Home Battery & Solar") ||
                (system.slug === "cooling-heat" && item.title === "Emergency Cooling / Heat Resilience") ||
                (system.slug === "long-term-food" && item.title === "Long-Term Food"),
            )}
          />
        ))}
      </div>
    </div>
  );
}
