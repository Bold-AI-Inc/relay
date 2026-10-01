let loadedTeams = [];
let loadedUsers = [];

async function init() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' });

  if (!state?.connected) {
    document.getElementById('no-key-view').style.display = 'block';
    document.getElementById('main-view').style.display = 'none';
    return;
  }

  setStatus('Loading teams…');

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'LINEAR_API',
      query: `query {
        teams {
          nodes {
            id name key
            states { nodes { id type } }
          }
        }
      }`
    });

    if (result.error) throw new Error(result.error);

    const nodes = result.data?.data?.teams?.nodes || [];
    // Resolve each team's triage state once, so the form can route silently
    loadedTeams = nodes.map(t => ({
      id: t.id,
      name: t.name,
      key: t.key,
      triageStateId: t.states?.nodes?.find(s => s.type === 'triage')?.id || null,
      projects: []
    }));

    // Fetch projects separately so a failure here never blocks team loading.
    // Projects can span multiple teams, so group them by team via Project.teams.
    try {
      const projRes = await chrome.runtime.sendMessage({
        type: 'LINEAR_API',
        query: `query {
          projects(first: 250) {
            nodes { id name state teams { nodes { id } } }
          }
        }`
      });
      if (projRes?.error) {
        console.warn('[Relay] projects query failed:', projRes.error);
      } else {
        const projNodes = projRes.data?.data?.projects?.nodes || [];
        console.debug('[Relay] fetched', projNodes.length, 'projects');
        const byTeam = {};
        for (const p of projNodes) {
          if (p.state === 'completed' || p.state === 'canceled') continue;
          for (const tm of (p.teams?.nodes || [])) {
            (byTeam[tm.id] = byTeam[tm.id] || []).push({ id: p.id, name: p.name });
          }
        }
        loadedTeams.forEach(t => { t.projects = byTeam[t.id] || []; });
      }
    } catch (e) {
      console.warn('[Relay] projects query threw:', e);
    }

    // Fetch workspace users for the Assignee dropdown. Same defensive pattern
    // as projects — a failure here must not block team loading.
    try {
      const userRes = await chrome.runtime.sendMessage({
        type: 'LINEAR_API',
        query: `query {
          users(first: 250, includeDisabled: false) {
            nodes { id name displayName }
          }
        }`
      });
      if (userRes?.error) {
        console.warn('[Relay] users query failed:', userRes.error);
      } else {
        const userNodes = userRes.data?.data?.users?.nodes || [];
        loadedUsers = userNodes
          // Preserve both: `name` is the full name shown in the dropdown,
          // `handle` is Linear's unique displayName shown on hover (e.g. @paul.i).
          .map(u => ({
            id: u.id,
            name: u.name || u.displayName,
            handle: u.displayName || u.name
          }))
          .filter(u => u.name)
          .sort((a, b) => a.name.localeCompare(b.name));
        console.debug('[Relay] fetched', loadedUsers.length, 'users');
      }
    } catch (e) {
      console.warn('[Relay] users query threw:', e);
    }

    setStatus(loadedTeams.length ? '' : 'No teams found');
  } catch (err) {
    setStatus('Could not load teams', true);
  }
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status' + (isError ? ' error' : '');
}

document.getElementById('open-settings')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('settings-link')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Shared capture flow used by both buttons. `mode` is either 'area' (drag-select
// overlay) or 'full' (send the visible tab straight to the form).
async function startCapture(mode) {
  const buttons = document.querySelectorAll('.capture-btn');
  buttons.forEach(b => (b.disabled = true));
  const clicked = mode === 'full' ? document.getElementById('capture-full-btn') : document.getElementById('capture-btn');
  const originalHTML = clicked.innerHTML;
  clicked.innerHTML = 'Capturing…';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Capture now while the user-gesture activeTab grant is still valid.
    const dataUrl = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (url) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(url);
      });
    });

    // Stash in session storage so the SW can crop / upload it later.
    await chrome.runtime.sendMessage({ type: 'STORE_SCREENSHOT', dataUrl });

    // Inject content script (it guards itself against double-injection).
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    // Brief pause to let the content script's onMessage listener register.
    await new Promise(r => setTimeout(r, 80));

    chrome.tabs.sendMessage(tab.id, {
      type: 'START_CAPTURE',
      mode,
      teams: loadedTeams,
      users: loadedUsers,
      pageTitle: tab.title,
      pageUrl: tab.url
    });

    window.close();
  } catch (err) {
    setStatus(err.message, true);
    buttons.forEach(b => (b.disabled = false));
    clicked.innerHTML = originalHTML;
  }
}

document.getElementById('capture-btn')?.addEventListener('click', () => startCapture('area'));
document.getElementById('capture-full-btn')?.addEventListener('click', () => startCapture('full'));

init();
