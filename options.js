const apiKeyInput  = document.getElementById('api-key');
const saveBtn      = document.getElementById('save-btn');
const clearKeyBtn  = document.getElementById('clear-key-btn');
const statusEl     = document.getElementById('status');
const teamListEl   = document.getElementById('team-list');
const toggleBtn    = document.getElementById('toggle-visibility');

const connectBtn    = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const connDot       = document.getElementById('conn-dot');
const connText      = document.getElementById('conn-text');
const oauthStatus   = document.getElementById('oauth-status');
const oauthHint     = document.getElementById('oauth-hint');
const advanced      = document.getElementById('advanced');

// ── Redirect URL readout (for OAuth app setup) ───────────────────────────────
const redirectInput = document.getElementById('redirect-url');
const copyRedirect   = document.getElementById('copy-redirect');
try {
  redirectInput.value = chrome.identity.getRedirectURL();
} catch {
  redirectInput.value = 'https://<extension-id>.chromiumapp.org/';
}
copyRedirect.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(redirectInput.value);
    copyRedirect.textContent = 'Copied';
    setTimeout(() => (copyRedirect.textContent = 'Copy'), 1200);
  } catch {
    redirectInput.select();
  }
});

// ── Initial render ───────────────────────────────────────────────────────────
refreshAuthUI();

async function refreshAuthUI() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' });
  const { connected, method, oauthConfigured } = state || {};

  // Connection summary
  connDot.classList.toggle('on', !!connected);
  if (connected && method === 'oauth') {
    connText.textContent = 'Connected with Linear (OAuth)';
  } else if (connected && method === 'apikey') {
    connText.textContent = 'Connected with a personal API key';
  } else {
    connText.textContent = 'Not connected';
  }

  // OAuth button vs disconnect
  if (oauthConfigured) {
    oauthHint.textContent = '';
    if (method === 'oauth') {
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = '';
    } else {
      connectBtn.style.display = '';
      connectBtn.disabled = false;
      disconnectBtn.style.display = 'none';
    }
  } else {
    // OAuth not configured in this build → guide the user to the API key
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'none';
    oauthHint.textContent = 'One-click connect isn’t configured in this build. Use a personal API key below.';
    advanced.open = true;
  }

  // Load the saved API key into the fallback field
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (apiKey) {
    apiKeyInput.value = apiKey;
    clearKeyBtn.style.display = '';
    if (!oauthConfigured) advanced.open = true;
  } else {
    clearKeyBtn.style.display = 'none';
  }

  // Load teams using whichever credential is active
  if (connected) loadTeams();
  else teamListEl.innerHTML = '<span style="font-size:12px;color:#9ca3af">Connect your Linear account to see your teams.</span>';
}

// ── OAuth: connect ─────────────────────────────────────────────────────────
connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  setOAuthStatus('Opening Linear…');
  try {
    const res = await chrome.runtime.sendMessage({ type: 'START_OAUTH' });
    if (res?.error) throw new Error(res.error);
    setOAuthStatus('✓ Connected', 'success');
    await refreshAuthUI();
  } catch (err) {
    setOAuthStatus(err.message, 'error');
    connectBtn.disabled = false;
  }
});

// ── OAuth: disconnect ────────────────────────────────────────────────────────
disconnectBtn.addEventListener('click', async () => {
  disconnectBtn.disabled = true;
  setOAuthStatus('Disconnecting…');
  try {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    setOAuthStatus('');
  } finally {
    disconnectBtn.disabled = false;
    await refreshAuthUI();
  }
});

// ── API key: visibility toggle ───────────────────────────────────────────────
toggleBtn.addEventListener('click', () => {
  const isHidden = apiKeyInput.type === 'password';
  apiKeyInput.type = isHidden ? 'text' : 'password';
  toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
});

// ── API key: save & verify ───────────────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    setStatus('Please enter an API key.', 'error');
    return;
  }

  saveBtn.disabled = true;
  setStatus('Verifying…');

  try {
    const teams = await verifyKey(key);
    await chrome.storage.local.set({ apiKey: key });
    setStatus(`✓ Connected — ${teams.length} team${teams.length !== 1 ? 's' : ''} found`, 'success');
    await refreshAuthUI();
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

// ── API key: remove ──────────────────────────────────────────────────────────
clearKeyBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove('apiKey');
  apiKeyInput.value = '';
  setStatus('API key removed.');
  await refreshAuthUI();
});

// ── Helpers ────────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

function setOAuthStatus(msg, type = '') {
  oauthStatus.textContent = msg;
  oauthStatus.className = 'status' + (type ? ' ' + type : '');
}

// Verifies a not-yet-saved API key via the background worker.
async function verifyKey(apiKey) {
  const result = await chrome.runtime.sendMessage({ type: 'VERIFY_API_KEY', apiKey });
  if (result.error) throw new Error(result.error);
  const teams = result.data?.data?.teams?.nodes;
  if (!Array.isArray(teams)) throw new Error('Unexpected response from Linear — check your API key');
  return teams;
}

// Loads teams using the currently active credential (OAuth or API key).
async function loadTeams() {
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'LINEAR_API',
      query: '{ teams { nodes { id name key } } }'
    });
    if (result.error) throw new Error(result.error);
    renderTeams(result.data?.data?.teams?.nodes || []);
  } catch {
    // non-fatal on the settings screen
  }
}

function renderTeams(teams) {
  if (!teams.length) {
    teamListEl.innerHTML = '<span style="font-size:12px;color:#9ca3af">No teams found.</span>';
    return;
  }
  teamListEl.innerHTML = teams.map(t => `
    <div class="team-item">
      <span class="team-key">${esc(t.key)}</span>
      <span>${esc(t.name)}</span>
    </div>
  `).join('');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
