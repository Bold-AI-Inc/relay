# Changelog

All notable changes to **Linear Screenshot** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the version numbers follow [Semantic Versioning](https://semver.org/).

## [1.3.0] — 2026-06-11

### Added
- **"Capture Whole Page" mode.** The popup now has a second button that skips
  the drag-select overlay and sends the full visible tab straight to the
  Send-to-Linear form. Useful when the bug is the overall layout. Submit Another
  preserves whichever mode you started in.

### Notes
- "Whole page" here means the **visible viewport**, not the full scrollable
  page. Capturing scrolled content would require the `debugger` permission,
  which is a Chrome Web Store review red flag — deliberately not added.

## [1.2.0] — 2026-06-11

### Added
- **In-modal "Refresh" link** next to the Project label that re-pulls teams and
  projects from Linear without closing the modal. Result is reported in the
  modal footer (e.g. `Refreshed — 3 teams, 4 projects`).

### Changed
- **Project-fetch errors are now visible.** The popup previously swallowed any
  error from the `projects` query inside a silent `try/catch`, leaving users
  with an empty Project dropdown and no explanation. Errors now surface in the
  modal footer and the popup console.

## [1.1.1] — 2026-06-11

### Changed
- **Priority dropdown reordered by severity.** Urgent was previously buried
  at the bottom of the list (because options were laid out by Linear's
  priority IDs `0, 2, 3, 4, 1`). New order matches Linear's own UI:
  `No priority → Urgent → High → Medium (default) → Low`.

## [1.1.0] — 2026-06-11

### Added
- **"Submit Another" flow** for bulk triage. A new "Submit another after this
  one" checkbox lives below both the Create and Attach forms. When enabled,
  the success screen shows a **Submit Another** button that:
  1. Re-captures the visible tab (using the still-valid `activeTab` grant),
  2. Tears down the success modal,
  3. Drops you straight back into the selection overlay.

  Letting you fire off bug reports without touching the toolbar between each.

## [1.0.2] — 2026-06-11

### Fixed
- **Crop was not applied to the uploaded image.** Cropping only updated the
  preview shown in the modal; the upload handler still read the original
  full-viewport capture from session storage. Users selecting a region saw
  the right preview but Linear received the entire visible tab. Now the
  cropped image is persisted back as the pending screenshot so the upload
  matches what was selected. **This bug was present in 1.0.0.**

## [1.0.1] — 2026-06-11

### Fixed
- **"Screenshot is no longer available" errors on cold start.** The captured
  screenshot was held in a module-level variable inside the service worker.
  MV3 terminates idle service workers after ~30 s, so the variable was wiped
  between capture and upload whenever the user took more than a few seconds
  to drag a region or fill out the form — especially on first-ever use after
  install. Moved to `chrome.storage.session`, which survives SW restarts
  within a browser session.

## [1.0.0] — 2026-06-11

Initial release. Submitted to the Chrome Web Store.

### Added
- **Drag-to-select capture.** Click the toolbar icon, drag a box around the
  region you want, and the rest of the tab gets cropped away.
- **Create new Linear issues** with title, description, team, project, and
  priority. New issues are routed to the team's Triage queue automatically.
- **Attach to existing issues.** Search by title or identifier and drop the
  screenshot in as a comment.
- **Environment diagnostics** baked into every issue: page URL, browser,
  OS, viewport size, screen size, device pixel ratio, language, online
  status, and timestamp — captured at the moment of the screenshot.
- **Sign in with Linear** via OAuth 2.0 + PKCE. No client secret, no backend,
  all client-side. Tokens stored in `chrome.storage.local` and auto-refreshed.
- **Personal API key fallback** under an "advanced" section in Settings for
  anyone who prefers it.
- **Configurable scopes** via `config.js` (default `read,write`).
- Marketing assets (1280×800 hero, 440×280 promo tile, 1400×560 marquee).
- Public privacy policy hosted as a GitHub Gist.
- `build.sh` to produce the upload zip reproducibly.
- `PUBLISHING.md` with the full Chrome Web Store walkthrough.

### Security
- Talks only to Linear (`*.linear.app`) and Linear's own storage hosts
  (`*.amazonaws.com`, `*.googleapis.com`, `*.linearassets.com`). No analytics,
  no third-party servers, no remote code.

[1.3.0]: https://github.com/pibrah/linear-screenshot-extension/releases/tag/v1.3.0
[1.2.0]: https://github.com/pibrah/linear-screenshot-extension/releases/tag/v1.2.0
[1.1.1]: https://github.com/pibrah/linear-screenshot-extension/releases/tag/v1.1.1
[1.1.0]: https://github.com/pibrah/linear-screenshot-extension/releases/tag/v1.1.0
[1.0.2]: https://github.com/pibrah/linear-screenshot-extension/releases/tag/v1.0.2
[1.0.1]: https://github.com/pibrah/linear-screenshot-extension/releases/tag/v1.0.1
[1.0.0]: https://github.com/pibrah/linear-screenshot-extension/releases/tag/v1.0.0
