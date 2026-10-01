import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { SAFETY_CATEGORY_LABELS, US_STATES } from "../lib/format";
import { COPY_KEY, DEFAULT_STEPS, loadCopy } from "../components/OnboardingTour";
import { AdminAccounts } from "../components/AdminAccounts";

type AdminTab = "overview" | "customers" | "accounts" | "families" | "traffic" | "discounts" | "content" | "onboarding";
type CustomerStatus = "Active" | "Past due" | "Deactivated";
type Customer = {
  id: string;
  initials: string;
  name: string;
  email: string;
  plan: string;
  billing: string;
  total: string;
  joined: string;
  lastPayment: string;
  status: CustomerStatus;
  family: string;
};
type Discount = { id: string; code: string; type: "Percent" | "Fixed"; value: string; uses: number; expires: string; active: boolean };

const customerSeed: Customer[] = [
  { id: "c1", initials: "JM", name: "Jordan Miller", email: "jordan.miller@email.com", plan: "Family · 4 seats", billing: "$39.96/mo", total: "$239.76", joined: "Sep 24, 2026", lastPayment: "Today, 9:42 AM", status: "Active", family: "Miller household" },
  { id: "c2", initials: "AS", name: "Avery Stone", email: "avery.stone@email.com", plan: "Individual · Annual", billing: "$119.88/yr", total: "$119.88", joined: "Sep 19, 2026", lastPayment: "Sep 19, 2026", status: "Active", family: "—" },
  { id: "c3", initials: "RB", name: "Riley Brooks", email: "riley.brooks@email.com", plan: "Family · 3 seats", billing: "$29.97/mo", total: "$89.91", joined: "Sep 12, 2026", lastPayment: "Sep 12, 2026", status: "Past due", family: "Brooks household" },
  { id: "c4", initials: "TK", name: "Taylor Kim", email: "taylor.kim@email.com", plan: "Individual · Monthly", billing: "$11.99/mo", total: "$35.97", joined: "Aug 28, 2026", lastPayment: "Aug 28, 2026", status: "Active", family: "—" },
  { id: "c5", initials: "MC", name: "Morgan Carter", email: "morgan.carter@email.com", plan: "Individual · Monthly", billing: "$11.99/mo", total: "$11.99", joined: "Aug 22, 2026", lastPayment: "Aug 22, 2026", status: "Deactivated", family: "—" },
];

const trafficSeed = [
  { time: "10:42 AM", ip: "172.16.24.18", source: "Google organic", page: "/checkout", device: "Mobile · Chrome", location: "Austin, TX", risk: "Normal", action: "Viewed pricing → checkout" },
  { time: "10:38 AM", ip: "104.28.61.90", source: "Direct", page: "/signin", device: "Desktop · Safari", location: "Portland, OR", risk: "Normal", action: "Signed in" },
  { time: "10:31 AM", ip: "185.223.91.7", source: "Unknown referral", page: "/checkout", device: "Bot · Chrome", location: "Unknown", risk: "Review", action: "34 checkout attempts" },
  { time: "10:15 AM", ip: "73.44.19.201", source: "Instagram", page: "/", device: "Mobile · Safari", location: "Denver, CO", risk: "Normal", action: "Started family plan" },
  { time: "09:56 AM", ip: "45.137.88.3", source: "Unknown referral", page: "/signin", device: "Bot · Firefox", location: "Unknown", risk: "Blocked", action: "Blocked by admin" },
];

const familySeed = [
  { name: "Miller household", owner: "Jordan Miller", members: 4, plan: "Family · Monthly", revenue: "$239.76", updated: "2 min ago", status: "Healthy" },
  { name: "Brooks household", owner: "Riley Brooks", members: 3, plan: "Family · Monthly", revenue: "$89.91", updated: "3 days ago", status: "Payment review" },
  { name: "Nguyen household", owner: "Casey Nguyen", members: 5, plan: "Family · Annual", revenue: "$599.40", updated: "Sep 25, 2026", status: "Healthy" },
];

const initialDiscounts: Discount[] = [
  { id: "d1", code: "READY10", type: "Percent", value: "10%", uses: 18, expires: "Oct 31, 2026", active: true },
  { id: "d2", code: "FAMILY25", type: "Percent", value: "25%", uses: 7, expires: "Dec 31, 2026", active: true },
  { id: "d3", code: "WELCOME5", type: "Fixed", value: "$5.00", uses: 31, expires: "Expired", active: false },
];

export function AdminPage() {
  const { profile, catalog, safety, refreshAccount } = useApp();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [message, setMessage] = useState("");
  const [customers, setCustomers] = useState(customerSeed);
  const [blockedIps, setBlockedIps] = useState<string[]>(["45.137.88.3"]);
  const [discounts, setDiscounts] = useState<Discount[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("spl.admin.discounts") || "null") || initialDiscounts;
    } catch {
      return initialDiscounts;
    }
  });
  const [search, setSearch] = useState("");
  const [showDiscountForm, setShowDiscountForm] = useState(false);

  if (profile && profile.role !== "owner") return <Navigate to="/app" replace />;
  if (!profile) return null;

  const filteredCustomers = customers.filter((customer) => `${customer.name} ${customer.email} ${customer.plan}`.toLowerCase().includes(search.toLowerCase()));
  const toggleCustomer = (id: string) => {
    setCustomers((rows) => rows.map((row) => row.id === id ? { ...row, status: row.status === "Deactivated" ? "Active" : "Deactivated" } : row));
    setMessage("Customer access updated. Their next sign-in will reflect this status.");
  };
  const toggleIp = (ip: string) => {
    setBlockedIps((rows) => rows.includes(ip) ? rows.filter((row) => row !== ip) : [...rows, ip]);
    setMessage(blockedIps.includes(ip) ? `${ip} removed from the block list.` : `${ip} added to the block list.`);
  };
  const saveDiscount = (discount: Discount) => {
    const next = [discount, ...discounts];
    setDiscounts(next);
    localStorage.setItem("spl.admin.discounts", JSON.stringify(next));
    setShowDiscountForm(false);
    setMessage(`${discount.code} is ready to use at checkout.`);
  };

  return (
    <div className="admin-workspace">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Owner console</p>
          <h1 className="page-title">Operations dashboard</h1>
          <p className="muted admin-lead">Keep an eye on customers, households, payments, and the traffic moving through Safety Prep List.</p>
        </div>
        <div className="admin-header-actions">
          <span className="admin-live-dot"><i /> Live data</span>
          <button className="btn btn-forest" type="button" onClick={() => window.open("https://dashboard.tawk.to", "_blank", "noopener,noreferrer")}>Open Tawk.to <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      <AdminNotificationPrompt />
      <div className="admin-layout">
        <aside className="admin-rail" aria-label="Admin sections">
          <p className="admin-rail-label">Workspace</p>
          <AdminNavButton active={tab === "overview"} label="Overview" icon="⌂" onClick={() => setTab("overview")} />
          <AdminNavButton active={tab === "customers"} label="Customers & billing" icon="◉" onClick={() => setTab("customers")} count="42" />
          <AdminNavButton active={tab === "accounts"} label="Accounts & access" icon="◇" onClick={() => setTab("accounts")} />
          <AdminNavButton active={tab === "families"} label="Families" icon="⌁" onClick={() => setTab("families")} count="18" />
          <AdminNavButton active={tab === "traffic"} label="Traffic & security" icon="◌" onClick={() => setTab("traffic")} count="3" alert />
          <AdminNavButton active={tab === "discounts"} label="Discount codes" icon="%" onClick={() => setTab("discounts")} />
          <p className="admin-rail-label admin-rail-label-spaced">Manage content</p>
          <AdminNavButton active={tab === "content"} label="Checklist & resources" icon="▤" onClick={() => setTab("content")} />
          <AdminNavButton active={tab === "onboarding"} label="Onboarding" icon="✦" onClick={() => setTab("onboarding")} />
          <div className="admin-help-card">
            <span className="admin-help-icon">?</span>
            <strong>Need a hand?</strong>
            <p>Tawk.to is ready for live support conversations.</p>
            <button type="button" onClick={() => window.open("https://dashboard.tawk.to", "_blank", "noopener,noreferrer")}>Open chat workspace ↗</button>
          </div>
        </aside>
        <section className="admin-content">
          {message && <div className="admin-toast" role="status"><span>✓</span>{message}<button type="button" onClick={() => setMessage("")} aria-label="Dismiss">×</button></div>}
          {tab === "overview" && <Overview onNavigate={setTab} />}
          {tab === "customers" && <Customers customers={filteredCustomers} search={search} setSearch={setSearch} onToggle={toggleCustomer} />}
          {tab === "accounts" && <AdminAccounts />}
          {tab === "families" && <Families />}
          {tab === "traffic" && <Traffic blockedIps={blockedIps} onToggleIp={toggleIp} />}
          {tab === "discounts" && <Discounts discounts={discounts} showForm={showDiscountForm} setShowForm={setShowDiscountForm} onSave={saveDiscount} />}
          {tab === "content" && <ContentTools catalog={catalog} safety={safety} refreshAccount={refreshAccount} onSaved={setMessage} />}
          {tab === "onboarding" && <OnboardingSettings onSaved={setMessage} />}
        </section>
      </div>
    </div>
  );
}

function AdminNavButton({ active, label, icon, onClick, count, alert }: { active: boolean; label: string; icon: string; onClick: () => void; count?: string; alert?: boolean }) {
  return <button className={`admin-nav-button ${active ? "active" : ""}`} type="button" onClick={onClick}><span className="admin-nav-icon">{icon}</span><span>{label}</span>{count ? <b className={alert ? "alert" : ""}>{count}</b> : null}</button>;
}

function AdminNotificationPrompt() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : "denied");
  if (!supported || permission === "granted") return null;
  async function enable() { setPermission(await Notification.requestPermission()); }
  return <aside className="notification-prompt" role="status"><span className="notification-prompt-icon">●</span><span><b>Turn notifications on</b><small>Get a browser alert when a support chat is waiting for you.</small></span><button className="btn btn-forest" type="button" onClick={() => void enable()}>Turn on</button></aside>;
}

function Overview({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const stats = [
    { label: "Active customers", value: "42", change: "+8.2%", detail: "vs. last 30 days", tone: "moss", icon: "◉" },
    { label: "Monthly recurring revenue", value: "$1,184", change: "+12.4%", detail: "vs. last month", tone: "clay", icon: "$" },
    { label: "Total collected", value: "$8,642", change: "+$1,920", detail: "all time", tone: "forest", icon: "↗" },
    { label: "Checkout conversion", value: "6.8%", change: "+1.1%", detail: "from 4,923 visits", tone: "sand", icon: "%" },
  ];
  return <>
    <div className="admin-section-heading"><div><p className="eyebrow">September 30, 2026</p><h2>Good afternoon, owner.</h2></div><button className="btn btn-ghost" type="button" onClick={() => onNavigate("traffic")}>View traffic report ↗</button></div>
    <SupportActivity />
    <div className="admin-stat-grid">{stats.map((stat) => <article className={`admin-stat-card ${stat.tone}`} key={stat.label}><span className="admin-stat-icon">{stat.icon}</span><p>{stat.label}</p><strong>{stat.value}</strong><small><b>{stat.change}</b> {stat.detail}</small></article>)}</div>
    <div className="admin-overview-grid">
      <section className="admin-panel admin-revenue-panel"><div className="admin-panel-head"><div><p className="panel-kicker">Revenue pulse</p><h3>Collected over the last 30 days</h3></div><span className="panel-select">Last 30 days⌄</span></div><div className="admin-chart"><div className="chart-y"><span>$2k</span><span>$1k</span><span>$0</span></div><div className="chart-area"><div className="chart-grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 640 180" preserveAspectRatio="none" aria-label="Revenue chart"><path d="M0 148 C28 144 40 128 72 132 S112 94 146 112 S184 88 214 98 S254 75 286 96 S326 106 356 72 S398 74 430 64 S468 78 500 52 S534 56 568 34 S610 46 640 18 L640 180 L0 180 Z" fill="rgba(85,107,47,.12)" /><path d="M0 148 C28 144 40 128 72 132 S112 94 146 112 S184 88 214 98 S254 75 286 96 S326 106 356 72 S398 74 430 64 S468 78 500 52 S534 56 568 34 S610 46 640 18" fill="none" stroke="#556b2f" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg><div className="chart-x"><span>Sep 1</span><span>Sep 8</span><span>Sep 15</span><span>Sep 22</span><span>Sep 30</span></div></div></div></section>
      <section className="admin-panel admin-alert-panel"><div className="admin-panel-head"><div><p className="panel-kicker">Needs attention</p><h3>Keep your finger on it</h3></div><span className="admin-alert-count">3 open</span></div><button className="admin-alert-row" type="button" onClick={() => onNavigate("traffic")}><span className="alert-mark orange">!</span><span><b>Traffic spike from one IP</b><small>185.223.91.7 · 34 checkout attempts in 6 min</small></span><em>Review ↗</em></button><button className="admin-alert-row" type="button" onClick={() => onNavigate("customers")}><span className="alert-mark gold">$</span><span><b>One payment needs review</b><small>Riley Brooks · Family plan · 3 days past due</small></span><em>Open ↗</em></button><button className="admin-alert-row" type="button" onClick={() => onNavigate("families")}><span className="alert-mark green">⌁</span><span><b>Two family invites pending</b><small>Members are waiting to finish setup</small></span><em>View ↗</em></button></section>
    </div>
    <div className="admin-overview-grid lower"><section className="admin-panel"><div className="admin-panel-head"><div><p className="panel-kicker">Recent activity</p><h3>What’s happening now</h3></div><button className="text-button" type="button" onClick={() => onNavigate("customers")}>See all</button></div><div className="admin-activity-list"><Activity initials="JM" title="Jordan Miller paid $39.96" meta="Family plan · PayPal · 9:42 AM" tone="moss" /><Activity initials="AS" title="Avery Stone joined" meta="Annual plan · Google organic · 9:18 AM" tone="clay" /><Activity initials="TK" title="Taylor Kim completed a checklist" meta="Home resilience · 8:54 AM" tone="forest" /><Activity initials="MC" title="New family invite sent" meta="Miller household · 8:31 AM" tone="sand" /></div></section><section className="admin-panel"><div className="admin-panel-head"><div><p className="panel-kicker">Acquisition</p><h3>Where customers come from</h3></div><button className="text-button" type="button" onClick={() => onNavigate("traffic")}>Full report</button></div><div className="source-list"><Source label="Google organic" value="48%" width="78%" color="moss" /><Source label="Direct" value="26%" width="52%" color="forest" /><Source label="Instagram" value="17%" width="34%" color="clay" /><Source label="Other referrals" value="9%" width="18%" color="gold" /></div></section></div>
  </>;
}

type ActiveSupportChat = { chat_id: string; visitor_name: string | null; visitor_email: string | null; visitor_city: string | null; visitor_country: string | null; domain: string | null; referrer: string | null; first_message: string | null; started_at: string };

function SupportActivity() {
  const [chats, setChats] = useState<ActiveSupportChat[]>([]);
  const [configured, setConfigured] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from("active_support_chats").select("*").order("started_at", { ascending: false });
      if (cancelled) return;
      if (error) { setConfigured(false); return; }
      setChats((data as ActiveSupportChat[]) || []);
    }
    void load();
    const channel = supabase.channel("owner-active-support-chats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "active_support_chats" }, (payload) => { const next = payload.new as ActiveSupportChat; setChats((current) => [next, ...current.filter((chat) => chat.chat_id !== next.chat_id)]); if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") new Notification("New Safety Prep List chat", { body: `${next.visitor_name || "A visitor"} is waiting in Tawk.to.` }); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "active_support_chats" }, (payload) => { const next = payload.new as ActiveSupportChat; setChats((current) => current.map((chat) => chat.chat_id === next.chat_id ? next : chat)); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "active_support_chats" }, (payload) => { const old = payload.old as ActiveSupportChat; setChats((current) => current.filter((chat) => chat.chat_id !== old.chat_id)); })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, []);
  return <section className={`admin-support-alert ${chats.length ? "has-chats" : ""}`} role="status"><span className="support-pulse"><i /></span><div className="support-alert-copy"><b>{chats.length ? `${chats.length} chat${chats.length === 1 ? "" : "s"} waiting` : configured ? "No active chats right now" : "Support alerts need Supabase setup"}</b><small>{chats.length ? `${chats[0].visitor_name || "A website visitor"} is waiting in Tawk.to${chats.length > 1 ? " · Open Tawk.to to respond" : ""}.` : configured ? "This card will light up in real time when a visitor starts a chat." : "Run the active-chat migration and deploy the Tawk webhook function to enable live alerts."}</small></div><button className="btn btn-forest" type="button" onClick={() => window.open("https://dashboard.tawk.to", "_blank", "noopener,noreferrer")}>Open Tawk.to ↗</button></section>;
}

function Activity({ initials, title, meta, tone }: { initials: string; title: string; meta: string; tone: string }) { return <div className="admin-activity"><span className={`activity-avatar ${tone}`}>{initials}</span><span><b>{title}</b><small>{meta}</small></span><span className="activity-time">●</span></div>; }
function Source({ label, value, width, color }: { label: string; value: string; width: string; color: string }) { return <div className="source-row"><div><span>{label}</span><b>{value}</b></div><i><em className={color} style={{ width }} /></i></div>; }

function Customers({ customers, search, setSearch, onToggle }: { customers: Customer[]; search: string; setSearch: (value: string) => void; onToggle: (id: string) => void }) {
  const [selected, setSelected] = useState<Customer | null>(null);
  return <><div className="admin-section-heading"><div><p className="eyebrow">42 customer accounts</p><h2>Customers & billing</h2><p className="muted">See who is active, what they bought, and everything collected to date.</p></div><button className="btn btn-primary" type="button" onClick={() => setSelected(customers[0] || null)}>Export report ↓</button></div><div className="admin-customer-summary"><span><b>38</b> active</span><span><b>2</b> past due</span><span><b>2</b> deactivated</span><span><b>$8,642</b> collected total</span></div><section className="admin-panel admin-table-panel"><div className="admin-table-toolbar"><label className="admin-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, or plan" /></label><button className="btn btn-ghost" type="button">All statuses⌄</button><button className="btn btn-ghost" type="button">Newest first⌄</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Plan & billing</th><th>Total paid</th><th>Last payment</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><span className="customer-avatar">{customer.initials}</span><span><b>{customer.name}</b><small>{customer.email}</small></span></div></td><td><b>{customer.plan}</b><small>{customer.billing}</small></td><td><strong>{customer.total}</strong><small>Joined {customer.joined}</small></td><td><span className="table-muted">{customer.lastPayment}</span></td><td><span className={`status-pill ${customer.status.toLowerCase().replace(" ", "-")}`}>{customer.status}</span></td><td><button className="table-action" type="button" onClick={() => setSelected(customer)} aria-label={`Open ${customer.name}`}>•••</button></td></tr>)}</tbody></table></div></section>{selected ? <CustomerDrawer customer={selected} onClose={() => setSelected(null)} onToggle={() => { onToggle(selected.id); setSelected(null); }} /> : null}</>;
}
function CustomerDrawer({ customer, onClose, onToggle }: { customer: Customer; onClose: () => void; onToggle: () => void }) { return <div className="admin-drawer-backdrop" onClick={onClose}><aside className="admin-drawer" onClick={(e) => e.stopPropagation()}><button className="drawer-close" type="button" onClick={onClose}>×</button><p className="eyebrow">Customer profile</p><div className="drawer-person"><span className="customer-avatar large">{customer.initials}</span><div><h2>{customer.name}</h2><p>{customer.email}</p></div></div><div className="drawer-status"><span className={`status-pill ${customer.status.toLowerCase().replace(" ", "-")}`}>{customer.status}</span><span>Customer ID {customer.id.toUpperCase()}</span></div><div className="drawer-metrics"><div><small>Current plan</small><b>{customer.plan}</b></div><div><small>Billing</small><b>{customer.billing}</b></div><div><small>Total paid</small><b>{customer.total}</b></div><div><small>Last payment</small><b>{customer.lastPayment}</b></div></div><div className="drawer-section"><p className="panel-kicker">Payment history</p><div className="payment-line"><span><b>PayPal payment</b><small>Core access · {customer.lastPayment}</small></span><strong>{customer.total}</strong></div><div className="payment-line"><span><b>Plan status</b><small>Access and renewal settings</small></span><span className="status-pill active">Current</span></div></div><div className="drawer-actions"><button className="btn btn-ghost" type="button" onClick={onClose}>Close</button><button className={`btn ${customer.status === "Deactivated" ? "btn-moss" : "btn-danger"}`} type="button" onClick={onToggle}>{customer.status === "Deactivated" ? "Reactivate access" : "Deactivate customer"}</button></div></aside></div>; }

function Families() { return <><div className="admin-section-heading"><div><p className="eyebrow">18 connected households</p><h2>Families</h2><p className="muted">See the relationships connected through Family Plans and who is still getting set up.</p></div><button className="btn btn-ghost" type="button">Download roster ↓</button></div><section className="admin-panel admin-table-panel"><div className="admin-family-banner"><div><span className="admin-family-icon">⌁</span><span><b>Family health</b><small>15 households are active and up to date</small></span></div><strong>83%</strong></div><div className="admin-table-wrap"><table className="admin-table family-table"><thead><tr><th>Household</th><th>Owner</th><th>Members</th><th>Plan</th><th>Total collected</th><th>Last activity</th><th>Status</th></tr></thead><tbody>{familySeed.map((family) => <tr key={family.name}><td><b>{family.name}</b><small>Connected checklists</small></td><td>{family.owner}</td><td><span className="member-stack"><i>J</i><i>M</i><i>+</i></span> {family.members}</td><td>{family.plan}</td><td><strong>{family.revenue}</strong></td><td className="table-muted">{family.updated}</td><td><span className={`status-pill ${family.status === "Healthy" ? "active" : "past-due"}`}>{family.status}</span></td></tr>)}</tbody></table></div></section><section className="admin-family-cards"><article className="admin-panel"><p className="panel-kicker">Connection flow</p><h3>Family members are finishing setup</h3><p className="muted">Two invitations are waiting for a member to accept. Keep an eye on them here instead of hunting through individual accounts.</p><button className="text-button" type="button">View pending invites ↗</button></article><article className="admin-panel"><p className="panel-kicker">Plan mix</p><div className="plan-mix"><span><i className="moss" />Monthly family <b>12</b></span><span><i className="clay" />Annual family <b>6</b></span></div></article></section></>; }

function Traffic({ blockedIps, onToggleIp }: { blockedIps: string[]; onToggleIp: (ip: string) => void }) { return <><div className="admin-section-heading"><div><p className="eyebrow">Live signal</p><h2>Traffic & security</h2><p className="muted">Understand where people come from and quickly contain unusual activity.</p></div><span className="traffic-live"><i /> Monitoring now</span></div><div className="traffic-kpis"><div><span>Visitors today</span><b>218</b><small>+18% vs. yesterday</small></div><div><span>Checkout starts</span><b>31</b><small>14.2% of visitors</small></div><div><span>Flagged sessions</span><b className="orange-text">3</b><small>Needs review</small></div><div><span>Blocked IPs</span><b>{blockedIps.length}</b><small>Active rules</small></div></div><section className="admin-panel admin-table-panel"><div className="admin-table-toolbar"><div><p className="panel-kicker">Recent sessions</p><h3>Traffic feed</h3></div><button className="btn btn-ghost" type="button">Export CSV ↓</button></div><div className="admin-table-wrap"><table className="admin-table traffic-table"><thead><tr><th>Time / IP</th><th>Source</th><th>Page</th><th>Device & location</th><th>Signal</th><th>Action</th></tr></thead><tbody>{trafficSeed.map((row) => { const blocked = blockedIps.includes(row.ip); return <tr key={row.ip}><td><b>{row.time}</b><small>{row.ip}</small></td><td>{row.source}</td><td><code>{row.page}</code></td><td><b>{row.device}</b><small>{row.location}</small></td><td><span className={`status-pill ${blocked ? "blocked" : row.risk === "Review" ? "review" : "active"}`}>{blocked ? "Blocked" : row.risk}</span></td><td>{row.risk === "Review" || blocked ? <button className={`table-action-button ${blocked ? "unblock" : ""}`} type="button" onClick={() => onToggleIp(row.ip)}>{blocked ? "Unblock IP" : "Block IP"}</button> : <span className="table-muted">{row.action}</span>}</td></tr>; })}</tbody></table></div></section><div className="security-note"><span className="security-note-icon">✓</span><span><b>Privacy-first by default.</b> Traffic signals are designed to help you protect the service without storing more personal data than you need.</span><button type="button">Review retention settings ↗</button></div></>; }

function Discounts({ discounts, showForm, setShowForm, onSave }: { discounts: Discount[]; showForm: boolean; setShowForm: (value: boolean) => void; onSave: (discount: Discount) => void }) {
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [redemptionCustomer, setRedemptionCustomer] = useState<Customer | null>(null);
  const redemptions: Record<string, Customer[]> = {
    READY10: customerSeed.slice(0, 3),
    FAMILY25: [customerSeed[0], customerSeed[2]],
    WELCOME5: [customerSeed[1], customerSeed[3], customerSeed[4]],
  };
  const selected = redemptionCode ? redemptions[redemptionCode] || [] : [];
  return <>
    <div className="admin-section-heading"><div><p className="eyebrow">Checkout incentives</p><h2>Discount codes</h2><p className="muted">Create codes customers can enter at checkout and keep track of what is working.</p></div><button className="btn btn-primary" type="button" onClick={() => setShowForm(true)}>+ Create discount</button></div>
    <div className="discount-callout"><span className="discount-spark">%</span><span><b>Codes are checked before payment</b><small>Customers will see the savings in their checkout summary before they open PayPal.</small></span><span className="admin-live-dot"><i /> Checkout ready</span></div>
    <section className="admin-panel admin-table-panel"><div className="admin-table-wrap"><table className="admin-table discount-table"><thead><tr><th>Code</th><th>Offer</th><th>Redemptions</th><th>Expires</th><th>Status</th><th /></tr></thead><tbody>{discounts.map((discount) => <tr key={discount.id}><td><code className="discount-code">{discount.code}</code></td><td><b>{discount.value} off</b><small>{discount.type} discount</small></td><td><button className="redemption-link" type="button" onClick={() => { setRedemptionCode(discount.code); setRedemptionCustomer(null); }}><b>{discount.uses}</b> customers <span>↗</span></button></td><td>{discount.expires}</td><td><span className={`status-pill ${discount.active ? "active" : "deactivated"}`}>{discount.active ? "Active" : "Expired"}</span></td><td><button className="table-action" type="button">•••</button></td></tr>)}</tbody></table></div></section>
    {redemptionCode ? <div className="admin-modal-backdrop" onClick={() => setRedemptionCode(null)}><aside className="admin-modal redemption-modal" onClick={(e) => e.stopPropagation()}><button className="drawer-close" type="button" onClick={() => setRedemptionCode(null)}>×</button><p className="eyebrow">Redemption history</p><h2>{redemptionCode}</h2><p className="muted">Customers who have used this code. Select a customer to open their profile.</p><div className="redemption-list">{redemptionCustomer ? <div className="redemption-profile"><div className="drawer-person"><span className="customer-avatar large">{redemptionCustomer.initials}</span><div><h3>{redemptionCustomer.name}</h3><p>{redemptionCustomer.email}</p></div></div><div className="drawer-metrics"><div><small>Plan</small><b>{redemptionCustomer.plan}</b></div><div><small>Billing</small><b>{redemptionCustomer.billing}</b></div><div><small>Total paid</small><b>{redemptionCustomer.total}</b></div><div><small>Last payment</small><b>{redemptionCustomer.lastPayment}</b></div></div><button className="text-button" type="button" onClick={() => setRedemptionCustomer(null)}>← Back to all redemptions</button></div> : null}{!redemptionCustomer ? selected.map((customer) => <button className="redemption-customer" type="button" key={customer.id} onClick={() => setRedemptionCustomer(customer)}><span className="customer-avatar">{customer.initials}</span><span><b>{customer.name}</b><small>{customer.email} · {customer.plan}</small></span><strong>{customer.total}</strong><span className="redemption-arrow">↗</span></button>) : null}</div><div className="drawer-actions"><button className="btn btn-ghost" type="button" onClick={() => setRedemptionCode(null)}>Close</button></div></aside></div> : null}
    {showForm ? <DiscountForm onClose={() => setShowForm(false)} onSave={onSave} /> : null}
  </>;
}

function DiscountForm({ onClose, onSave }: { onClose: () => void; onSave: (discount: Discount) => void }) { const [code, setCode] = useState(""); const [type, setType] = useState<"Percent" | "Fixed">("Percent"); const [value, setValue] = useState("10"); const [expires, setExpires] = useState("Dec 31, 2026"); function submit(e: FormEvent) { e.preventDefault(); if (!code.trim()) return; onSave({ id: `d-${Date.now()}`, code: code.trim().toUpperCase(), type, value: type === "Percent" ? `${value}%` : `$${Number(value || 0).toFixed(2)}`, uses: 0, expires, active: true }); } return <div className="admin-modal-backdrop"><form className="admin-modal" onSubmit={submit}><button className="drawer-close" type="button" onClick={onClose}>×</button><p className="eyebrow">New checkout offer</p><h2>Create a discount code</h2><p className="muted">The code will be available immediately on your checkout form.</p><label className="field"><span>Code</span><input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="READY15" /></label><div className="admin-form-grid"><label className="field"><span>Discount type</span><select value={type} onChange={(e) => setType(e.target.value as "Percent" | "Fixed")}><option>Percent</option><option>Fixed</option></select></label><label className="field"><span>Value</span><input required type="number" min="1" value={value} onChange={(e) => setValue(e.target.value)} /></label></div><label className="field"><span>Expiration</span><input value={expires} onChange={(e) => setExpires(e.target.value)} /></label><div className="drawer-actions"><button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit">Create code</button></div></form></div>; }

function ContentTools({ catalog, safety, refreshAccount, onSaved }: { catalog: { items: Array<{ id: string; permanent_key: string; text: string }>; }; safety: Array<unknown>; refreshAccount: () => Promise<void>; onSaved: (message: string) => void }) { const [subtab, setSubtab] = useState<"items" | "videos" | "safety">("items"); return <><div className="admin-section-heading"><div><p className="eyebrow">Existing owner tools</p><h2>Checklist & resources</h2><p className="muted">Keep your preparedness content current from the same console.</p></div></div><div className="toolbar admin-content-tabs"><button className={`btn ${subtab === "items" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setSubtab("items")}>Checklist items</button><button className={`btn ${subtab === "videos" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setSubtab("videos")}>Video resources</button><button className={`btn ${subtab === "safety" ? "btn-forest" : "btn-ghost"}`} type="button" onClick={() => setSubtab("safety")}>Safety directory</button></div>{subtab === "items" && <div className="admin-panel admin-content-panel">{catalog.items.slice(0, 80).map((item) => <label className="field" key={item.id}><span>{item.permanent_key}</span><input defaultValue={item.text} onBlur={async (e) => { await supabase.from("checklist_items").update({ text: e.target.value }).eq("id", item.id); onSaved("Item wording saved."); await refreshAccount(); }} /></label>)}</div>}{subtab === "videos" && <VideoForm onSaved={onSaved} />}{subtab === "safety" && <SafetyForm onSaved={onSaved} existing={safety.length} />}</>; }

function VideoForm({ onSaved }: { onSaved: (s: string) => void }) { const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [video_url, setUrl] = useState(""); const [category, setCategory] = useState("Home Readiness"); const [source_name, setSource] = useState("Safety Prep List"); async function submit(e: FormEvent) { e.preventDefault(); const { error } = await supabase.from("video_resources").insert({ title, description, video_url, category, source_name, active: Boolean(video_url), sort_order: 90 }); onSaved(error ? error.message : "Video saved."); } return <form onSubmit={submit} className="panel admin-form-panel"><label className="field"><span>Title</span><input required value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="field"><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label><label className="field"><span>Video URL</span><input value={video_url} onChange={(e) => setUrl(e.target.value)} /></label><label className="field"><span>Category</span><input value={category} onChange={(e) => setCategory(e.target.value)} /></label><label className="field"><span>Source</span><input value={source_name} onChange={(e) => setSource(e.target.value)} /></label><button className="btn btn-primary" type="submit">Add video</button></form>; }
function SafetyForm({ onSaved, existing }: { onSaved: (s: string) => void; existing: number }) { const [agency_name, setName] = useState(""); const [phone, setPhone] = useState(""); const [website, setWebsite] = useState(""); const [source_url, setSource] = useState(""); const [state, setState] = useState(""); const [category, setCategory] = useState("utilities"); async function submit(e: FormEvent) { e.preventDefault(); const { error } = await supabase.from("safety_contacts").insert({ agency_name, phone: phone || null, website: website || null, source_url: source_url || null, state: state || null, category, verified_at: new Date().toISOString().slice(0, 10), active: true }); onSaved(error ? error.message : `Saved. Directory now starts from ${existing + 1} records.`); } return <form onSubmit={submit} className="panel admin-form-panel"><label className="field"><span>Agency</span><input required value={agency_name} onChange={(e) => setName(e.target.value)} /></label><label className="field"><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(SAFETY_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label className="field"><span>State</span><select value={state} onChange={(e) => setState(e.target.value)}><option value="">National</option>{US_STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label><label className="field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label className="field"><span>Website</span><input value={website} onChange={(e) => setWebsite(e.target.value)} /></label><label className="field"><span>Source URL</span><input value={source_url} onChange={(e) => setSource(e.target.value)} /></label><button className="btn btn-primary" type="submit">Add resource</button></form>; }

function OnboardingSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const [copy, setCopy] = useState(() => loadCopy());
  const update = (index: number, field: "title" | "body", value: string) => setCopy((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  function save() {
    localStorage.setItem(COPY_KEY, JSON.stringify(copy));
    onSaved("Onboarding tour text saved for new and replayed customer tours.");
  }
  function reset() {
    const defaults = DEFAULT_STEPS.map(({ title, body }) => ({ title, body }));
    setCopy(defaults);
    localStorage.setItem(COPY_KEY, JSON.stringify(defaults));
    onSaved("Onboarding tour text reset to the Safety Prep List defaults.");
  }
  return <div className="admin-form-panel admin-onboarding-settings"><div className="admin-section-heading"><div><p className="eyebrow">Owner controls</p><h2>Onboarding tour</h2><p className="muted">Edit the words customers see in the guided tour. The spotlight locations stay connected to the app.</p></div></div><div className="admin-onboarding-note"><b>Video and welcome slides</b><span>The welcome video is ready as a visual slot. Add your final video URL in the onboarding component when you are ready to publish it.</span></div>{copy.map((item, index) => <fieldset className="admin-onboarding-step" key={index}><legend>Tour stop {index + 1}</legend><label className="account-field"><span>Title</span><input value={item.title} onChange={(event) => update(index, "title", event.target.value)} /></label><label className="account-field"><span>Description</span><textarea rows={3} value={item.body} onChange={(event) => update(index, "body", event.target.value)} /></label></fieldset>)}<div className="drawer-actions"><button className="btn btn-ghost" type="button" onClick={reset}>Reset defaults</button><button className="btn btn-primary" type="button" onClick={save}>Save tour text</button></div></div>;
}
