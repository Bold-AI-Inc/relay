let loadedTeams = [];

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
      const projNodes = projRes.data?.data?.projects?.nodes || [];
      const byTeam = {};
      for (const p of projNodes) {
        if (p.state === 'completed' || p.state === 'canceled') continue;
        for (const tm of (p.teams?.nodes || [])) {
          (byTeam[tm.id] = byTeam[tm.id] || []).push({ id: p.id, name: p.name });
        }
      }
      loadedTeams.forEach(t => { t.projects = byTeam[t.id] || []; });
    } catch {
      /* projects are optional — ignore */
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

document.getElementById('capture-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('capture-btn');
  btn.disabled = true;
  btn.innerHTML = 'Capturing…';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Capture now while the user-gesture activeTab grant is still valid
    const dataUrl = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (url) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(url);
      });
    });

    // Stash screenshot in the background worker's memory
    await chrome.runtime.sendMessage({ type: 'STORE_SCREENSHOT', dataUrl });

    // Inject content script (safe to call multiple times — content script guards itself)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    // Brief pause to let the script settle
    await new Promise(r => setTimeout(r, 80));

    // Kick off the selection UI
    chrome.tabs.sendMessage(tab.id, {
      type: 'START_CAPTURE',
      teams: loadedTeams,
      pageTitle: tab.title,
      pageUrl: tab.url
    });

    window.close();
  } catch (err) {
    setStatus(err.message, true);
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9V6a2 2 0 0 1 2-2h2"/><path d="M15 4h2a2 2 0 0 1 2 2v3"/>
        <path d="M21 15v2a2 2 0 0 1-2 2h-2"/><path d="M9 20H7a2 2 0 0 1-2-2v-2"/>
      </svg>
      Capture Area`;
  }
});

init();
