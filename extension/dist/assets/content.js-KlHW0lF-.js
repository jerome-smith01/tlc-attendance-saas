(function(){function e(){if(document.getElementById(`tlc-sync-container`))return!0;let e=document.querySelector(`.panel.panel-theme`);if(!e||!e.parentNode)return!1;let n=document.createElement(`style`);n.textContent=`
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
  `,document.head.appendChild(n);let r=document.createElement(`div`);r.id=`tlc-sync-container`;let i=document.createElement(`button`);return i.id=`tlc-sync-btn`,i.innerHTML=`⚡ Sync TLC Attendance`,i.addEventListener(`click`,t),r.appendChild(i),e.parentNode.insertBefore(r,e),!0}async function t(){let e=document.getElementById(`tlc-sync-btn`);e.disabled=!0,e.innerHTML=`⏳ Loading...`;try{let{supabase_session:t}=await chrome.storage.local.get(`supabase_session`);if(!t){n(e);return}chrome.runtime.sendMessage({action:`GET_ENDED_SESSIONS`},t=>{if(chrome.runtime.lastError||t?.error){alert(`Error: `+(chrome.runtime.lastError?.message||t?.error)),c(e);return}let n=t.data||[];if(n.length===0){alert(`No sessions pending sync were found. Make sure you have clicked "End" on a session in the dashboard first.`),c(e);return}r(n,e)})}catch(t){console.error(t),alert(`An unexpected error occurred.`),c(e)}}function n(e){let n=document.createElement(`div`);n.id=`tlc-modal-overlay`,n.innerHTML=`
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
  `,document.body.appendChild(n),document.getElementById(`tlc-login-cancel`).onclick=()=>{n.remove(),c(e)};let r=document.getElementById(`tlc-login-submit`),i=document.getElementById(`tlc-login-err`),a=()=>{let e=document.getElementById(`tlc-login-email`).value,a=document.getElementById(`tlc-login-password`).value;if(!e||!a){i.textContent=`Please fill in both email and password.`,i.style.display=`block`;return}r.disabled=!0,r.textContent=`Logging in...`,i.style.display=`none`,chrome.runtime.sendMessage({action:`LOGIN`,email:e,password:a},e=>{e?.error?(i.textContent=e.error,i.style.display=`block`,r.disabled=!1,r.textContent=`Log In`):(n.remove(),t())})};r.onclick=a,document.getElementById(`tlc-login-password`).onkeydown=e=>{e.key===`Enter`&&a()}}function r(e,t){let n=document.createElement(`div`);n.id=`tlc-modal-overlay`,n.innerHTML=`
    <div id="tlc-modal">
      <h2>Select Session to Sync</h2>
      <p style="margin-bottom:8px; font-size:14px; color:#555;">Choose a session to pull approved attendance from:</p>
      <select id="tlc-session-select">
        ${e.map(e=>`<option value="${e.id}">${e.event_name} (${e.event_date})</option>`).join(``)}
      </select>
      <div class="btn-group">
        <button class="btn-cancel" id="tlc-btn-cancel">Cancel</button>
        <button class="btn-confirm" id="tlc-btn-confirm">Sync</button>
      </div>
    </div>
  `,document.body.appendChild(n),document.getElementById(`tlc-btn-cancel`).onclick=()=>{n.remove(),c(t)},document.getElementById(`tlc-btn-confirm`).onclick=()=>{let e=document.getElementById(`tlc-session-select`),r=e.value,i=e.options[e.selectedIndex]?.text||`Session`;n.remove(),o(r,i,t)}}function i(){let e=document.querySelector(`input[id$="-attended"]`);if(!e)return null;let t=e.id.split(`-`);return t.length>=3?t[1]:null}function a(e,t){let n=`${e}-${t}-attended`,r=document.getElementById(n);if(!r)return`notfound`;if(r.value===`1`)return`skipped`;let i=r.closest(`.cbx-container`)?.querySelector(`.cbx`);return i?(i.click(),`checked`):`notfound`}function o(e,t,n){n.innerHTML=`⏳ Syncing...`,chrome.runtime.sendMessage({action:`SYNC_ATTENDANCE`,sessionId:e},r=>{if(chrome.runtime.lastError||r?.error){alert(`Sync failed: `+(chrome.runtime.lastError?.message||r?.error)),c(n);return}let o=r.data||[];if(console.log(`[TLC Sync] Scans received from Supabase:`,o),o.length===0){s(t,0,0,[],[],n),chrome.runtime.sendMessage({action:`MARK_SESSION_SYNCED`,sessionId:e});return}let l=i();if(console.log(`[TLC Sync] TLC Event ID extracted from page:`,l),!l){alert(`Could not find attendance checkboxes on this page.

Make sure you have selected an event on the TLC Track Attendance page so the roster has loaded.`),c(n);return}let u=document.querySelectorAll(`input[id$="-attended"]`);console.log(`[TLC Sync] All checkbox inputs found on page:`,u.length),u.forEach(e=>console.log(`  checkbox id:`,e.id));let d=0,f=0,p=[],m=[];for(let e of o){if(!e.roster||!e.roster.tlc_id){m.push(e.roster?.first_name||`Unknown`),console.warn(`[TLC Sync] Scan is missing tlc_id:`,e);continue}console.log(`[TLC Sync] Checking member:`,e.roster.first_name,`| tlc_id:`,e.roster.tlc_id,`| looking for input id:`,`${e.roster.tlc_id}-${l}-attended`);let t=a(e.roster.tlc_id,l);console.log(`[TLC Sync] Result for`,e.roster.first_name,`:`,t),t===`checked`?d++:t===`skipped`?f++:p.push({name:`${e.roster.first_name} ${e.roster.last_initial||``}.`.trim(),tlcId:e.roster.tlc_id})}chrome.runtime.sendMessage({action:`MARK_SESSION_SYNCED`,sessionId:e},()=>{s(t,d,f,p,m,n)})})}function s(e,t,n,r,i,a){let o=document.createElement(`div`);o.id=`tlc-modal-overlay`,o.innerHTML=`
    <div id="tlc-modal">
      <h2>Sync Complete!</h2>
      <p class="tlc-modal-subtitle">${e}</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
        <div class="tlc-stat-row">
          <span class="tlc-stat-icon">✅</span>
          <span class="tlc-stat-label">Checked</span>
          <span class="tlc-stat-count">${t}</span>
        </div>
        <div class="tlc-stat-row">
          <span class="tlc-stat-icon">⏭️</span>
          <span class="tlc-stat-label">Already Checked</span>
          <span class="tlc-stat-count">${n}</span>
        </div>
      </div>
      ${r.length>0?`<div style="margin-top: 14px;">
        <div style="font-size: 0.85rem; font-weight: 600; color: #dc2626; margin-bottom: 6px;">❌ Not Found on Page</div>
        <ul class="tlc-not-found-list">
          ${r.map(e=>`<li><a href="https://traillifeconnect.com/members/${e.tlcId}" target="_blank" rel="noopener">${e.name} <span style="font-weight:400; color:#9ca3af;">(${e.tlcId})</span></a></li>`).join(``)}
        </ul>
      </div>`:``}
      ${i.length>0?`<div style="margin-top: 10px; font-size: 0.85rem; color: #92400e;">⚠️ Missing TLC ID (check Roster): ${i.join(`, `)}</div>`:``}
      <div class="btn-group">
        <button class="btn-confirm" id="tlc-results-ok">OK</button>
      </div>
    </div>
  `,document.body.appendChild(o),document.getElementById(`tlc-results-ok`).onclick=()=>{o.remove(),c(a)}}function c(e){chrome.storage.local.get(`supabase_session`,({supabase_session:e})=>{l(e)})}function l(e){let t=document.getElementById(`tlc-sync-btn`);t&&(t.disabled=!1,e?(t.innerHTML=`⚡ Sync TLC Attendance`,t.style.background=`linear-gradient(135deg, #22c55e, #16a34a)`,t.title=`Click to sync attendance`):(t.innerHTML=`🔒 Login to Sync TLC Attendance`,t.style.background=`#6c757d`,t.title=`Click to log in and sync attendance`))}chrome.storage.local.get(`supabase_session`,({supabase_session:t})=>{if(e())l(t);else{let n=new MutationObserver(()=>{e()&&(l(t),n.disconnect())});n.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>n.disconnect(),1e4)}}),chrome.storage.onChanged.addListener((e,t)=>{t===`local`&&e.supabase_session&&l(e.supabase_session.newValue)});})()
