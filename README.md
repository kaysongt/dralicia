# Dr. Alicia Unified Website Hub

Static HTML/CSS/JS site, deployed to GitHub Pages.

## Run locally

No build step required — just serve the folder, e.g.:
```bash
npx serve .
```
or open `index.html` directly in a browser.

## Deploy

Pushes to `main` trigger `.github/workflows/jekyll-gh-pages.yml`, which builds
with GitHub's Jekyll action and publishes to GitHub Pages (custom domain via `CNAME`).

## Next implementation steps
1. Replace placeholder links with live URLs (HelloAlma, Teachable, Shopify, TikTok Shop).
2. Connect form submission to CRM/webhook (Keep, Zapier, Make, or direct API).
3. Add Stripe payment links/checkout routes and test mode.
4. Set up analytics (Google Analytics or Plausible).
