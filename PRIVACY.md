# Privacy Policy — Relay

_Last updated: 1 October 2026_

This Chrome extension ("Relay", "the extension") captures a user-selected area of the current web page and sends it to the user's own Linear workspace as a new issue or a comment on an existing issue.

This policy explains what data the extension handles, where it goes, and what it does not do.

## 1. Data the extension processes

When you actively use the extension (by clicking the toolbar button and selecting an area), it processes the following:

- **The screenshot you capture.** Only the area you drag-select is captured. It is uploaded to your own Linear workspace's storage and embedded in the Linear issue or comment you create.
- **The issue content you type.** The title, description, team, project, and priority you enter in the "Send to Linear" form are sent to Linear with your issue.
- **Environment diagnostics for that capture.** The page URL, browser name and version, operating system, viewport size, screen size, device pixel ratio, browser language, online status, and capture timestamp are included in the body of the issue so the recipient has context for the bug report.
- **The active tab's title and URL** at the moment of capture, used to pre-fill the issue title and the diagnostics block.

The extension does **not** collect, transmit, or store any of the above unless you click "Send to Linear" in its UI.

## 2. Credentials stored locally on your device

To talk to Linear on your behalf, the extension keeps one of the following in `chrome.storage.local` on your own device:

- An **OAuth access token and refresh token**, issued by Linear when you click "Connect to Linear", **or**
- A **personal API key**, if you chose the fallback option and pasted one in.

These credentials are stored locally only. They are not transmitted anywhere except to Linear's own API endpoints (`linear.app` and `api.linear.app`) for the purpose of authenticating your requests. You can remove them at any time from the extension's Settings page ("Disconnect" or "Remove key").

## 3. Where data is sent

The extension communicates only with the following hosts, and only for the purposes listed:

- **`linear.app`, `api.linear.app`** — Linear's OAuth and GraphQL API endpoints (sign-in, listing teams/projects, searching issues, creating issues and comments, requesting an upload URL).
- **`*.amazonaws.com`, `*.googleapis.com`, `*.linearassets.com`** — Linear's own short-lived presigned storage URLs that the screenshot is uploaded to. These hosts are returned by Linear's API; the extension does not contact them otherwise.

No data is sent to the developer, to analytics providers, to advertising networks, or to any third party other than the Linear infrastructure listed above.

## 4. What the extension does **not** do

- It does **not** collect personal information, browsing history, or page content automatically.
- It does **not** read or capture any page content without an explicit user action (click + drag-select).
- It does **not** run on tabs you have not actively invoked it on.
- It does **not** use cookies, tracking pixels, or analytics.
- It does **not** sell, share, or transfer user data to any third party.
- It does **not** load remote code; all scripts are bundled in the extension package.

## 5. Permissions, in plain terms

- **`activeTab` / `scripting`** — to draw the selection overlay on the tab you click from, only on that tab, only on demand.
- **`tabs`** — to read the active tab's title and URL when you start a capture.
- **`storage`** — to remember your Linear sign-in locally so you don't reconnect every time.
- **`identity`** — to run Linear's standard OAuth sign-in flow.
- **Host permissions** (Linear and Linear's storage hosts) — to upload screenshots and create issues/comments via the Linear API.

## 6. Children's privacy

The extension is not directed at children under 13 and does not knowingly collect data from them.

## 7. Changes to this policy

If this policy changes, the new version will be published at this URL with an updated "Last updated" date. Continued use of the extension after such an update constitutes acceptance of the revised policy.

## 8. Contact

Questions or concerns about this policy can be sent via a GitHub issue on the extension's repository, or by emailing the maintainer through the contact address listed on the Chrome Web Store listing.

