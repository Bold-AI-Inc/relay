# Relay — Linear Screenshot Tool

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-listing-5B5BD6)](https://chrome.google.com/webstore/detail/lapenaefiefajnngaakldaefkhilbdap)

**Relay a snapshot of any page to Linear — as a new issue, or as a comment on an existing one — in two clicks.**

A Chrome extension (Manifest V3) that lives in your toolbar: drag-select a
region (or capture the whole visible tab), fill a quick form, send. The
screenshot lands in Linear with the page title, URL, browser, OS, viewport
and other diagnostics attached automatically.

Built and maintained by [Bold AI](https://experiencebold.ai) and released
under the [Apache License 2.0](./LICENSE). Contributions welcome —
see [CONTRIBUTING.md](./CONTRIBUTING.md).

- 📸 Drag-to-select capture, or send the whole visible tab.
- 🆕 Create new issues (with team, project, priority, assignee, Triage routing) or
  💬 attach the screenshot to an existing issue as a comment.
- 🧭 Bug context attached automatically: page title + URL, browser, OS, viewport, DPR,
  language, timestamp.
- 🔐 Sign in with Linear (OAuth 2.0 + PKCE), or use a personal API key.
- 📡 Zero third parties — talks only to Linear.

**Privacy policy:** [`PRIVACY.md`](./PRIVACY.md) · also mirrored at
<https://gist.github.com/pibrah/e1c79df093228b1f880501cd86d132c0> (the URL the
Chrome Web Store listing points at — kept live for continuity)
**Changelog:** [`CHANGELOG.md`](./CHANGELOG.md)
**Contributing:** [`CONTRIBUTING.md`](./CONTRIBUTING.md) · **Code of Conduct:** [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) · **Security:** [`SECURITY.md`](./SECURITY.md)

---

## Repository layout

```
manifest.json          Extension manifest (MV3)
background.js          Service worker — Linear API + OAuth + screenshot crop
config.js              Editable: Linear OAuth client_id (public, safe to commit)
content.js             In-page selection overlay + "Send to Linear" modal
popup.html / popup.js  Toolbar popup (capture button, auth gate)
options.html / options.js   Settings page (Connect / Disconnect, API key fallback)
icons/                 16/32/48/128 toolbar + extension icons (and 512 for the store)
store/                 Web Store marketing assets (screenshots, promo tiles)
build.sh               Builds the upload zip (relay.zip)
PUBLISHING.md          End-to-end publishing guide (CWS + Linear OAuth setup)

# Open source project files
LICENSE                Apache License 2.0 (canonical text)
NOTICE                 Copyright + attribution required by Apache-2.0
AUTHORS                List of contributors
CHANGELOG.md           Version history (Keep a Changelog format)
CONTRIBUTING.md        How to contribute — dev setup, PRs, commit style
CODE_OF_CONDUCT.md     Contributor Covenant 2.1
SECURITY.md            Vulnerability reporting policy
.github/               Issue and PR templates
```

---

## How it works

```
toolbar click ──▶ popup captures the visible tab (chrome.tabs.captureVisibleTab)
              └─▶ stashes screenshot in the background worker's memory
              └─▶ injects content.js into the page
                  ├─ user drag-selects a region
                  ├─ content.js asks the background worker to crop the stash
                  └─ shows the "Send to Linear" modal
                       ├─ Create → uploadImage → issueCreate (stateId = triage)
                       └─ Attach → uploadImage → commentCreate

auth is resolved once per request by background.js getAuthHeader():
  - OAuth tokens in chrome.storage.local (auto-refreshed when expired), OR
  - personal API key (fallback)
```

All network traffic goes through the service worker so the popup, options page,
and content script never need to do cross-origin requests directly (this avoids
MV3 CSP and CORS edge cases).

---

## Local development

1. `chrome://extensions` → toggle **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open the extension's **Options** page → either:
   - Click **Connect to Linear** (requires the OAuth client ID to be set in
     `config.js` — see `PUBLISHING.md`), or
   - Open "Use a personal API key instead" and paste a key from
     <https://linear.app/settings/api>.
4. Click the toolbar icon → **Capture Area** → drag → fill the form → send.

After any change to `manifest.json` or `host_permissions`, do a **full reload**
of the extension at `chrome://extensions` (not just a tab refresh).

---

## Publishing

See [`PUBLISHING.md`](./PUBLISHING.md) for the full from-scratch walkthrough:
Chrome Web Store account, getting the extension ID, registering the Linear
OAuth app, pinning the manifest `key`, building the zip, and submission.

Quick build:

```sh
./build.sh        # writes relay.zip
```

---

## License

Copyright 2026 [Bold AI](https://experiencebold.ai).

Licensed under the [Apache License, Version 2.0](./LICENSE) (the "License");
you may not use this project except in compliance with the License. You may
obtain a copy of the License at <http://www.apache.org/licenses/LICENSE-2.0>.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an **"AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND**, either express or implied. See the
[LICENSE](./LICENSE) and [NOTICE](./NOTICE) files for the full terms.

See [AUTHORS](./AUTHORS) for the list of contributors.
