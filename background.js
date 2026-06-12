// Editable OAuth config (client_id, scopes)
importScripts('config.js');

// ── OAuth endpoints (Linear) ────────────────────────────────────────────────
const OAUTH = {
  clientId: (self.LINEAR_OAUTH_CLIENT_ID || '').trim(),
  scopes: (self.LINEAR_OAUTH_SCOPES || 'read,write').trim(),
  authUrl: 'https://linear.app/oauth/authorize',
  tokenUrl: 'https://api.linear.app/oauth/token',
  revokeUrl: 'https://api.linear.app/oauth/revoke'
};

const oauthConfigured = () => OAUTH.clientId.length > 0;

// Temporary screenshot storage.
//
// We persist the captured screenshot in chrome.storage.session (not a module
// variable) because MV3 terminates idle service workers after ~30 s. A module
// variable would be wiped between capture and upload, leaving the user with
// "screenshot is no longer available" if they took more than a few seconds to
// drag a region or fill out the form. session storage survives SW restarts
// within the same browser session and is cleared automatically on browser exit.
async function setPendingScreenshot(dataUrl) {
  await chrome.storage.session.set({ pendingScreenshot: dataUrl });
}
async function getPendingScreenshot() {
  const { pendingScreenshot } = await chrome.storage.session.get('pendingScreenshot');
  return pendingScreenshot || null;
}
async function clearPendingScreenshot() {
  await chrome.storage.session.remove('pendingScreenshot');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'STORE_SCREENSHOT':
      setPendingScreenshot(message.dataUrl)
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;

    // Reports whether the extension can talk to Linear, and how.
    case 'GET_AUTH_STATE':
      getAuthState()
        .then(state => sendResponse(state))
        .catch(() => sendResponse({ connected: false, method: null, oauthConfigured: oauthConfigured() }));
      return true;

    // Kick off the interactive PKCE OAuth flow.
    case 'START_OAUTH':
      startOAuth()
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;

    // Revoke + clear the OAuth session (API key, if any, is left untouched).
    case 'LOGOUT':
      logout()
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ error: err.message }));
      return true;

    // Re-captures the visible tab and stashes it — used by the "Submit Another"
    // flow so a follow-up capture doesn't require another toolbar click. Relies
    // on the activeTab grant that's still valid from the original popup click.
    case 'CAPTURE_VISIBLE_TAB':
      chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: 'png' }, async (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        try {
          await setPendingScreenshot(dataUrl);
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      });
      return true;

    // Used by the "Capture Whole Page" flow so the content script can show
    // the un-cropped capture in the form preview without re-cropping.
    case 'GET_PENDING_SCREENSHOT':
      getPendingScreenshot()
        .then(dataUrl => sendResponse({ dataUrl: dataUrl || null }))
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'CROP_SCREENSHOT':
      // Crop the stored full-viewport capture down to the user's selection,
      // then REPLACE the stored screenshot with the cropped version so the
      // subsequent upload uses what the user actually selected (not the full
      // viewport — that was the bug in v1.0.x).
      getPendingScreenshot()
        .then(dataUrl => {
          if (!dataUrl) return sendResponse({ error: 'No screenshot available' });
          return cropScreenshot(dataUrl, message.selection)
            .then(async cropped => {
              await setPendingScreenshot(cropped);
              sendResponse({ dataUrl: cropped });
            });
        })
        .catch(err => sendResponse({ error: err.message }));
      return true;

    // Called from popup / content script — uses the active credential
    case 'LINEAR_API':
      withAuth(auth =>
        linearRequest(auth, message.query, message.variables)
          .then(data => sendResponse({ data }))
          .catch(err => sendResponse({ error: err.message }))
      , sendResponse);
      return true;

    // Called from options page — uses the key provided in the message (not yet saved)
    case 'VERIFY_API_KEY':
      linearRequest(message.apiKey, '{ teams { nodes { id name key } } }')
        .then(data => sendResponse({ data }))
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'UPLOAD_AND_CREATE_ISSUE':
      withAuth(async auth => {
        try {
          const screenshot = await getPendingScreenshot();
          if (!screenshot) throw new Error('Screenshot is no longer available — please capture again.');
          const assetUrl = await uploadImage(screenshot, auth);
          const description = buildDescription(assetUrl, message.diagnostics);
          const json = await linearRequest(auth, `
            mutation Create($input: IssueCreateInput!) {
              issueCreate(input: $input) {
                success
                issue { id identifier url title }
              }
            }
          `, {
            input: {
              teamId: message.teamId,
              title: message.title,
              description: message.extraDescription
                ? `${message.extraDescription}\n\n${description}`
                : description,
              priority: message.priority,
              // Routes the issue into the team's Triage queue when provided
              ...(message.stateId ? { stateId: message.stateId } : {}),
              // Optional project association (scoped to the selected team)
              ...(message.projectId ? { projectId: message.projectId } : {}),
              // Optional assignee (any active workspace user)
              ...(message.assigneeId ? { assigneeId: message.assigneeId } : {})
            }
          });
          const created = json?.data?.issueCreate;
          if (!created?.success || !created.issue) {
            throw new Error('Linear could not create the issue.');
          }
          await clearPendingScreenshot();
          sendResponse({ data: json });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      }, sendResponse);
      return true;

    case 'UPLOAD_AND_ATTACH':
      withAuth(async auth => {
        try {
          const screenshot = await getPendingScreenshot();
          if (!screenshot) throw new Error('Screenshot is no longer available — please capture again.');
          const assetUrl = await uploadImage(screenshot, auth);
          const body = buildDescription(assetUrl, message.diagnostics);
          const json = await linearRequest(auth, `
            mutation Comment($input: CommentCreateInput!) {
              commentCreate(input: $input) {
                success
                comment { id }
              }
            }
          `, { input: { issueId: message.issueId, body } });
          if (!json?.data?.commentCreate?.success) {
            throw new Error('Linear could not attach the screenshot.');
          }
          await clearPendingScreenshot();
          sendResponse({ data: json });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      }, sendResponse);
      return true;
  }
});

// ── Auth resolution ──────────────────────────────────────────────────────────
// Resolves the Authorization header value to use for Linear requests.
// Prefers an OAuth session (refreshing if expired); falls back to a personal
// API key. The returned string is dropped straight into the Authorization
// header — OAuth is "Bearer <token>", an API key is the raw key.
async function getAuthHeader() {
  const { oauth, apiKey } = await chrome.storage.local.get(['oauth', 'apiKey']);

  if (oauth?.accessToken) {
    let token = oauth.accessToken;
    if (!oauth.expiresAt || Date.now() >= oauth.expiresAt) {
      token = await refreshAccessToken(oauth);
    }
    return `Bearer ${token}`;
  }

  if (apiKey) return apiKey;

  throw new Error('Not connected to Linear. Open Settings to connect.');
}

// Wraps a worker that needs a credential. On failure (no/expired auth) it
// reports the error back to the caller instead of running `fn`.
function withAuth(fn, sendResponse) {
  getAuthHeader()
    .then(auth => fn(auth))
    .catch(err => sendResponse({ error: err.message }));
}

async function getAuthState() {
  const { oauth, apiKey } = await chrome.storage.local.get(['oauth', 'apiKey']);
  if (oauth?.accessToken) return { connected: true, method: 'oauth', oauthConfigured: oauthConfigured() };
  if (apiKey) return { connected: true, method: 'apikey', oauthConfigured: oauthConfigured() };
  return { connected: false, method: null, oauthConfigured: oauthConfigured() };
}

// ── PKCE OAuth flow ──────────────────────────────────────────────────────────
function base64url(bytes) {
  let binary = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(byteLength = 32) {
  const a = new Uint8Array(byteLength);
  crypto.getRandomValues(a);
  return base64url(a);
}

async function sha256(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
}

async function startOAuth() {
  if (!oauthConfigured()) {
    throw new Error('OAuth is not configured. Add a Linear Client ID in config.js (see PUBLISHING.md), or use a personal API key below.');
  }

  const redirectUri = chrome.identity.getRedirectURL(); // https://<id>.chromiumapp.org/
  const verifier = randomToken();
  const challenge = base64url(await sha256(verifier));
  const state = randomToken();

  const authUrl = new URL(OAUTH.authUrl);
  authUrl.searchParams.set('client_id', OAUTH.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', OAUTH.scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  let redirect;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  } catch (e) {
    throw new Error('Linear sign-in was cancelled or blocked.');
  }
  if (!redirect) throw new Error('Linear sign-in did not complete.');

  const returned = new URL(redirect);
  const err = returned.searchParams.get('error');
  if (err) throw new Error(`Linear authorization failed: ${returned.searchParams.get('error_description') || err}`);
  if (returned.searchParams.get('state') !== state) throw new Error('Security check failed (state mismatch). Please try again.');
  const code = returned.searchParams.get('code');
  if (!code) throw new Error('No authorization code returned by Linear.');

  const tokens = await exchangeToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: OAUTH.clientId,
    code_verifier: verifier
  });
  await saveTokens(tokens);
}

async function exchangeToken(params) {
  const body = new URLSearchParams(params).toString();
  let res;
  try {
    res = await fetch(OAUTH.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  } catch {
    throw new Error('Network error contacting Linear. Check your connection and try again.');
  }
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || !json?.access_token) {
    const msg = json?.error_description || json?.error || `${res.status} ${res.statusText}`;
    throw new Error(`Linear token request failed: ${msg}`);
  }
  return json;
}

async function saveTokens(t) {
  // 24h tokens; subtract a 60s safety margin so we refresh slightly early.
  const ttlMs = (t.expires_in ? t.expires_in * 1000 : 24 * 60 * 60 * 1000) - 60_000;
  await chrome.storage.local.set({
    oauth: {
      accessToken: t.access_token,
      refreshToken: t.refresh_token || null,
      expiresAt: Date.now() + Math.max(ttlMs, 0),
      scope: t.scope || OAUTH.scopes
    }
  });
}

async function refreshAccessToken(oauth) {
  if (!oauth.refreshToken) {
    await chrome.storage.local.remove('oauth');
    throw new Error('Linear session expired. Please reconnect in Settings.');
  }
  let tokens;
  try {
    // Public PKCE client: refresh with just the client_id, no secret.
    tokens = await exchangeToken({
      grant_type: 'refresh_token',
      refresh_token: oauth.refreshToken,
      client_id: OAUTH.clientId
    });
  } catch (e) {
    await chrome.storage.local.remove('oauth');
    throw new Error('Could not refresh your Linear session. Please reconnect in Settings.');
  }
  // Linear may not rotate the refresh token — keep the old one if absent.
  if (!tokens.refresh_token) tokens.refresh_token = oauth.refreshToken;
  await saveTokens(tokens);
  return tokens.access_token;
}

async function logout() {
  const { oauth } = await chrome.storage.local.get('oauth');
  if (oauth?.accessToken) {
    try {
      await fetch(OAUTH.revokeUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${oauth.accessToken}` }
      });
    } catch { /* best-effort revoke */ }
  }
  await chrome.storage.local.remove('oauth');
}

function buildDescription(assetUrl, diagnostics) {
  const lines = [`![screenshot](${assetUrl})`];

  if (diagnostics) {
    const rows = [
      ['URL', diagnostics.url],
      ['Browser', diagnostics.browser],
      ['OS', diagnostics.os],
      ['Viewport', diagnostics.viewport],
      ['Screen', diagnostics.screen],
      ['Device pixel ratio', diagnostics.dpr],
      ['Language', diagnostics.language],
      ['Online', typeof diagnostics.online === 'boolean' ? (diagnostics.online ? 'Yes' : 'No') : undefined],
      ['Captured', diagnostics.capturedAt]
    ].filter(([, v]) => v !== undefined && v !== null && v !== '');

    if (rows.length) {
      lines.push('', '### Environment', '', '| Field | Value |', '| --- | --- |');
      for (const [field, value] of rows) {
        lines.push(`| ${field} | ${cell(value)} |`);
      }
    }
  }

  return lines.join('\n');
}

// Escape a value for safe inclusion in a Markdown table cell
function cell(value) {
  return String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

async function cropScreenshot(dataUrl, { x, y, width, height, devicePixelRatio = 1 }) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    bitmap,
    Math.round(x * devicePixelRatio),
    Math.round(y * devicePixelRatio),
    Math.round(width * devicePixelRatio),
    Math.round(height * devicePixelRatio),
    0, 0, width, height
  );

  const resultBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(resultBlob);
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

async function linearRequest(auth, query, variables = {}) {
  let res;
  try {
    res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth
      },
      body: JSON.stringify({ query, variables })
    });
  } catch {
    throw new Error('Network error contacting Linear. Check your connection and try again.');
  }

  // Parse body even on error responses — Linear puts useful messages in `errors`
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON response */ }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || `${res.status} ${res.statusText}`;
    throw new Error(`Linear API error: ${msg}`);
  }

  // GraphQL returns 200 with an `errors` array on logical failures (bad key, validation, etc.)
  if (json?.errors?.length) {
    throw new Error(json.errors[0].message);
  }

  return json;
}

async function uploadImage(dataUrl, auth) {
  const base64 = dataUrl.slice('data:image/png;base64,'.length);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  const filename = `screenshot-${Date.now()}.png`;

  const { data } = await linearRequest(auth, `
    mutation Upload($filename: String!, $contentType: String!, $size: Int!) {
      fileUpload(filename: $filename, contentType: $contentType, size: $size) {
        uploadFile { uploadUrl assetUrl headers { key value } }
      }
    }
  `, { filename, contentType: 'image/png', size: blob.size });

  const uploadFile = data?.fileUpload?.uploadFile;
  if (!uploadFile?.uploadUrl) throw new Error('Linear did not return an upload URL.');

  const { uploadUrl, assetUrl, headers } = uploadFile;
  const extraHeaders = {};
  (headers || []).forEach(({ key, value }) => { extraHeaders[key] = value; });

  let uploadHost = uploadUrl;
  try { uploadHost = new URL(uploadUrl).host; } catch { /* keep full URL */ }

  let uploadRes;
  try {
    uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/png', ...extraHeaders }
    });
  } catch {
    throw new Error(`Could not upload to ${uploadHost}. The extension may lack host permission for it — add it to manifest "host_permissions" and reload at chrome://extensions.`);
  }
  if (!uploadRes.ok) throw new Error(`Screenshot upload failed (${uploadRes.status}) at ${uploadHost}`);

  return assetUrl;
}
