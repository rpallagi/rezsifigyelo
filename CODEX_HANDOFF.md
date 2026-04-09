# Codex Handoff

Last updated: 2026-04-08

## Project

- App: `rezsifigyelo` / `rezsikovetes.hu`
- Stack: Next.js, Clerk, Stripe, Neon, Vercel, tRPC, Drizzle
- Production branch: `main`
- Production deploys from Vercel on push to `main`

## Important implemented changes

- Fixed major auth/access-control gaps across routers.
- Fixed post-login redirect behavior.
- Added initial HU/EN i18n foundation.
- Added billing groundwork with Szamlazz.hu integration.
- Added landlord multi-entity model:
  - one login can own multiple invoicing/landlord profiles
  - each property is assigned to one landlord profile
  - billing uses the selected landlord profile as seller
- Added pending tenant invitation visibility in admin UI.
- Updated `README.md` to reflect the real modern architecture.

## Current product model

- `user` = the human account
- `landlordProfile` = invoicing/landlord entity under that login
- `property` belongs to one `landlordProfile`
- tenant access and invoice buyer data are separate concerns

## Known UX direction from user

- Focus more on UI polish than tenant flow.
- Mobile-friendly UI is critical.
- Clear visual indication is needed for the active landlord profile:
  - on billing screens
  - on property screens
  - generally whenever invoicing context matters
- Future monetization idea:
  - multi-entity invoicing can become a higher paid tier

## Tenant invite state note

- A tenant that "did not save" was actually stored as a pending invitation, not an active tenancy.
- UI was updated to surface pending invitations on:
  - tenants page
  - property detail page

## Stitch MCP status

- Stitch MCP endpoint exists at:
  - `https://stitch.googleapis.com/mcp`
- Codex config updated at:
  - `/Users/rpallagi/.codex/config.toml`
- Current MCP config:
  - `[mcp_servers.stitch]`
  - `url = "https://stitch.googleapis.com/mcp"`
  - `env_http_headers = { "x-goog-api-key" = "STITCH_API_KEY" }`
- `STITCH_API_KEY` was set in the macOS user session with `launchctl setenv`
- The provided Stitch secret works as `x-goog-api-key`, not as bearer auth
- Direct API test confirmed access to Stitch projects
- Codex app restart/new session is likely required before Stitch tools appear

## Recommended next work

1. Restart Codex and verify Stitch MCP tools are available.
2. Inspect the Stitch projects/screens and compare them to the current app UI.
3. Run a UI polish pass focused on:
   - dashboard hierarchy
   - property detail readability
   - billing clarity
   - mobile spacing and scanning
   - restoring "small but useful" visual feedback from the older Flask app
4. Then review remaining Flask-era UX gaps.

## If resuming later

Tell Codex:

`Use /Users/rpallagi/Developer/rezsifigyelo/CODEX_HANDOFF.md as the session handoff. We are continuing the rezsifigyelo app work, with focus on UI polish and Stitch MCP design comparison.`
