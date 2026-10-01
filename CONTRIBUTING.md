# Contributing to Relay

Thank you for considering a contribution. This project is maintained by
[Bold AI](https://experiencebold.ai) and released under the
[Apache License 2.0](./LICENSE).

Contributions are welcome — bug reports, feature ideas, doc fixes, and code.
This guide covers how to set up the project locally, propose a change, and
what we expect from PRs.

## Code of conduct

Participating in this project means agreeing to our
[Code of Conduct](./CODE_OF_CONDUCT.md). Please read it. Report unacceptable
behavior to <pibrahim@experiencebold.ai>.

## Reporting bugs and requesting features

- **Bug reports:** open a GitHub issue using the "Bug report" template. Include
  browser + version, reproduction steps, expected vs. actual, and — if
  relevant — a screenshot or a link to the Linear issue the extension created.
- **Feature requests:** open a GitHub issue using the "Feature request"
  template. Explain the problem you're trying to solve first; the specific
  feature comes second.
- **Security vulnerabilities:** please don't open a public issue. Follow the
  private disclosure path in [SECURITY.md](./SECURITY.md).

## Local development

You need Google Chrome (or any Chromium-based browser) and a Linear account.

1. **Clone the repo**
   ```sh
   git clone https://github.com/Bold-AI-Inc/relay.git
   cd relay
   ```
2. **Load the extension** in Chrome
   - Open `chrome://extensions`
   - Toggle **Developer mode** (top right)
   - Click **Load unpacked** → select this folder
3. **Sign in to Linear** in the extension's Settings page
   - The published build ships with a working OAuth client ID. For local
     development against your own Linear OAuth app, edit `config.js` and set
     `self.LINEAR_OAUTH_CLIENT_ID` to your app's client ID.
   - See [PUBLISHING.md](./PUBLISHING.md) for the full OAuth app setup walkthrough.
4. **Reload after any change.** For most edits, click the ⟳ icon on the extension
   card. For `manifest.json` or `host_permissions` changes, do a full reload
   (remove + re-add). See the notes in `PUBLISHING.md`.

## Making a change

1. **Fork** the repo and create a topic branch off `main`:
   ```sh
   git checkout -b my-fix-or-feature
   ```
2. **Make the change.** Keep the diff focused — one logical change per PR.
3. **Test manually.** There's no automated test suite yet; verify your change
   works end-to-end against a real Linear workspace before opening the PR.
4. **Update the changelog.** Add an entry under an `## [Unreleased]` section at
   the top of [CHANGELOG.md](./CHANGELOG.md) (create the section if absent).
   Follow the Keep-a-Changelog format the rest of the file uses.
5. **Commit with a clear message.** See the section below.
6. **Add yourself to [AUTHORS](./AUTHORS)** in your first PR if you'd like to
   be listed.
7. **Open a pull request.** Fill out the PR template. Link related issues.

## Commit message conventions

- **Subject line ≤ 72 characters.** Imperative mood ("Fix crop bug", not
  "Fixed" or "Fixes").
- **Body wrapped to ~72 columns.** Explain the *why*, not just the *what*.
  If you're fixing a bug, describe the symptom, the root cause, and why this
  is the right fix.
- **Reference issues** with `Fixes #123` / `Refs #123` where relevant.

## Code style

- **No build step, no dependencies.** This is intentional — the extension is
  plain HTML/CSS/JS running in the browser. Please don't introduce a bundler,
  framework, or npm dependencies without discussion first.
- **Match the existing style.** Two-space indentation, single quotes, trailing
  semicolons, sparse comments explaining *why* rather than *what*.
- **Manifest V3 only.** No `<all_urls>`, no remote code, no `debugger`
  permission — these will fail Chrome Web Store review.
- **All Linear traffic through the service worker.** The popup, options page,
  and content script never call `api.linear.app` directly; they route through
  `background.js` so we don't hit MV3 CSP or CORS edge cases.

## What lives where

See the **Repository layout** section in [README.md](./README.md) for the
one-line-per-file map.

## License

By submitting a pull request, you agree that your contribution will be
licensed under the [Apache License 2.0](./LICENSE), the same license as the
rest of the project. Apache-2.0 §5 makes this explicit — no separate CLA is
required.
