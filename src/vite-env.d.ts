/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PAYPAL_CLIENT_ID: string;
  readonly VITE_PAYPAL_ENV: string;
  readonly VITE_APP_URL: string;
  readonly VITE_SUPPORT_EMAIL: string;
  readonly VITE_SUPPORT_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  paypal?: {
    Buttons: (opts: Record<string, unknown>) => { render: (selector: string | HTMLElement) => Promise<void> };
  };
}
