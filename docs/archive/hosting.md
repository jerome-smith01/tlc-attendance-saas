# Hosting Guide: Cloudflare Pages Deployment

This document outlines the setup and configuration for deploying the TLC Attendance React SPA to **Cloudflare Pages** under the subdomain `tlc.goodplusfast.com`.

---

## Overview & Monorepo Configuration

The codebase is structured as a monorepo containing `frontend/`, `extension/`, `supabase/`, and `docs/`.

Cloudflare Pages supports monorepos natively:
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Build Output Directory:** `dist`

---

## 1. Single Page Application (SPA) Routing

To allow React Router client-side routing to function without throwing 404 errors on direct navigation or page refresh, Cloudflare Pages relies on a `_redirects` file located in `frontend/public/_redirects`:

```
/*    /index.html   200
```

---

## 2. Environment Variables

Set the following environment variables in the Cloudflare Pages dashboard under **Settings -> Environment Variables -> Production & Preview**:

- `VITE_SUPABASE_URL`: Your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase Public Anon Key
- `NODE_VERSION`: `20`

---

## 3. Supabase Auth Configuration

In the Supabase Dashboard (**Authentication -> URL Configuration**):

1. **Site URL:** Set to `https://tlc.goodplusfast.com`
2. **Redirect URLs:** Add:
   - `https://tlc.goodplusfast.com/**`
   - `https://*.pages.dev/**` (for Cloudflare preview deployments)

---

## 4. Custom Domain Setup

In Cloudflare Pages (**Custom Domains**):
- Add `tlc.goodplusfast.com`.
- Cloudflare automatically manages DNS records and SSL/TLS certificates.
