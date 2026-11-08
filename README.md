# Istanbul Home Advisor — website + chat bot

**Website** (`public/index.html`, the homepage at istanbulhomeadvisor.com): an immersive scroll journey (dive from a map of Istanbul onto the Bosphorus, golden hour turning to night, then pull back through a living-room window: "this could be your view"), an interactive district map with approved-project counts per district, services, featured projects (pulled live from the
same approved data as the bot), how it works, FAQ, contact, all in the same 5 languages. Every "Ask the advisor" button, and
"Ask about this project" on each card, opens the bot in a chat panel (full screen on phones). The site's language choice is passed to
the bot. WhatsApp button appears once `WHATSAPP_NUMBER` is set in Vercel.

**Bot** (`public/chat.html`, also works on its own at /chat.html): a chat page for foreign buyers (5 languages) that recommends approved Tier 1 projects from the Google Sheet,
answers typed questions with Claude, and saves consented leads to the sheet's **Leads** tab.

```
Buyer's browser ──► public/index.html (website) ──panel──► public/chat.html?embed=1 (chat)
                      │ /api/data  → approved projects from the sheet (refreshed every 10 min; built-in snapshot if the sheet can't be read)
                      │ /api/chat  → Claude API (key stays on the server)
                      └ /api/lead  → new row in "Leads" (only after KVKK consent)
```

## What decides what the bot offers (edit the sheet, not the code)
- **Recommended** = rows in *Tier 1 Research* with **Approved? = Yes** whose project is **1 - Offer** in *Source Inventory* column C.
- Change a price/status → edit that row in *Tier 1 Research*. Remove a project → set Approved? to *Reject* or change its tier.
- Tier 2 / Tier 3 / unapproved Tier 1 → the bot only recognises the name and suggests alternatives.
- Changes appear within ~10 minutes.

## One-time setup (about 30 minutes)
1. **Claude API key** (optional, only when you want AI answers) — console.anthropic.com → sign up → Billing (add card, set a monthly spend limit) → API keys → Create key.
2. **Google service account** (lets the server read the sheet and add leads)
   - console.cloud.google.com → create project "istanbul-bot" → enable **Google Sheets API**.
   - IAM & Admin → Service accounts → Create → Keys → Add key → JSON (a file downloads).
   - Open the Google Sheet → Share → paste the service account's email (ends in `gserviceaccount.com`) → **Editor**.
3. **GitHub** — put this folder in a repository (Claude can push it for you).
4. **Vercel** — Add New → Project → import the repository → Framework preset "Other" → before deploying, add the
   environment variables from `.env.example` (paste the whole JSON file as `GOOGLE_SERVICE_ACCOUNT`) → Deploy.
5. Fill in the [brackets] in `public/privacy.html` and have a lawyer check it.
6. Domain: Vercel → Project → Settings → Domains → add `istanbulhomeadvisor.com` and `www.istanbulhomeadvisor.com`, then copy the DNS records Vercel shows into your domain registrar. Set `ALLOWED_ORIGINS` to `https://istanbulhomeadvisor.com,https://www.istanbulhomeadvisor.com`.

## Visitor accounts (Sign in with Google, free)
Before the advisor shows matching projects, visitors create an account with one tap on Google. Each account becomes a row
in the sheet's **Users** tab (email, name, language, goal, answers, sign-in count). Leads from signed-in visitors carry their
account email in column M of **Leads**. Until `GOOGLE_CLIENT_ID` is set, the chat shows matches without asking to sign in.
1. https://console.cloud.google.com → pick the same project as the service account.
2. **APIs & Services → OAuth consent screen**: External, app name "Istanbul Home Advisor", support email, logo optional,
   authorised domain `istanbulhomeadvisor.com`, privacy policy `https://istanbulhomeadvisor.com/privacy.html`. Scopes: only the
   default email, profile, openid. Then **Publish app** (no Google review is needed for these basic scopes).
3. **Credentials → Create credentials → OAuth client ID → Web application**. Authorised JavaScript origins:
   `https://istanbulhomeadvisor.com`, `https://www.istanbulhomeadvisor.com`, your `https://YOUR-APP.vercel.app`.
   No redirect URI is needed.
4. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) → Vercel → Environment Variables → `GOOGLE_CLIENT_ID` → Redeploy.
5. Optional: `SESSION_SECRET` (any long random text) signs the login cookie; without it a secret is derived from the service account key.

## Satellite map key (Esri, free tier)
1. Sign up free at https://location.arcgis.com (no card needed for the free tier: 2 million map tiles a month).
2. Create an API key: Developer credentials → New item → API key. Under privileges tick **Basemaps** only.
   Under allowed referrers add `https://istanbulhomeadvisor.com`, `https://www.istanbulhomeadvisor.com` and your `*.vercel.app` address.
3. Vercel → Project → Settings → Environment Variables → add `ESRI_API_KEY` = the key → Redeploy.
Without a payment method Esri never charges; if the free tiles ran out, the map imagery would pause until the next month.

## No-AI mode (current, costs nothing)
Without `ANTHROPIC_API_KEY` the bot uses only your data: all button flows and recommendations work as normal; typed messages
are matched to a project name (shows its card) or a legal topic (citizenship, residence, title deed, taxes, payments, buying steps,
in all 5 languages); anything else gets a friendly "use the buttons or talk to an agent". Add the key later and redeploy to switch Claude on.

## Private test mode (current)
- Set `ACCESS_CODE` in Vercel (any phrase). Visitors see a "Private preview" box and must enter it; the chat and the API are locked for everyone else. The code is remembered on that device for 30 days.
- Share a direct link with your team: `https://YOUR-APP.vercel.app/?access=YOUR-CODE`.
- `public/robots.txt` tells search engines not to list the site.
- **To go public:** delete `ACCESS_CODE` in Vercel, replace `public/robots.txt` with `User-agent: *` / `Allow: /`, redeploy.

## Database
The Google Sheet is the database for now: projects are read from *Tier 1 Research* + *Source Inventory*, leads go to *Leads*.
All sheet access is in `lib/sheet.js` and `lib/data.js`, so moving to a real database later (e.g. Supabase/Postgres for leads, chat logs and a CRM view) only changes those two files.

## Test locally
`npm run dev` (with the env vars set) → http://localhost:3000. `test/` has a fake Claude API and a browser test.

## Costs and safety
- Each typed question is one Claude API call (the catalog part of the prompt is cached). Button flows cost nothing.
- Per-visitor limits: 20 typed questions / 10 min, 80 / day; 5 lead submissions / hour. Set a monthly limit in the Anthropic Console as the real cap.
- Internal notes (`notes` column) are never sent to the browser; Claude sees them only as "do not quote".
- Leads are written as plain text (no formulas). Visitors' typed questions go to Anthropic to generate replies — this is stated in the privacy notice.
