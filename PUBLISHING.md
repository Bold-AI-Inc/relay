# Publishing “Relay” to the Chrome Web Store

This walks you through everything from zero: setting up Linear OAuth, getting the
extension’s ID, and publishing. Follow the steps in order — a few of them depend on
each other (the OAuth redirect URL depends on the extension ID, which is easiest to
lock in *after* you create the Web Store listing).

There’s a chicken‑and‑egg between the **extension ID**, the **OAuth redirect URL**,
and the **Client ID**. The order below resolves it cleanly.

---

## How auth works in this extension

- **OAuth (recommended for users):** a “Connect to Linear” button runs Linear’s
  **PKCE** OAuth flow via `chrome.identity.launchWebAuthFlow`. No client secret is
  needed or stored — a `client_id` is public and safe to ship. Tokens live in
  `chrome.storage.local`; the 24‑hour access token is auto‑refreshed.
- **API key (fallback):** under “Use a personal API key instead”, a user can paste a
  Linear personal API key. Useful before you’ve set up OAuth, or as a backup.

Everything the extension can do maps to the requested scopes `read,write`
(list teams/projects, search issues, create issues/comments, upload the screenshot).

---

## Step 1 — Get a stable extension ID

The OAuth redirect URL is `https://<EXTENSION_ID>.chromiumapp.org/`, so you need the
ID first. The cleanest way to get the **final, permanent** ID is to create the Web
Store item now (you don’t have to publish it yet).

1. Create a **Chrome Web Store developer account**:
   <https://chrome.google.com/webstore/devconsole> — one‑time **$5** registration fee.
2. Zip the extension (see Step 5) and click **Add new item** → upload the zip. This
   creates a *draft* listing and permanently assigns your extension an ID.
3. Open the item → **Package** (or the item URL) and copy the **Item ID** — that’s your
   `EXTENSION_ID`.
4. *(Recommended, so local testing uses the same ID)* On the item’s page, find the
   **public key**: item menu → **“Get public key”** (or **Package → View public key**).
   Add it to `manifest.json` as a top‑level `"key": "<paste>"` field. Now an unpacked
   local load and the published build share one ID — and therefore one redirect URL.

> Prefer to test locally first? You can. Load the extension unpacked
> (`chrome://extensions` → Developer mode → **Load unpacked**), copy the ID Chrome
> assigns, and register *that* redirect URL in Linear too. Linear lets you add multiple
> redirect URLs, so you can keep both the dev and production URLs. The downside is the
> unpacked ID changes if you move the folder — pinning `"key"` (step 4) avoids that.

---

## Step 2 — Create the Linear OAuth application

1. Go to <https://linear.app/settings/api/applications/new>
   (Linear → Settings → API → **OAuth applications** → **Create**).
2. Fill in name (“Relay”), icon, description.
3. **Redirect URIs:** add exactly the URL shown on the extension’s **Settings** page
   (“OAuth setup (for publishers)” → the read‑only **redirect URL** box). It looks like:
   ```
   https://<EXTENSION_ID>.chromiumapp.org/
   ```
   The trailing slash matters — paste it exactly.
4. **Scopes / public:** ensure the app can request `read` and `write`. Because this is a
   **public client using PKCE**, you do **not** need the client secret.
5. Save, then copy the **Client ID**.

---

## Step 3 — Configure the extension

Open `config.js` and paste your Client ID:

```js
self.LINEAR_OAUTH_CLIENT_ID = 'YOUR_LINEAR_CLIENT_ID';
self.LINEAR_OAUTH_SCOPES   = 'read,write';
```

That’s the only code change required. `config.js` contains **no secrets** — a client_id
is public by design.

---

## Step 4 — Test the full flow locally

1. `chrome://extensions` → **Load unpacked** → select this folder (or **Reload** if
   already loaded). Reload fully after any `manifest.json` or `host_permissions` change.
2. Open the extension’s **Settings** → click **Connect to Linear** → approve in the
   popup window. You should land back on Settings showing
   “Connected with Linear (OAuth)” and your teams listed.
3. Click the toolbar icon → **Capture Area** → drag a region → create an issue and
   attach to an existing issue. Confirm both succeed and the screenshot renders in Linear.
4. Click **Disconnect** and confirm it returns to the not‑connected state.

---

## Step 5 — Package for the Web Store

Zip the extension **contents** (not the parent folder). From this directory:

```sh
zip -r linear-screenshot.zip . \
  -x "*.DS_Store" -x "PUBLISHING.md" -x "*.git*"
```

Include: `manifest.json`, `background.js`, `config.js`, `content.js`, `popup.html`,
`popup.js`, `options.html`, `options.js`, and the `icons/` folder.
You can omit `PUBLISHING.md` (it’s just docs).

---

## Step 6 — Complete the store listing & submit

In the Web Store developer dashboard for your item, fill in:

- **Store icon:** `icons/icon128.png` (a 512×512 is also provided at `icons/icon512.png`
  if a larger one is requested).
- **Screenshots:** 1280×800 or 640×400 — capture the popup, the selection overlay, and
  the “Send to Linear” form.
- **Description & category** (Developer Tools / Productivity).
- **Privacy:**
  - **Single purpose:** “Capture a selected area of the current page and send it to
    Linear as an issue or comment.”
  - **Permission justifications:**
    - `activeTab` + `scripting` — inject the selection overlay only on the tab the user
      clicked, on demand.
    - `tabs` — read the active tab’s title/URL to prefill the issue.
    - `storage` — store the OAuth tokens / API key locally.
    - `identity` — run the Linear OAuth sign‑in flow.
    - **host permissions** (`*.linear.app`, `*.amazonaws.com`, `*.googleapis.com`,
      `*.linearassets.com`) — call Linear’s GraphQL API and upload the screenshot to
      Linear’s presigned storage bucket.
  - **Data usage:** screenshots and issue text are sent only to Linear at the user’s
    request; no analytics, no third‑party servers, nothing sold. A **privacy policy URL**
    is required — host a short page stating the above.
- **Remote code:** answer **No** (all code ships in the package; no remote scripts).

Submit for review. First reviews typically take a few business days.

---

## Updating later

Bump `"version"` in `manifest.json`, re‑zip, and upload a new package to the same item.
The extension ID, redirect URL, and Client ID stay the same — no need to touch Linear.

---

## Troubleshooting

- **“OAuth is not configured”** — `config.js` `LINEAR_OAUTH_CLIENT_ID` is still empty.
- **Linear shows “redirect_uri mismatch”** — the URL registered in Linear doesn’t match
  `chrome.identity.getRedirectURL()` exactly (check the trailing slash and that you used
  the *final* extension ID). Copy it from the Settings page’s redirect box.
- **Sign‑in window closes with no result** — usually a popup blocker or the user
  dismissed it; just retry.
- **Upload fails with a host‑permission error** — Linear changed its storage host. Add
  the host shown in the error to `host_permissions` and fully reload the extension.
- **“Session expired, please reconnect”** — the refresh token was revoked (e.g. user
  removed the app in Linear). Click **Connect to Linear** again.
