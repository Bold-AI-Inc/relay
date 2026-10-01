# Security Policy

Thanks for helping keep Relay and its users safe.

## Supported versions

The `main` branch and the latest release on the Chrome Web Store are the only
versions receiving security updates. If you're running an older locally-loaded
build, update to the latest tag before reporting.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**
Publicly disclosing a vulnerability before it's fixed puts users at risk.

Instead, email <pibrahim@experiencebold.ai> with:

1. A description of the vulnerability and its potential impact
2. Steps to reproduce (a proof-of-concept is ideal)
3. Affected version(s) — the `manifest.json` `version` field or a commit hash
4. Any suggested fix, if you have one

You should receive an acknowledgement within **3 business days**. If you don't,
please follow up — mail can get lost.

## What we'll do

- Acknowledge the report within 3 business days.
- Assess severity, confirm the issue, and propose a fix within 14 days for
  high-severity issues.
- Coordinate a release timeline with you before public disclosure.
- Credit you in the release notes if you'd like.

## Scope

This project handles Linear OAuth tokens (stored locally in
`chrome.storage.local`), captures screenshots of pages the user actively
invokes the extension on, and calls Linear's API on the user's behalf. In
scope for reports:

- Token or credential leakage
- Ability to trigger a capture or issue creation without a user gesture
- Cross-site data exposure through the injected content script or shadow DOM
- Bypasses of Chrome's `activeTab` model
- OAuth flow issues (redirect handling, PKCE validation, refresh handling)
- Supply-chain concerns in the shipped extension package

Out of scope:

- Missing security headers on the Chrome Web Store listing page
- Rate-limiting issues against Linear's API itself
- Issues in third-party services (Linear, Chrome, etc.) — please report those
  to the respective vendors

## Safe harbor

We consider security research conducted in good faith to be authorized. If you
follow this policy — private disclosure, no data destruction, no interaction
with accounts other than your own — we will not pursue legal action against
you and will work with you to resolve the issue.
