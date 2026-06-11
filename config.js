// ─────────────────────────────────────────────────────────────────────────────
// Linear OAuth configuration
// ─────────────────────────────────────────────────────────────────────────────
// Paste the "Client ID" from your Linear OAuth application below.
//
//   1. Go to https://linear.app/settings/api/applications/new
//   2. Set the redirect URL to the value printed on the extension's Settings
//      page (looks like  https://<extension-id>.chromiumapp.org/ ).
//   3. Copy the Client ID here.
//
// Leave it as an empty string to disable OAuth and use a personal API key only.
// (See PUBLISHING.md for the full walkthrough.)
//
// NOTE: A client_id is NOT a secret — it is safe to ship in the extension.
//       Linear uses PKCE, so no client_secret is required for this app.
self.LINEAR_OAUTH_CLIENT_ID = '';

// Scopes requested during OAuth. `read` is needed to list teams/projects and to
// search issues; `write` covers creating issues, comments and uploading files.
self.LINEAR_OAUTH_SCOPES = 'read,write';
