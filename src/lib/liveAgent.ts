export const LIVEAGENT_URL = "https://safetypreplist.ladesk.com";

// Each LiveAgent chat button is routed to one department in LiveAgent
// (Configuration > Chat > Chat buttons > Advanced), so sales and support each need their own button ID.
export const LIVEAGENT_CHAT_BUTTONS = {
  sales: "dlea3xko",
  support: "94abgncj",
} as const;

export type ChatTopic = keyof typeof LIVEAGENT_CHAT_BUTTONS;

type LiveAgentButton = {
  chat?: unknown;
  onClick: () => void;
  onCloseFunction_?: () => void;
};

type LiveAgentApi = {
  createButton: (id: string, anchor: Element) => LiveAgentButton;
  setUserDetails: (email?: string, firstName?: string, lastName?: string, phone?: string) => void;
  clearAllUserDetails: () => void;
};

declare global {
  interface Window {
    LiveAgent?: LiveAgentApi;
  }
}

export type ChatVisitor = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

const SCRIPT_ID = "la_x2s6df8d";
const READY_TIMEOUT_MS = 12000;
const WINDOW_WAIT_MS = 30000;

let loader: Promise<LiveAgentApi> | null = null;
let host: HTMLDivElement | null = null;
const buttons = new Map<string, LiveAgentButton>();
const chatListeners = new Set<(open: boolean) => void>();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostElement() {
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "liveagent-host";
  host.hidden = true;
  document.body.appendChild(host);
  return host;
}

export function loadLiveAgent(): Promise<LiveAgentApi> {
  if (window.LiveAgent) return Promise.resolve(window.LiveAgent);
  if (loader) return loader;
  loader = new Promise<LiveAgentApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.defer = true;
    script.src = `${LIVEAGENT_URL}/scripts/track.js`;
    script.onload = () => (window.LiveAgent ? resolve(window.LiveAgent) : reject(new Error("Chat did not load.")));
    script.onerror = () => reject(new Error("Chat did not load."));
    hostElement().appendChild(script);
  }).catch((error: unknown) => {
    loader = null;
    document.getElementById(SCRIPT_ID)?.remove();
    throw error;
  });
  return loader;
}

function buttonFor(api: LiveAgentApi, id: string) {
  const existing = buttons.get(id);
  if (existing) return existing;
  const anchor = document.getElementById(SCRIPT_ID) ?? hostElement();
  const button = api.createButton(id, anchor);
  const originalClose = button.onCloseFunction_?.bind(button);
  button.onCloseFunction_ = () => {
    originalClose?.();
    // LiveAgent also fires this for the other department's button when a window opens.
    window.setTimeout(() => {
      if (!chatWindowVisible()) chatListeners.forEach((listener) => listener(false));
    }, 300);
  };
  buttons.set(id, button);
  return button;
}

let watcher: number | null = null;

function chatWindowVisible() {
  // Online buttons open a chat; offline buttons (no agent available) open LiveAgent's contact form.
  const frames = document.querySelectorAll<HTMLIFrameElement>("iframe.i-embedded-chat, iframe.i-embedded-form");
  return Array.from(frames).some((frame) => {
    const rect = frame.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(frame).visibility !== "hidden";
  });
}

async function waitForChatWindow() {
  const started = Date.now();
  while (Date.now() - started < WINDOW_WAIT_MS) {
    if (chatWindowVisible()) return true;
    await wait(250);
  }
  return false;
}

// Backup for onCloseFunction_: LiveAgent hides its chat iframe when the visitor closes the chat.
function watchChatWindow() {
  if (watcher !== null) window.clearInterval(watcher);
  watcher = window.setInterval(() => {
    if (chatWindowVisible()) return;
    if (watcher !== null) window.clearInterval(watcher);
    watcher = null;
    chatListeners.forEach((listener) => listener(false));
  }, 1000);
}

/** Loads LiveAgent and creates the chat buttons ahead of time so opening a chat is instant. */
export async function prepareLiveAgent() {
  const api = await loadLiveAgent();
  for (const id of new Set(Object.values(LIVEAGENT_CHAT_BUTTONS))) buttonFor(api, id);
}

export async function openLiveAgentChat(topic: ChatTopic, visitor?: ChatVisitor) {
  const api = await loadLiveAgent();
  api.clearAllUserDetails();
  if (visitor?.email) {
    api.setUserDetails(visitor.email, visitor.firstName || "", visitor.lastName || "", visitor.phone || "");
  }
  const button = buttonFor(api, LIVEAGENT_CHAT_BUTTONS[topic]);
  const started = Date.now();
  let clicked = false;
  // LiveAgent sets up the button asynchronously; onClick throws until it is ready.
  while (!clicked && Date.now() - started < READY_TIMEOUT_MS) {
    try {
      button.onClick();
      clicked = true;
    } catch {
      await wait(250);
    }
  }
  // LiveAgent's window can take several seconds to load after the click.
  if (!clicked || !(await waitForChatWindow())) throw new Error("Chat is taking too long to open.");
  chatListeners.forEach((listener) => listener(true));
  watchChatWindow();
}

export function onLiveAgentChatChange(listener: (open: boolean) => void) {
  chatListeners.add(listener);
  return () => {
    chatListeners.delete(listener);
  };
}
