// content.js

function injectSyncButton() {
  if (document.getElementById('tlc-sync-container')) return true;

  const firstPanel = document.querySelector('.panel.panel-theme');
  if (!firstPanel || !firstPanel.parentNode) return false;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #tlc-sync-container {
      margin: 0 0 18px 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #tlc-sync-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      border: none;
      border-radius: 10px;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s ease, transform 0.15s ease;
      width: fit-content;
    }
    #tlc-sync-btn:hover:not(:disabled)  { opacity: 0.88; transform: translateY(-1px); }
    #tlc-sync-btn:active:not(:disabled) { opacity: 1; transform: translateY(0); }
    #tlc-sync-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    
    #tlc-modal-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
      z-index: 10000; font-family: system-ui, sans-serif;
    }
    #tlc-modal {
      background: #fff; padding: 24px; border-radius: 12px;
      min-width: 340px; max-width: 520px; width: 90vw;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    #tlc-modal h2 { margin: 0 0 4px; font-size: 1.25rem; }
    #tlc-modal .tlc-modal-subtitle { font-size: 0.85rem; color: #6b7280; margin: 0 0 16px; }
    #tlc-modal select { width: 100%; padding: 8px; margin-bottom: 20px; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem; }
    #tlc-modal .btn-group { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
    #tlc-modal button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    #tlc-modal .btn-cancel { background: #e5e7eb; color: #374151; }
    #tlc-modal .btn-confirm { background: #22c55e; color: #fff; }
    .tlc-stat-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 0.95rem; }
    .tlc-stat-row:not(:last-child) { border-bottom: 1px solid #f3f4f6; }
    .tlc-stat-icon { font-size: 1.1rem; width: 22px; text-align: center; }
    .tlc-stat-label { color: #374151; flex: 1; }
    .tlc-stat-count { font-weight: 700; color: #111827; }
    .tlc-not-found-list { margin: 8px 0 0 0; padding: 0; list-style: none; }
    .tlc-not-found-list li { margin: 4px 0; }
    .tlc-not-found-list a { color: #dc2626; font-weight: 600; text-decoration: underline; font-size: 0.9rem; }
    .tlc-not-found-list a:hover { color: #991b1b; }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'tlc-sync-container';

  const btn = document.createElement('button');
  btn.id = 'tlc-sync-btn';
  btn.innerHTML = '⚡ Sync TLC Attendance';

  btn.addEventListener('click', handleSyncClick);

  container.appendChild(btn);
  firstPanel.parentNode.insertBefore(container, firstPanel);

  return true;
}

async function handleSyncClick() {
  const btn = document.getElementById('tlc-sync-btn');
  btn.disabled = true;
  btn.innerHTML = '⏳ Loading...';

  try {
    const { supabase_session } = await chrome.storage.local.get('supabase_session');
    if (!supabase_session) {
      showLoginModal(btn);
      return;
    }

    // Fetch ended sessions
    chrome.runtime.sendMessage({ action: 'GET_ENDED_SESSIONS' }, (response) => {
      if (chrome.runtime.lastError || response?.error) {
        alert('Error: ' + (chrome.runtime.lastError?.message || response?.error));
        resetBtn(btn);
        return;
      }

      const sessions = response.data || [];
      if (sessions.length === 0) {
        alert('No sessions pending sync were found. Make sure you have clicked "End" on a session in the dashboard first.');
        resetBtn(btn);
        return;
      }

      showSessionSelectorModal(sessions, btn);
    });
  } catch (err) {
    console.error(err);
    alert('An unexpected error occurred.');
    resetBtn(btn);
  }
}

function showLoginModal(btn) {
  const overlay = document.createElement('div');
  overlay.id = 'tlc-modal-overlay';

  overlay.innerHTML = `
    <div id="tlc-modal" style="max-width: 360px;">
      <h2>Log In to TLC Attendance</h2>
      <p style="margin-bottom:12px; font-size:14px; color:#555;">Sign in with your TLC Attendance SaaS account:</p>
      <div id="tlc-login-err" style="color: #dc2626; font-size: 13px; margin-bottom: 10px; display: none;"></div>
      <input type="email" id="tlc-login-email" placeholder="Email address" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem; box-sizing: border-box;" />
      <input type="password" id="tlc-login-password" placeholder="Password" style="width: 100%; padding: 8px; margin-bottom: 16px; border-radius: 4px; border: 1px solid #ccc; font-size: 1rem; box-sizing: border-box;" />
      <div class="btn-group">
        <button class="btn-cancel" id="tlc-login-cancel">Cancel</button>
        <button class="btn-confirm" id="tlc-login-submit">Log In</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('tlc-login-cancel').onclick = () => {
    overlay.remove();
    resetBtn(btn);
  };

  const submitBtn = document.getElementById('tlc-login-submit');
  const errDiv = document.getElementById('tlc-login-err');

  const doLogin = () => {
    const email = document.getElementById('tlc-login-email').value;
    const password = document.getElementById('tlc-login-password').value;

    if (!email || !password) {
      errDiv.textContent = 'Please fill in both email and password.';
      errDiv.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    errDiv.style.display = 'none';

    chrome.runtime.sendMessage({ action: 'LOGIN', email, password }, (res) => {
      if (res?.error) {
        errDiv.textContent = res.error;
        errDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
      } else {
        overlay.remove();
        // Proceed straight into the sync flow!
        handleSyncClick();
      }
    });
  };

  submitBtn.onclick = doLogin;
  document.getElementById('tlc-login-password').onkeydown = (e) => {
    if (e.key === 'Enter') doLogin();
  };
}

function showSessionSelectorModal(sessions, btn) {
  const overlay = document.createElement('div');
  overlay.id = 'tlc-modal-overlay';

  let optionsHtml = sessions.map(s => `<option value="${s.id}">${s.event_name} (${s.event_date})</option>`).join('');

  overlay.innerHTML = `
    <div id="tlc-modal">
      <h2>Select Session to Sync</h2>
      <p style="margin-bottom:8px; font-size:14px; color:#555;">Choose a session to pull approved attendance from:</p>
      <select id="tlc-session-select">
        ${optionsHtml}
      </select>
      <div class="btn-group">
        <button class="btn-cancel" id="tlc-btn-cancel">Cancel</button>
        <button class="btn-confirm" id="tlc-btn-confirm">Sync</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('tlc-btn-cancel').onclick = () => {
    overlay.remove();
    resetBtn(btn);
  };

  document.getElementById('tlc-btn-confirm').onclick = () => {
    const select = document.getElementById('tlc-session-select');
    const sessionId = select.value;
    const sessionName = select.options[select.selectedIndex]?.text || 'Session';
    overlay.remove();
    performSync(sessionId, sessionName, btn);
  };
}

function getEventId() {
  const input = document.querySelector('input[id$="-attended"]');
  if (!input) return null;
  const parts = input.id.split('-');
  return parts.length >= 3 ? parts[1] : null;
}

function checkMember(tlcId, eventId) {
  const inputId = `${tlcId}-${eventId}-attended`;
  const input = document.getElementById(inputId);

  if (!input) return 'notfound';
  if (input.value === '1') return 'skipped'; // already checked

  const cbxDiv = input.closest('.cbx-container')?.querySelector('.cbx');
  if (!cbxDiv) return 'notfound';

  cbxDiv.click();
  return 'checked';
}

function performSync(sessionId, sessionName, btn) {
  btn.innerHTML = '⏳ Syncing...';

  chrome.runtime.sendMessage({ action: 'SYNC_ATTENDANCE', sessionId }, (response) => {
    if (chrome.runtime.lastError || response?.error) {
      alert('Sync failed: ' + (chrome.runtime.lastError?.message || response?.error));
      resetBtn(btn);
      return;
    }

    const scans = response.data || [];
    console.log('[TLC Sync] Scans received from Supabase:', scans);

    if (scans.length === 0) {
      showSyncResultsModal(sessionName, 0, 0, [], [], btn);
      chrome.runtime.sendMessage({ action: 'MARK_SESSION_SYNCED', sessionId });
      return;
    }

    const tlcEventId = getEventId();
    console.log('[TLC Sync] TLC Event ID extracted from page:', tlcEventId);

    if (!tlcEventId) {
      alert('Could not find attendance checkboxes on this page.\n\nMake sure you have selected an event on the TLC Track Attendance page so the roster has loaded.');
      resetBtn(btn);
      return;
    }

    // Log all checkbox IDs on the page for debugging
    const allCheckboxes = document.querySelectorAll('input[id$="-attended"]');
    console.log('[TLC Sync] All checkbox inputs found on page:', allCheckboxes.length);
    allCheckboxes.forEach(cb => console.log('  checkbox id:', cb.id));

    let checkedCount = 0;
    let skippedCount = 0;
    const notFoundList = []; // Array of { name, tlcId }
    const missingTlcIdList = [];

    for (const scan of scans) {
      if (!scan.roster || !scan.roster.tlc_id) {
        missingTlcIdList.push(scan.roster?.first_name || 'Unknown');
        console.warn('[TLC Sync] Scan is missing tlc_id:', scan);
        continue;
      }
      console.log('[TLC Sync] Checking member:', scan.roster.first_name, '| tlc_id:', scan.roster.tlc_id, '| looking for input id:', `${scan.roster.tlc_id}-${tlcEventId}-attended`);
      const res = checkMember(scan.roster.tlc_id, tlcEventId);
      console.log('[TLC Sync] Result for', scan.roster.first_name, ':', res);
      if (res === 'checked') checkedCount++;
      else if (res === 'skipped') skippedCount++;
      else notFoundList.push({ name: `${scan.roster.first_name} ${scan.roster.last_initial || ''}.`.trim(), tlcId: scan.roster.tlc_id });
    }

    // Mark as synced regardless
    chrome.runtime.sendMessage({ action: 'MARK_SESSION_SYNCED', sessionId }, () => {
      showSyncResultsModal(sessionName, checkedCount, skippedCount, notFoundList, missingTlcIdList, btn);
    });
  });
}

function showSyncResultsModal(sessionName, checkedCount, skippedCount, notFoundList, missingTlcIdList, btn) {
  const overlay = document.createElement('div');
  overlay.id = 'tlc-modal-overlay';

  const notFoundHtml = notFoundList.length > 0
    ? `<div style="margin-top: 14px;">
        <div style="font-size: 0.85rem; font-weight: 600; color: #dc2626; margin-bottom: 6px;">❌ Not Found on Page</div>
        <ul class="tlc-not-found-list">
          ${notFoundList.map(p => `<li><a href="https://traillifeconnect.com/members/${p.tlcId}" target="_blank" rel="noopener">${p.name} <span style="font-weight:400; color:#9ca3af;">(${p.tlcId})</span></a></li>`).join('')}
        </ul>
      </div>`
    : '';

  const missingHtml = missingTlcIdList.length > 0
    ? `<div style="margin-top: 10px; font-size: 0.85rem; color: #92400e;">⚠️ Missing TLC ID (check Roster): ${missingTlcIdList.join(', ')}</div>`
    : '';

  overlay.innerHTML = `
    <div id="tlc-modal">
      <h2>Sync Complete!</h2>
      <p class="tlc-modal-subtitle">${sessionName}</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
        <div class="tlc-stat-row">
          <span class="tlc-stat-icon">✅</span>
          <span class="tlc-stat-label">Checked</span>
          <span class="tlc-stat-count">${checkedCount}</span>
        </div>
        <div class="tlc-stat-row">
          <span class="tlc-stat-icon">⏭️</span>
          <span class="tlc-stat-label">Already Checked</span>
          <span class="tlc-stat-count">${skippedCount}</span>
        </div>
      </div>
      ${notFoundHtml}
      ${missingHtml}
      <div class="btn-group">
        <button class="btn-confirm" id="tlc-results-ok">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('tlc-results-ok').onclick = () => {
    overlay.remove();
    resetBtn(btn);
  };
}

function resetBtn(btn) {
  chrome.storage.local.get('supabase_session', ({ supabase_session }) => {
    updateButtonState(supabase_session);
  });
}

function updateButtonState(session) {
  const btn = document.getElementById('tlc-sync-btn');
  if (btn) {
    btn.disabled = false;
    if (!session) {
      btn.innerHTML = '🔒 Login to Sync TLC Attendance';
      btn.style.background = '#6c757d';
      btn.title = 'Click to log in and sync attendance';
    } else {
      btn.innerHTML = '⚡ Sync TLC Attendance';
      btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
      btn.title = 'Click to sync attendance';
    }
  }
}

// Initial check and injection
chrome.storage.local.get('supabase_session', ({ supabase_session }) => {
  if (!injectSyncButton()) {
    const observer = new MutationObserver(() => {
      if (injectSyncButton()) {
        updateButtonState(supabase_session);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  } else {
    updateButtonState(supabase_session);
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.supabase_session) {
    updateButtonState(changes.supabase_session.newValue);
  }
});
