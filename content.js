// Guard against double-injection
if (window.__linearScreenshotLoaded) {
  // Re-use existing listener; nothing more to do
} else {
  window.__linearScreenshotLoaded = true;

  // ─── State ────────────────────────────────────────────────────────────────
  let host = null;       // shadow-DOM host element
  let shadow = null;     // shadow root
  let isSelecting = false;
  let startX = 0, startY = 0;
  let teams = [];
  let pageTitle = '';
  let pageUrl = '';
  let croppedDataUrl = null;
  let selectedIssueId = null;
  let searchDebounceTimer = null;
  let diagnostics = null;
  let captureMode = 'area';   // 'area' (drag-select) or 'full' (visible tab)

  // ─── Entry point ─────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'START_CAPTURE') {
      teams = msg.teams || [];
      pageTitle = msg.pageTitle || document.title;
      pageUrl = msg.pageUrl || location.href;
      captureMode = msg.mode === 'full' ? 'full' : 'area';
      destroyAll();
      if (captureMode === 'full') {
        startFullCapture();
      } else {
        mountSelectionOverlay();
      }
    }
  });

  // ─── "Capture Whole Page" path ────────────────────────────────────────────
  // Skips the drag-select overlay entirely. The visible tab is already in
  // session storage; we just pull it out for the preview and open the form.
  async function startFullCapture() {
    diagnostics = await collectDiagnostics();
    const res = await chrome.runtime.sendMessage({ type: 'GET_PENDING_SCREENSHOT' });
    if (res?.error || !res?.dataUrl) {
      // Nothing to do without an image. Stay silent — the toolbar UI already
      // reported any capture error.
      return;
    }
    croppedDataUrl = res.dataUrl;
    mountHost();
    mountForm();
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  function destroyAll() {
    if (host) { host.remove(); host = null; shadow = null; }
    isSelecting = false;
    croppedDataUrl = null;
    selectedIssueId = null;
    diagnostics = null;
  }

  // ─── Diagnostics ───────────────────────────────────────────────────────────
  // Collected in the page context at the moment of capture, so viewport/screen
  // values reflect exactly what the user was looking at.
  async function collectDiagnostics() {
    const nav = navigator;
    let browser = '';
    let os = '';

    const uaData = nav.userAgentData; // Chromium, secure contexts only
    if (uaData) {
      try {
        const high = await uaData.getHighEntropyValues(['platformVersion', 'fullVersionList']);
        const list = high.fullVersionList?.length ? high.fullVersionList : (uaData.brands || []);
        const real = list.find(b => !/not.?a.?brand/i.test(b.brand) && !/^chromium$/i.test(b.brand))
                  || list.find(b => !/not.?a.?brand/i.test(b.brand));
        if (real) browser = `${real.brand} ${real.version}`;
        os = [uaData.platform, high.platformVersion].filter(Boolean).join(' ').trim();
      } catch {
        const real = (uaData.brands || []).find(b => !/not.?a.?brand/i.test(b.brand));
        if (real) browser = `${real.brand} ${real.version}`;
        os = uaData.platform || '';
      }
    }

    if (!browser) browser = nav.userAgent;          // fallback: raw UA string
    if (!os) os = nav.platform || 'Unknown';        // deprecated but works as fallback

    return {
      url: location.href,
      browser,
      os,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      screen: `${screen.width} × ${screen.height}`,
      dpr: window.devicePixelRatio,
      language: nav.language || (nav.languages && nav.languages[0]) || '',
      online: nav.onLine,
      capturedAt: new Date().toString()
    };
  }

  // ─── Shadow DOM helpers ───────────────────────────────────────────────────
  function mountHost() {
    host = document.createElement('div');
    host.id = '__linear_ss_host__';
    // Sit above everything; no layout impact
    Object.assign(host.style, {
      position: 'fixed', top: '0', left: '0',
      width: '0', height: '0',
      zIndex: '2147483647', pointerEvents: 'none'
    });
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    return shadow;
  }

  // ─── PHASE 1: Selection overlay ───────────────────────────────────────────
  function mountSelectionOverlay() {
    const sh = mountHost();
    host.style.pointerEvents = 'auto';

    sh.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .overlay {
          position: fixed; inset: 0;
          cursor: crosshair;
          z-index: 1;
        }
        .dim {
          position: absolute; background: rgba(0,0,0,0.38);
        }
        .dim-top    { top: 0; left: 0; right: 0; }
        .dim-bottom { bottom: 0; left: 0; right: 0; }
        .dim-left   { }
        .dim-right  { }
        .selection {
          position: absolute;
          border: 2px solid #5B5BD6;
          background: transparent;
          pointer-events: none;
        }
        .corner {
          position: absolute;
          width: 8px; height: 8px;
          background: #5B5BD6;
          border-radius: 2px;
        }
        .corner-tl { top: -4px; left: -4px; }
        .corner-tr { top: -4px; right: -4px; }
        .corner-bl { bottom: -4px; left: -4px; }
        .corner-br { bottom: -4px; right: -4px; }
        .size-label {
          position: absolute;
          bottom: calc(100% + 6px); left: 0;
          background: rgba(0,0,0,0.75);
          color: #fff;
          font: 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 3px 6px; border-radius: 4px;
          white-space: nowrap; pointer-events: none;
        }
        .hint {
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.78);
          color: #fff;
          font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 10px 18px; border-radius: 8px;
          text-align: center; pointer-events: none;
          user-select: none;
        }
        .hint kbd {
          display: inline-block;
          background: rgba(255,255,255,0.18);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 12px;
        }
      </style>
      <div class="overlay" id="overlay">
        <div class="dim dim-top" id="dt" style="height:0"></div>
        <div class="dim dim-bottom" id="db" style="height:0"></div>
        <div class="dim dim-left" id="dl" style="position:absolute;background:rgba(0,0,0,0.38)"></div>
        <div class="dim dim-right" id="dr" style="position:absolute;background:rgba(0,0,0,0.38)"></div>
        <div class="selection" id="sel" style="display:none">
          <div class="corner corner-tl"></div>
          <div class="corner corner-tr"></div>
          <div class="corner corner-bl"></div>
          <div class="corner corner-br"></div>
          <div class="size-label" id="size-label"></div>
        </div>
        <div class="hint" id="hint">
          Click and drag to select an area &nbsp;·&nbsp; <kbd>ESC</kbd> to cancel
        </div>
      </div>
    `;

    const overlay = sh.getElementById('overlay');
    const sel     = sh.getElementById('sel');
    const hint    = sh.getElementById('hint');
    const dt = sh.getElementById('dt');
    const db = sh.getElementById('db');
    const dl = sh.getElementById('dl');
    const dr = sh.getElementById('dr');
    const sizeLabel = sh.getElementById('size-label');

    function updateDims(x, y, w, h) {
      const vw = window.innerWidth, vh = window.innerHeight;
      dt.style.cssText = `position:absolute;background:rgba(0,0,0,0.38);top:0;left:0;right:0;height:${y}px`;
      db.style.cssText = `position:absolute;background:rgba(0,0,0,0.38);bottom:0;left:0;right:0;height:${vh - y - h}px`;
      dl.style.cssText = `position:absolute;background:rgba(0,0,0,0.38);top:${y}px;left:0;width:${x}px;height:${h}px`;
      dr.style.cssText = `position:absolute;background:rgba(0,0,0,0.38);top:${y}px;right:0;width:${vw - x - w}px;height:${h}px`;
    }

    overlay.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isSelecting = true;
      startX = e.clientX; startY = e.clientY;
      hint.style.display = 'none';
      sel.style.display = 'block';
      sel.style.cssText += ';left:' + startX + 'px;top:' + startY + 'px;width:0;height:0;display:block';
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!isSelecting) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      sel.style.left = x + 'px';
      sel.style.top  = y + 'px';
      sel.style.width  = w + 'px';
      sel.style.height = h + 'px';
      sizeLabel.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      updateDims(x, y, w, h);
    });

    overlay.addEventListener('mouseup', async (e) => {
      if (!isSelecting) return;
      isSelecting = false;

      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);

      if (w < 10 || h < 10) { destroyAll(); return; }

      // Capture environment now, while the viewport matches the screenshot
      diagnostics = await collectDiagnostics();

      // Show spinner while cropping
      sel.innerHTML = '';
      overlay.style.cursor = 'wait';

      const result = await chrome.runtime.sendMessage({
        type: 'CROP_SCREENSHOT',
        selection: { x, y, width: w, height: h, devicePixelRatio: window.devicePixelRatio }
      });

      if (result?.dataUrl) {
        croppedDataUrl = result.dataUrl;
        mountForm();
      } else {
        destroyAll();
      }
    });

    window.addEventListener('keydown', handleEsc);
  }

  function handleEsc(e) {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', handleEsc);
      destroyAll();
    }
  }

  // ─── PHASE 2: Form modal ──────────────────────────────────────────────────
  function mountForm() {
    // Reuse existing host / shadow
    host.style.pointerEvents = 'auto';

    const teamOptions = teams.map(t =>
      `<option value="${esc(t.id)}">${esc(t.name)}</option>`
    ).join('');

    shadow.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :host { all: initial; }

        .backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 1;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px; color: #111827;
        }

        .modal {
          background: #fff;
          border-radius: 14px;
          width: min(760px, 95vw);
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 64px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06);
          overflow: hidden;
        }

        /* Header */
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
          flex-shrink: 0;
        }
        .modal-title {
          font-size: 15px; font-weight: 600; color: #111827;
          display: flex; align-items: center; gap: 8px;
        }
        .modal-title .logo {
          width: 22px; height: 22px; background: #5B5BD6;
          border-radius: 6px; display: flex; align-items: center; justify-content: center;
        }
        .close-btn {
          width: 28px; height: 28px; border-radius: 6px;
          border: none; background: transparent; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: #6b7280; font-size: 16px;
          transition: background 0.12s;
        }
        .close-btn:hover { background: #f3f4f6; color: #111; }

        /* Body */
        .modal-body {
          display: flex; flex: 1; overflow: hidden;
          min-height: 0;
        }

        /* Preview pane */
        .preview-pane {
          width: 220px; min-width: 180px; flex-shrink: 0;
          background: #f9fafb;
          border-right: 1px solid #f0f0f0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 16px; gap: 10px;
          overflow: hidden;
        }
        .preview-img {
          max-width: 100%; max-height: 260px;
          border-radius: 6px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.14);
          object-fit: contain; cursor: zoom-in;
        }
        .preview-label {
          font-size: 11px; color: #9ca3af; text-align: center;
        }

        /* Form pane */
        .form-pane {
          flex: 1; overflow-y: auto;
          padding: 20px;
          display: flex; flex-direction: column; gap: 16px;
        }

        /* Tabs */
        .tabs {
          display: flex; gap: 0;
          border-bottom: 2px solid #e5e7eb;
          flex-shrink: 0;
        }
        .tab {
          padding: 7px 16px;
          font-size: 13px; font-weight: 500;
          border: none; background: transparent;
          cursor: pointer; color: #6b7280;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: color 0.12s;
        }
        .tab:hover { color: #111827; }
        .tab.active { color: #5B5BD6; border-bottom-color: #5B5BD6; }

        /* Fields */
        .field { display: flex; flex-direction: column; gap: 5px; }
        .label {
          font-size: 12px; font-weight: 500; color: #374151;
        }
        input[type="text"], textarea, select {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          font-size: 13px; color: #111827;
          background: #fff;
          outline: none;
          font-family: inherit;
          transition: border-color 0.12s, box-shadow 0.12s;
        }
        input[type="text"]:focus, textarea:focus, select:focus {
          border-color: #5B5BD6;
          box-shadow: 0 0 0 3px rgba(91,91,214,0.12);
        }
        textarea { resize: vertical; min-height: 72px; }
        select { cursor: pointer; }

        .row { display: flex; gap: 10px; }
        .row .field { flex: 1; }

        /* Search results */
        .search-results {
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          overflow: hidden;
          max-height: 200px;
          overflow-y: auto;
        }
        .result-item {
          padding: 9px 12px;
          cursor: pointer;
          display: flex; align-items: center; gap: 8px;
          transition: background 0.1s;
          border-bottom: 1px solid #f3f4f6;
        }
        .result-item:last-child { border-bottom: none; }
        .result-item:hover, .result-item.selected { background: #f0f0ff; }
        .result-id {
          font-size: 11px; color: #6b7280; font-weight: 500;
          white-space: nowrap; flex-shrink: 0;
        }
        .result-title {
          font-size: 13px; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .no-results {
          padding: 12px; text-align: center;
          font-size: 12px; color: #9ca3af;
        }

        /* Refresh-data link next to the Project label */
        .label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          color: #5B5BD6;
          font-size: 11px;
          font-weight: 500;
          padding: 0;
          font-family: inherit;
        }
        .refresh-btn:hover { text-decoration: underline; }
        .refresh-btn:disabled { opacity: 0.6; cursor: wait; text-decoration: none; }
        .refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }

        /* "Submit another" toggle, applies to both tabs */
        .form-meta {
          border-top: 1px solid #f0f0f0;
          padding-top: 12px;
          margin-top: 4px;
        }
        .meta-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
          cursor: pointer;
          user-select: none;
        }
        .meta-checkbox input {
          width: 14px; height: 14px;
          cursor: pointer;
          accent-color: #5B5BD6;
        }

        /* Footer */
        .modal-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid #f0f0f0;
          flex-shrink: 0;
          gap: 10px;
        }
        .footer-status {
          font-size: 12px; color: #6b7280; flex: 1;
        }
        .footer-status.error { color: #dc2626; }
        .footer-status.success { color: #16a34a; }
        .btn {
          padding: 8px 16px; border-radius: 8px;
          font-size: 13px; font-weight: 500;
          border: none; cursor: pointer;
          transition: background 0.12s, opacity 0.12s;
        }
        .btn-secondary {
          background: #f3f4f6; color: #374151;
        }
        .btn-secondary:hover { background: #e5e7eb; }
        .btn-primary {
          background: #5B5BD6; color: #fff;
          min-width: 130px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn-primary:hover:not(:disabled) { background: #4a4ac4; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Spinner */
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        /* Success */
        .success-view {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; padding: 30px; text-align: center;
        }
        .success-icon {
          width: 48px; height: 48px; background: #dcfce7;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        .success-title { font-size: 15px; font-weight: 600; }
        .success-link {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 13px; color: #5B5BD6; text-decoration: none;
        }
        .success-link:hover { text-decoration: underline; }

        /* Lightbox */
        .lightbox {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center;
          z-index: 10;
          cursor: zoom-out;
        }
        .lightbox img {
          max-width: 95vw; max-height: 95vh;
          border-radius: 6px;
          object-fit: contain;
        }
      </style>

      <div class="backdrop" id="backdrop">
        <div class="modal" id="modal">
          <div class="modal-header">
            <div class="modal-title">
              <div class="logo">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke="white" stroke-width="1.6"/>
                  <circle cx="8" cy="8" r="2.2" stroke="white" stroke-width="1.6"/>
                </svg>
              </div>
              Send to Linear
            </div>
            <button class="close-btn" id="close-btn">✕</button>
          </div>

          <div class="modal-body">
            <!-- Screenshot preview -->
            <div class="preview-pane">
              <img class="preview-img" id="preview-img" src="" alt="Screenshot preview" title="Click to enlarge" />
              <span class="preview-label">Click to enlarge</span>
            </div>

            <!-- Form -->
            <div class="form-pane" id="form-pane">
              <div class="tabs">
                <button class="tab active" id="tab-create">Create Issue</button>
                <button class="tab" id="tab-attach">Attach to Existing</button>
              </div>

              <!-- Create Issue form -->
              <div id="panel-create">
                <div style="display:flex;flex-direction:column;gap:14px;">
                  <div class="field">
                    <label class="label">Title</label>
                    <input type="text" id="issue-title" placeholder="Issue title" />
                  </div>
                  <div class="field">
                    <label class="label">Description <span style="color:#9ca3af;font-weight:400">(optional)</span></label>
                    <textarea id="issue-desc" placeholder="Add more context…"></textarea>
                  </div>
                  <div class="row">
                    <div class="field">
                      <label class="label">Team</label>
                      <select id="issue-team">
                        ${teamOptions || '<option value="">No teams found</option>'}
                      </select>
                    </div>
                    <div class="field">
                      <label class="label">Priority</label>
                      <select id="issue-priority">
                        <option value="0">No priority</option>
                        <option value="1">Urgent</option>
                        <option value="2">High</option>
                        <option value="3" selected>Medium</option>
                        <option value="4">Low</option>
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <div class="label-row">
                      <label class="label">Project <span style="color:#9ca3af;font-weight:400">(optional)</span></label>
                      <button type="button" class="refresh-btn" id="refresh-data" title="Refresh teams and projects from Linear">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="23 4 23 10 17 10"/>
                          <path d="M20.49 9A9 9 0 1 0 5.64 18.36L1 14"/>
                        </svg>
                        Refresh
                      </button>
                    </div>
                    <select id="issue-project">
                      <option value="">No project</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Attach to existing form -->
              <div id="panel-attach" style="display:none">
                <div style="display:flex;flex-direction:column;gap:12px;">
                  <div class="field">
                    <label class="label">Search issues</label>
                    <input type="text" id="issue-search" placeholder="Type to search…" autocomplete="off" />
                  </div>
                  <div class="search-results" id="search-results" style="display:none"></div>
                  <div id="selected-issue-label" style="font-size:12px;color:#5B5BD6;display:none"></div>
                </div>
              </div>

              <!-- Submit-another toggle (applies to both tabs) -->
              <div class="form-meta">
                <label class="meta-checkbox" title="After sending, capture another region without leaving the page">
                  <input type="checkbox" id="submit-another" />
                  <span>Submit another after this one</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <span class="footer-status" id="footer-status"></span>
            <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="submit-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Send to Linear
            </button>
          </div>
        </div>
      </div>
    `;

    // Set preview image
    shadow.getElementById('preview-img').src = croppedDataUrl;

    // Pre-fill title with page title
    shadow.getElementById('issue-title').value = pageTitle;

    // ── Project picker (scoped to the selected team) ─────────────────────────
    const teamSelect = shadow.getElementById('issue-team');
    const projectSelect = shadow.getElementById('issue-project');

    function populateProjects(teamId) {
      const projects = teams.find(t => t.id === teamId)?.projects || [];
      projectSelect.innerHTML =
        '<option value="">No project</option>' +
        projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    }

    populateProjects(teamSelect.value);
    teamSelect.addEventListener('change', () => populateProjects(teamSelect.value));

    // ── Refresh teams + projects on demand ────────────────────────────────
    // The popup loads teams/projects at toolbar-click time. If the user added
    // a team or project in Linear AFTER opening the popup (or if the projects
    // query silently failed), this lets them pull fresh data without closing
    // the modal.
    async function refreshTeamsProjects() {
      const btn = shadow.getElementById('refresh-data');
      btn.disabled = true;
      btn.classList.add('spinning');
      setFooterStatus('Refreshing…');

      try {
        const tres = await chrome.runtime.sendMessage({
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
        if (tres?.error) throw new Error(tres.error);
        const tnodes = tres.data?.data?.teams?.nodes || [];
        const fresh = tnodes.map(t => ({
          id: t.id, name: t.name, key: t.key,
          triageStateId: t.states?.nodes?.find(s => s.type === 'triage')?.id || null,
          projects: []
        }));

        // Projects: don't fail the whole refresh if this errors — bubble the
        // reason up to the footer so the user can see why.
        let projectError = null;
        try {
          const pres = await chrome.runtime.sendMessage({
            type: 'LINEAR_API',
            query: `query {
              projects(first: 250) {
                nodes { id name state teams { nodes { id } } }
              }
            }`
          });
          if (pres?.error) {
            projectError = pres.error;
          } else {
            const projNodes = pres.data?.data?.projects?.nodes || [];
            const byTeam = {};
            for (const p of projNodes) {
              if (p.state === 'completed' || p.state === 'canceled') continue;
              for (const tm of (p.teams?.nodes || [])) {
                (byTeam[tm.id] = byTeam[tm.id] || []).push({ id: p.id, name: p.name });
              }
            }
            fresh.forEach(t => { t.projects = byTeam[t.id] || []; });
          }
        } catch (e) {
          projectError = e.message;
        }

        teams = fresh;

        // Re-render the Team dropdown, preserving the current selection if it
        // still exists; then repopulate the Project dropdown for that team.
        const prevTeamId = teamSelect.value;
        teamSelect.innerHTML = teams.length
          ? teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')
          : '<option value="">No teams found</option>';
        if (teams.find(t => t.id === prevTeamId)) teamSelect.value = prevTeamId;
        populateProjects(teamSelect.value);

        const projCount = teams.reduce((n, t) => n + (t.projects?.length || 0), 0);
        if (projectError) {
          setFooterStatus(`Teams refreshed. Projects failed: ${projectError}`, 'error');
        } else {
          setFooterStatus(
            `Refreshed — ${teams.length} team${teams.length !== 1 ? 's' : ''}, ${projCount} project${projCount !== 1 ? 's' : ''}`,
            'success'
          );
          setTimeout(() => setFooterStatus(''), 2500);
        }
      } catch (err) {
        setFooterStatus(`Refresh failed: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.classList.remove('spinning');
      }
    }

    shadow.getElementById('refresh-data').addEventListener('click', refreshTeamsProjects);

    // ── Tab switching ──────────────────────────────────────────────────────
    let activeTab = 'create';

    shadow.getElementById('tab-create').addEventListener('click', () => switchTab('create'));
    shadow.getElementById('tab-attach').addEventListener('click', () => switchTab('attach'));

    function switchTab(tab) {
      activeTab = tab;
      shadow.getElementById('tab-create').className = 'tab' + (tab === 'create' ? ' active' : '');
      shadow.getElementById('tab-attach').className = 'tab' + (tab === 'attach' ? ' active' : '');
      shadow.getElementById('panel-create').style.display = tab === 'create' ? '' : 'none';
      shadow.getElementById('panel-attach').style.display = tab === 'attach' ? '' : 'none';
      setFooterStatus('');
    }

    // ── Issue search ───────────────────────────────────────────────────────
    shadow.getElementById('issue-search').addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      const q = e.target.value.trim();
      if (!q) {
        shadow.getElementById('search-results').style.display = 'none';
        return;
      }
      searchDebounceTimer = setTimeout(() => searchIssues(q), 350);
    });

    async function searchIssues(query) {
      const resultsEl = shadow.getElementById('search-results');
      resultsEl.style.display = 'block';
      resultsEl.innerHTML = '<div class="no-results">Searching…</div>';

      let result;
      try {
        result = await chrome.runtime.sendMessage({
          type: 'LINEAR_API',
          query: `
            query Search($q: String!) {
              searchIssues(term: $q, first: 8) {
                nodes { id identifier title team { name } }
              }
            }
          `,
          variables: { q: query }
        });
      } catch (err) {
        resultsEl.innerHTML = `<div class="no-results">${esc(err.message)}</div>`;
        return;
      }

      if (result?.error) {
        resultsEl.innerHTML = `<div class="no-results">${esc(result.error)}</div>`;
        return;
      }

      const issues = result.data?.data?.searchIssues?.nodes || [];
      if (!issues.length) {
        resultsEl.innerHTML = '<div class="no-results">No issues found</div>';
        return;
      }

      resultsEl.innerHTML = issues.map(i => `
        <div class="result-item${selectedIssueId === i.id ? ' selected' : ''}"
             data-id="${esc(i.id)}" data-label="${esc(i.identifier + ' · ' + i.title)}">
          <span class="result-id">${esc(i.identifier)}</span>
          <span class="result-title">${esc(i.title)}</span>
        </div>
      `).join('');

      resultsEl.querySelectorAll('.result-item').forEach(el => {
        el.addEventListener('click', () => {
          selectedIssueId = el.dataset.id;
          const label = el.dataset.label;
          resultsEl.style.display = 'none';
          shadow.getElementById('issue-search').value = label;
          shadow.getElementById('selected-issue-label').textContent = '✓ Issue selected';
          shadow.getElementById('selected-issue-label').style.display = 'block';
        });
      });
    }

    // ── Preview lightbox ───────────────────────────────────────────────────
    shadow.getElementById('preview-img').addEventListener('click', () => {
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = `<img src="${croppedDataUrl}" alt="Screenshot" />`;
      lb.addEventListener('click', () => lb.remove());
      shadow.getElementById('backdrop').appendChild(lb);
    });

    // ── Close / Cancel ─────────────────────────────────────────────────────
    shadow.getElementById('close-btn').addEventListener('click', destroyAll);
    shadow.getElementById('cancel-btn').addEventListener('click', destroyAll);
    shadow.getElementById('backdrop').addEventListener('click', (e) => {
      if (e.target === shadow.getElementById('backdrop')) destroyAll();
    });

    // ── Submit ─────────────────────────────────────────────────────────────
    shadow.getElementById('submit-btn').addEventListener('click', () => submitForm(activeTab));

    function setFooterStatus(msg, type = '') {
      const el = shadow.getElementById('footer-status');
      el.textContent = msg;
      el.className = 'footer-status' + (type ? ' ' + type : '');
    }

    function setSubmitLoading(loading) {
      const btn = shadow.getElementById('submit-btn');
      if (loading) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Sending…';
      } else {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send to Linear`;
      }
    }

    async function submitForm(tab) {
      setFooterStatus('');
      setSubmitLoading(true);

      const submitAnother = shadow.getElementById('submit-another')?.checked || false;

      try {
        if (tab === 'create') {
          const title = shadow.getElementById('issue-title').value.trim();
          const teamId = shadow.getElementById('issue-team').value;
          const priority = parseInt(shadow.getElementById('issue-priority').value, 10);
          const extraDescription = shadow.getElementById('issue-desc').value.trim();

          if (!title) { setFooterStatus('Please enter a title.', 'error'); setSubmitLoading(false); return; }
          if (!teamId) { setFooterStatus('Please select a team.', 'error'); setSubmitLoading(false); return; }

          // Route to the team's triage queue automatically when available
          const stateId = teams.find(t => t.id === teamId)?.triageStateId || null;
          const projectId = shadow.getElementById('issue-project').value || null;

          const result = await chrome.runtime.sendMessage({
            type: 'UPLOAD_AND_CREATE_ISSUE',
            teamId, title, priority, extraDescription, diagnostics, stateId, projectId
          });

          if (result.error) throw new Error(result.error);

          const issue = result.data?.data?.issueCreate?.issue;
          const where = stateId ? ' in Triage' : '';
          showSuccess(issue?.url, issue ? `${issue.identifier}: ${issue.title}${where}` : `Issue created${where}`, submitAnother);

        } else {
          if (!selectedIssueId) {
            setFooterStatus('Please select an issue to attach to.', 'error');
            setSubmitLoading(false);
            return;
          }

          const result = await chrome.runtime.sendMessage({
            type: 'UPLOAD_AND_ATTACH',
            issueId: selectedIssueId, diagnostics
          });

          if (result.error) throw new Error(result.error);

          showSuccess(null, 'Screenshot attached as a comment', submitAnother);
        }
      } catch (err) {
        setFooterStatus(err.message, 'error');
        setSubmitLoading(false);
      }
    }

    function showSuccess(url, label, offerAnother = false) {
      const formPane = shadow.getElementById('form-pane');
      formPane.innerHTML = `
        <div class="success-view">
          <div class="success-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="success-title">Sent to Linear!</div>
          <div style="font-size:13px;color:#6b7280">${esc(label)}</div>
          ${url ? `<a class="success-link" href="${esc(url)}" target="_blank" rel="noopener">
            Open in Linear
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>` : ''}
        </div>
      `;
      shadow.getElementById('footer-status').textContent = '';
      const footer = shadow.getElementById('modal').querySelector('.modal-footer');
      footer.innerHTML = `
        <span class="footer-status success">Done!</span>
        <button class="btn btn-secondary" id="done-btn">Close</button>
        ${offerAnother ? `
          <button class="btn btn-primary" id="another-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9V6a2 2 0 0 1 2-2h2"/><path d="M15 4h2a2 2 0 0 1 2 2v3"/>
              <path d="M21 15v2a2 2 0 0 1-2 2h-2"/><path d="M9 20H7a2 2 0 0 1-2-2v-2"/>
            </svg>
            Submit Another
          </button>` : ''}
      `;
      shadow.getElementById('done-btn').addEventListener('click', destroyAll);
      shadow.getElementById('another-btn')?.addEventListener('click', restartCapture);
    }

    // Tears down the current modal and starts a fresh capture on the same tab.
    // The background worker re-captures the visible tab (the activeTab grant
    // from the original toolbar click is still valid), then we mount the
    // selection overlay again without involving the popup.
    async function restartCapture() {
      const btn = shadow.getElementById('another-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Capturing…'; }
      try {
        const res = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
        if (res?.error) throw new Error(res.error);
        destroyAll();
        if (captureMode === 'full') startFullCapture();
        else mountSelectionOverlay();
      } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Another'; }
        const fs = shadow.getElementById('footer-status');
        if (fs) { fs.textContent = err.message; fs.className = 'footer-status error'; }
      }
    }
  }

  // ─── HTML escape helper ────────────────────────────────────────────────────
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
