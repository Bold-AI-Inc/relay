# Linear Screenshot

A Chrome extension (Manifest V3) that captures a user-selected area of any web
page and sends it to Linear as a new issue or a comment on an existing one — in
two clicks.

- 📸 Drag-to-select capture, no full-page noise.
- 🆕 Create new issues (with team, project, priority, auto-Triage routing) or
  💬 attach the screenshot to an existing issue as a comment.
- 🧭 Bug context attached automatically: page URL, browser, OS, viewport, DPR,
  language, timestamp.
- 🔐 Sign in with Linear (OAuth 2.0 + PKCE), or use a personal API key.
- 📡 Zero third parties — talks only to Linear.

**Privacy policy:** <https://gist.github.com/pibrah/e1c79df093228b1f880501cd86d132c0>

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
build.sh               Builds the upload zip (linear-screenshot-extension.zip)
PUBLISHING.md          End-to-end publishing guide (CWS + Linear OAuth setup)
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
./build.sh        # writes linear-screenshot-extension.zip
```

---

## License

Source-available, private repository. Not currently open-sourced.
