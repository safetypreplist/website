import { comingSoonAllows } from "./comingSoon.ts";

function check(name: string, actual: boolean, expected: boolean) {
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`);
  console.log(`ok  ${name}`);
}

check("off: visitor can buy", comingSoonAllows({ enabled: false, isOwner: false, isCustomer: false }), true);
check("on: visitor blocked", comingSoonAllows({ enabled: true, isOwner: false, isCustomer: false }), false);
check("on: new account with no purchase blocked", comingSoonAllows({ enabled: true, isOwner: false, isCustomer: false }), false);
check("on: existing customer allowed", comingSoonAllows({ enabled: true, isOwner: false, isCustomer: true }), true);
check("on: owner allowed", comingSoonAllows({ enabled: true, isOwner: true, isCustomer: false }), true);
