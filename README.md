# Istanbul Home Advisor — public chat bot

A chat page for foreign buyers (5 languages) that recommends approved Tier 1 projects from the Google Sheet,
answers typed questions with Claude, and saves consented leads to the sheet's **Leads** tab.

```
Buyer's browser ──► public/index.html (chat)
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
1. **Claude API key** — console.anthropic.com → sign up → Billing (add card, set a monthly spend limit) → API keys → Create key.
2. **Google service account** (lets the server read the sheet and add leads)
   - console.cloud.google.com → create project "istanbul-bot" → enable **Google Sheets API**.
   - IAM & Admin → Service accounts → Create → Keys → Add key → JSON (a file downloads).
   - Open the Google Sheet → Share → paste the service account's email (ends in `gserviceaccount.com`) → **Editor**.
3. **GitHub** — put this folder in a repository (Claude can push it for you).
4. **Vercel** — Add New → Project → import the repository → Framework preset "Other" → before deploying, add the
   environment variables from `.env.example` (paste the whole JSON file as `GOOGLE_SERVICE_ACCOUNT`) → Deploy.
5. Fill in the [brackets] in `public/privacy.html` and have a lawyer check it.
6. Optional: Vercel → Domains → add your domain (e.g. chat.yourdomain.com), then set `ALLOWED_ORIGINS`.

## Test locally
`npm run dev` (with the env vars set) → http://localhost:3000. `test/` has a fake Claude API and a browser test.

## Costs and safety
- Each typed question is one Claude API call (the catalog part of the prompt is cached). Button flows cost nothing.
- Per-visitor limits: 20 typed questions / 10 min, 80 / day; 5 lead submissions / hour. Set a monthly limit in the Anthropic Console as the real cap.
- Internal notes (`notes` column) are never sent to the browser; Claude sees them only as "do not quote".
- Leads are written as plain text (no formulas). Visitors' typed questions go to Anthropic to generate replies — this is stated in the privacy notice.
