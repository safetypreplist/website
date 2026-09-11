# GitHub Pages + custom domain

The frontend is a static Vite app. GitHub Actions builds it on push to `main` using **public** `VITE_` secrets only.

## 1. Push this repository to GitHub

```bash
git add .
git commit -m "Initial Safety Prep List application"
git remote add origin git@github.com:YOUR_USER/safety-prep-list.git
git push -u origin main
```

## 2. Pages settings

Repository → Settings → Pages:

- Source: **GitHub Actions**

## 3. Actions secrets

Settings → Secrets and variables → Actions, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYPAL_CLIENT_ID`
- `VITE_PAYPAL_ENV` (`live` for production)
- `VITE_APP_URL` (`https://yourdomain.com`)
- `VITE_SUPPORT_EMAIL`
- `VITE_SUPPORT_NAME`

The workflow is `.github/workflows/deploy.yml`. It copies `index.html` to `404.html` so deep links (`/app/lists/grab-go`) load the SPA.

## 4. Custom domain (existing .com)

1. In the repo, add `public/CNAME` containing only your domain, one line:

```
yourdomain.com
```

2. At your DNS host, point the domain at GitHub Pages:

   - Apex: `A` records to GitHub Pages IPs, **or** an `ALIAS`/`ANAME` if your DNS supports it
   - `www`: `CNAME` to `YOUR_USER.github.io`

   Current GitHub Pages A records are documented here:  
   https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

3. Settings → Pages → Custom domain → `yourdomain.com` → check **Enforce HTTPS**

4. Add the same URL to:
   - Supabase Auth redirect URLs
   - Edge Function `APP_URL`
   - PayPal app return URLs (via `APP_URL` used by the functions)

## 5. PWA

After HTTPS is on, iPhone/Android users can use **Add to Home Screen**. The manifest uses forest `#1E2A1F` and cream `#F4F0E5`, display `standalone`.

Offline: the app shell and recently loaded public checklist definitions can appear from cache. Edits made offline show **Waiting to sync**, then **Saved ✓** / **Synced ✓** after the server confirms. The UI does not pretend an unsynced check has reached the cloud.

## Local preview of production build

```bash
npm run build
npm run preview
```
