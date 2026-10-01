# Chrome Web Store Listing

Canonical copy of every field in the Chrome Web Store dev dashboard
([chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole))
so future updates don't have to re-derive it. Keep this file in sync when
the listing is edited.

**Item ID:** `lapenaefiefajnngaakldaefkhilbdap`
**Public URL:** <https://chrome.google.com/webstore/detail/lapenaefiefajnngaakldaefkhilbdap>

---

## Summary (short description — 132 char limit)

> Relay a snapshot of any page to Linear — as a new issue or a comment on an existing one. Two clicks, zero third parties.

---

## Full description

```
Relay a screenshot to Linear without leaving the page.

Relay (previously Linear Screenshot) lets you select any area of a web page and create a Linear issue from it — or attach it as a comment to an existing issue — in two clicks. No tab-switching, no manual uploads, no copy-pasting URLs.

What it does

📸 Drag-to-select capture, or whole-page. Click the toolbar icon, drag a box around the part of the page you want (or send the whole visible tab).

🆕 Create a new issue with title, description, team, project, assignee, and priority. New issues route to your team's Triage queue by default — one click to skip Triage per submission.

💬 Or attach to an existing issue. Search by title or identifier and drop the screenshot in as a comment.

🧭 Bug context, automatically. Every issue includes the page title, URL, browser, OS, viewport size, screen size, device pixel ratio, language, and timestamp — captured at the moment of the screenshot.

🔁 "Submit Another" flow for bulk triage sessions — fire off bug reports back-to-back without touching the toolbar.

🔐 Sign in with Linear via OAuth 2.0 + PKCE, or use a personal API key.

Built for bug reports and design feedback

Whether you're triaging customer-reported bugs, sending design nits to engineering, or filing your own UI issues, Relay turns a multi-step workflow into a 5-second action.

Open source

Relay is released under the Apache License 2.0 by Bold AI. Source, issue tracker, and roadmap at https://github.com/Bold-AI-Inc/relay — contributions welcome.

Privacy

Nothing is sent anywhere except Linear, and only when you click Send. No analytics, no tracking, no third-party servers. Your credentials and screenshots stay between your browser and your Linear workspace.
```

---

## Single purpose description

> Capture a user-selected area of the current web page and send it to the user's Linear workspace as a new issue or as a comment on an existing issue.

---

## Permission justifications

### activeTab

> Used to capture a screenshot of the visible area of the user's current tab when they click the extension's toolbar button and to inject the in-page selection overlay. Access is granted only by that explicit user gesture, only for that one tab, and only for the duration of the action.

### storage

> Used to persist the user's Linear sign-in locally (`chrome.storage.local`) so they do not have to reconnect on every use. This holds either OAuth tokens or, if the user chose the API-key fallback, the personal API key they pasted. No screenshot content or page data is stored.

### scripting

> Used to inject the selection overlay (`content.js`) into the current tab when the user clicks "Capture Area", so they can drag-select a region. The script is only injected on demand in response to that user click, never automatically.

### tabs

> Used to read the active tab's title and URL when the user initiates a capture. The title pre-fills the issue title; the URL is included in the issue's environment diagnostics so the recipient knows where the bug was filed from.

### identity

> Used to run the "Connect to Linear" sign-in flow via `chrome.identity.launchWebAuthFlow`. This implements Linear's standard OAuth 2.0 with PKCE, returning an access token that is stored locally. No identity information is sent anywhere except Linear's own OAuth endpoints.

### Host permission

> Required to call Linear's API and upload screenshots to Linear's storage:
> • `https://*.linear.app/*` — Linear's GraphQL API at `api.linear.app` (queries for teams, projects, issue search, and the issue/comment creation mutations).
> • `https://*.amazonaws.com/*` and `https://*.googleapis.com/*` — Linear returns short-lived presigned upload URLs on these hosts (S3 / Google Cloud Storage); the screenshot is `PUT` directly to them.
> • `https://*.linearassets.com/*` — Linear's CDN host that backs the same uploads in some workspaces.
> No host other than Linear and Linear's own storage backends is ever contacted.

---

## Remote code

**Answer:** `No, I am not using remote code.`

All JavaScript ships inside the extension package. No `eval`, no externally
loaded modules, no `<script src="https://…">`.

---

## Privacy policy URL

Primary (currently set on the listing):
<https://gist.github.com/pibrah/e1c79df093228b1f880501cd86d132c0>

Mirrored in-repo (equivalent content, more canonical URL for future updates):
<https://github.com/Bold-AI-Inc/relay/blob/main/PRIVACY.md>

Both are kept in sync. Either is valid.

---

## Graphic assets

All live in `store/`.

| Field | File | Required? |
|---|---|---|
| Store icon (128×128) | `../icons/icon128.png` | yes |
| Screenshot 1 | `screenshot-create-1280x800.png` | yes (≥1) |
| Screenshot 2 | `screenshot-overlay-1280x800.png` | optional |
| Screenshot 3 | `screenshot-connected-1280x800.png` | optional |
| Screenshot 4 | `screenshot-attach-1280x800.png` | optional |
| Screenshot 5 (hero/title card) | `screenshot-1280x800.png` | optional |
| Small promo tile (440×280) | `promo-440x280.png` | recommended |
| Marquee tile (1400×560) | `marquee-1400x560.png` | optional, used if Google features the item |

Screenshot order matters — the first two render on the item card in search
results. The order above puts the strongest product shots first.

---

## Category

**Productivity** → sub-category *Workflow & Planning*.

---

## Package

Build with `./build.sh`. Output: `relay.zip` in the repo root. Upload that
via **Package → Upload new package**. Bump `manifest.json` `version` before
every upload — CWS rejects any upload at or below the published version.
