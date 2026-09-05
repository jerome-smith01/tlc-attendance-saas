import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabaseClient';
import { useTroop } from '../context/TroopContext';
import { useToast } from '../components/common/ToastContext';

// ── Constants ─────────────────────────────────────────────────────────────────
const BUCKET = {
  READY:      'ready',      // QR decoded, member matched, will be written
  SAME:       'same',       // Already linked with the same tlc_id → skip
  NO_MATCH:   'no_match',   // QR decoded but no roster member found
  UNREADABLE: 'unreadable', // PDF rendered but QR decode failed
};

const BUCKET_LABEL = {
  [BUCKET.READY]:      '✅ Ready to Link',
  [BUCKET.SAME]:       '⚠️ Already Linked (same badge)',
  [BUCKET.NO_MATCH]:   '❌ No Roster Match',
  [BUCKET.UNREADABLE]: '🚫 QR Unreadable',
};

// ── QR / PDF helpers ──────────────────────────────────────────────────────────

/**
 * Render page 1 of a PDF File to an off-screen canvas.
 * Scales 3× so small QR codes have enough pixels.
 */
async function renderPdfToCanvas(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF.js not loaded');

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale    = 3;
  const viewport = page.getViewport({ scale });
  const canvas   = document.createElement('canvas');
  canvas.width   = viewport.width;
  canvas.height  = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

/**
 * Decode a QR code from a canvas element via html5-qrcode's scanFile API.
 */
async function decodeQrFromCanvas(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return; }

      const file        = new File([blob], 'badge.png', { type: 'image/png' });
      const containerId = `__bulk_qr_${Date.now()}`;
      const container   = document.createElement('div');
      container.id      = containerId;
      container.style.display = 'none';
      document.body.appendChild(container);

      try {
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        const result  = await scanner.scanFile(file, false);
        document.body.removeChild(container);
        resolve(result);
      } catch (err) {
        if (document.body.contains(container)) document.body.removeChild(container);
        reject(err);
      }
    }, 'image/png');
  });
}

/**
 * Parse TLC QR payload → { memberId, tlcId }.
 * Formats: "memberId | tlcId"  or a single token.
 */
function parseQrPayload(raw) {
  const parts = String(raw).split('|').map(p => p.trim());
  if (parts.length >= 2) return { memberId: parts[0], tlcId: parts[1] };
  return { memberId: null, tlcId: parts[0] };
}

/** Match decoded QR to a roster entry: member_id first, then tlc_id. */
function findRosterMatch(roster, memberId, tlcId) {
  if (memberId) {
    const m = roster.find(r => r.member_id && r.member_id === memberId);
    if (m) return m;
  }
  if (tlcId) {
    const m = roster.find(r => r.tlc_id && r.tlc_id === tlcId);
    if (m) return m;
  }
  return null;
}

export function BulkBadgeImportPage() {
  const { troopNumber } = useParams();
  const navigate = useNavigate();
  const { 
    selectedTroopId, 
    selectedTroop, 
    selectedTroopIdentifier, 
    selectTroopByNumberOrId, 
    loadingTroops, 
    isGlobalAdmin 
  } = useTroop();
  const { addToast } = useToast();

  // Sync TroopContext with URL parameter when troopNumber is present in URL
  useEffect(() => {
    if (loadingTroops) return;
    if (troopNumber) {
      selectTroopByNumberOrId(troopNumber);
    }
  }, [troopNumber, loadingTroops]);

  const currentTroopIdentifier = selectedTroopIdentifier || selectedTroopId;
  const rosterBackPath = currentTroopIdentifier
    ? `/troop/${currentTroopIdentifier}/roster/members`
    : '/roster/members';

  // If URL lacks troopNumber (legacy /roster/import-badges), redirect once troops are loaded
  useEffect(() => {
    if (loadingTroops || !selectedTroopIdentifier) return;
    if (!troopNumber) {
      navigate(`/troop/${selectedTroopIdentifier}/roster/import-badges`, { replace: true });
    }
  }, [troopNumber, selectedTroopIdentifier, loadingTroops, navigate]);

  const currentUserRole = selectedTroop?.currentUserRole;
  const canManageRoster = isGlobalAdmin || currentUserRole === 'roster_manager' || currentUserRole === 'troop_admin';

  // Roster fetching
  const [roster, setRoster] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(true);

  useEffect(() => {
    if (!selectedTroopId) {
      setRoster([]);
      setLoadingRoster(false);
      return;
    }

    async function fetchRoster() {
      try {
        setLoadingRoster(true);
        const { data, error } = await supabase
          .from('roster')
          .select('*')
          .eq('troop_id', selectedTroopId)
          .order('first_name');

        if (error) throw error;
        setRoster(data || []);
      } catch (err) {
        console.error('Error fetching roster:', err);
        addToast('Failed to load roster members.', 'error');
      } finally {
        setLoadingRoster(false);
      }
    }

    fetchRoster();
  }, [selectedTroopId]);

  // Wizard state
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [applying, setApplying] = useState(false);
  const [noMatchAssign, setNoMatchAssign] = useState({});
  const fileInputRef = useRef(null);

  // ── File handling ────────────────────────────────────────────────────────────
  const handleFiles = useCallback((incoming) => {
    const pdfs = [...incoming].filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    setFiles(pdfs);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Processing ───────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (!files.length) return;
    setStep(2);
    setProgress({ done: 0, total: files.length });

    const collected = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let bucket, member, memberId = null, tlcId = null;

      try {
        const canvas = await renderPdfToCanvas(file);
        const raw    = await decodeQrFromCanvas(canvas);
        ({ memberId, tlcId } = parseQrPayload(raw));
        member = findRosterMatch(roster, memberId, tlcId);

        if (!member) {
          bucket = BUCKET.NO_MATCH;
        } else if (member.tlc_id && member.tlc_id === tlcId) {
          // Exact same badge already stored → skip
          bucket = BUCKET.SAME;
        } else {
          // Not linked yet, or has a different tlc_id → overwrite
          bucket = BUCKET.READY;
        }
      } catch {
        bucket = BUCKET.UNREADABLE;
        member = null;
      }

      collected.push({ file, bucket, member, memberId, tlcId });
      setProgress({ done: i + 1, total: files.length });
    }

    setResults(collected);
    setNoMatchAssign({});
    setStep(3);
  };

  // ── Apply ────────────────────────────────────────────────────────────────────
  const handleApply = async () => {
    setApplying(true);
    const toWrite = [];

    results.forEach((r, idx) => {
      if (r.bucket === BUCKET.READY && r.member) {
        toWrite.push({ rosterId: r.member.id, tlcId: r.tlcId, memberId: r.memberId, existingMemberId: r.member.member_id });
      }
      if (r.bucket === BUCKET.NO_MATCH && noMatchAssign[idx]) {
        const rosterMember = roster.find(m => m.id === noMatchAssign[idx]);
        toWrite.push({ rosterId: noMatchAssign[idx], tlcId: r.tlcId, memberId: r.memberId, existingMemberId: rosterMember?.member_id });
      }
    });

    let errorCount = 0;
    for (const entry of toWrite) {
      try {
        const payload = { tlc_id: entry.tlcId };
        // Backfill member_id if the row doesn't have it yet
        if (entry.memberId && !entry.existingMemberId) {
          payload.member_id = entry.memberId;
        }
        const { error } = await supabase.from('roster').update(payload).eq('id', entry.rosterId);
        if (error) errorCount++;
      } catch {
        errorCount++;
      }
    }

    setApplying(false);
    const linkedCount = toWrite.length - errorCount;
    if (linkedCount > 0) {
      addToast(`Successfully linked ${linkedCount} badge${linkedCount !== 1 ? 's' : ''}!`, 'success');
    }
    if (errorCount > 0) {
      addToast(`Failed to link ${errorCount} badge${errorCount !== 1 ? 's' : ''}.`, 'error');
    }
    navigate(rosterBackPath);
  };

  const handleCancel = () => {
    navigate(rosterBackPath);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const bucketGroups = {
    [BUCKET.READY]:      results.filter(r => r.bucket === BUCKET.READY),
    [BUCKET.SAME]:       results.filter(r => r.bucket === BUCKET.SAME),
    [BUCKET.NO_MATCH]:   results.filter(r => r.bucket === BUCKET.NO_MATCH),
    [BUCKET.UNREADABLE]: results.filter(r => r.bucket === BUCKET.UNREADABLE),
  };

  const readyCount    = bucketGroups[BUCKET.READY].length;
  const assignedCount = Object.keys(noMatchAssign).length;
  const totalToApply  = readyCount + assignedCount;

  const getMemberName = (m) => m ? `${m.first_name} ${m.last_initial}.` : '—';

  const assignableMembers = [...roster]
    .filter(m => m.role === null || m.role === 'trailman')
    .sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));

  if (loadingTroops || loadingRoster) {
    return <div style={{ padding: '2rem', color: 'var(--foreground)' }}>Loading...</div>;
  }

  if (!selectedTroopId) {
    return (
      <div style={{ padding: '2rem', color: 'var(--foreground)' }}>
        <h2>No Troop Selected</h2>
        <p>Please select a troop from the top navigation bar to manage badge imports.</p>
      </div>
    );
  }

  if (!canManageRoster) {
    return (
      <div style={{ padding: '2rem', color: 'var(--foreground)' }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to import badges.</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(rosterBackPath)}>
          Back to Roster
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>
      {/* Header & Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          title="Back to Roster"
          onClick={handleCancel}
          style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8L2 12L6 16"></path>
            <path d="M2 12H22"></path>
          </svg>
        </button>
        <div>
          <h1 style={{ color: 'var(--foreground)', margin: 0, fontSize: '1.5rem' }}>Bulk Import Badges</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Troop {selectedTroop?.troop_number} • Bulk import badge PDFs and link them to roster members
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.75rem' }}>
        {/* ── Step indicator ─────────────────────────────────────────────── */}
        <div className="bulk-badge-steps">
          {['Select Files', 'Processing', 'Review & Apply'].map((label, i) => (
            <div
              key={i}
              className={`bulk-badge-step${step === i + 1 ? ' active' : step > i + 1 ? ' done' : ''}`}
            >
              <span className="bulk-badge-step-num">{step > i + 1 ? '✓' : i + 1}</span>
              <span className="bulk-badge-step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            Step 1 — File picker
        ═══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              className={`bulk-badge-dropzone${isDragging ? ' dragging' : ''}${files.length > 0 ? ' compact' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              aria-label="Drop PDF badge files here or click to browse"
            >
              <svg width={files.length > 0 ? "32" : "44"} height={files.length > 0 ? "32" : "44"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)', opacity: 0.75 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <p style={{ margin: files.length > 0 ? '0.35rem 0 0.2rem' : '0.6rem 0 0.3rem', fontWeight: 600, fontSize: files.length > 0 ? '0.95rem' : '1.05rem', color: 'var(--foreground)' }}>
                {files.length > 0 ? 'Drop more PDF badges or click to change' : 'Drop PDF badges here'}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                multiple <code style={{ background: 'var(--muted)', padding: '1px 5px', borderRadius: '3px' }}>.pdf</code> files accepted
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {files.length} file{files.length !== 1 ? 's' : ''} selected
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFiles([]); }}
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-error)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 500
                    }}
                    title="Clear selected files"
                  >
                    Clear all
                  </button>
                </div>
                <div className="bulk-badge-file-list" style={{ maxHeight: '240px' }}>
                  {[...files].map((f, i) => (
                    <div key={i} className="bulk-badge-file-row">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-primary)' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {f.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProcess}
                disabled={files.length === 0}
              >
                Process {files.length > 0 ? `${files.length} Badge${files.length !== 1 ? 's' : ''}` : 'Badges'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            Step 2 — Processing
        ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '3rem 1rem' }}>
            <svg
              width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--color-primary)', animation: 'spin 1.2s linear infinite' }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.25rem', fontWeight: 600, fontSize: '1.05rem', color: 'var(--foreground)' }}>
                Reading QR codes…
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {progress.done} of {progress.total} badges processed
              </p>
            </div>
            <div
              className="bulk-badge-progress-track"
              role="progressbar"
              aria-valuenow={progress.done}
              aria-valuemax={progress.total}
              aria-label="Processing progress"
            >
              <div
                className="bulk-badge-progress-fill"
                style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
              />
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Please stay on this page while badges are being processed.
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            Step 3 — Review & Apply
        ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Summary chips */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {Object.entries(bucketGroups).map(([key, items]) =>
                items.length > 0 ? (
                  <span key={key} className={`bulk-badge-chip bulk-badge-chip--${key}`}>
                    {BUCKET_LABEL[key]} ({items.length})
                  </span>
                ) : null
              )}
            </div>

            {/* Scrollable results area */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '4px' }}>
              {/* ── Ready to link ── */}
              {bucketGroups[BUCKET.READY].length > 0 && (
                <div className="bulk-badge-bucket">
                  <p className="bulk-badge-bucket-title">{BUCKET_LABEL[BUCKET.READY]}</p>
                  {bucketGroups[BUCKET.READY].map((r, i) => (
                    <div key={i} className="bulk-badge-result-row">
                      <span className="bulk-badge-result-icon">✅</span>
                      <span className="bulk-badge-result-file" title={r.file.name}>{r.file.name}</span>
                      <span className="bulk-badge-result-arrow">→</span>
                      <span className="bulk-badge-result-member">{getMemberName(r.member)}</span>
                      {r.member?.tlc_id && r.member.tlc_id !== r.tlcId && (
                        <span className="bulk-badge-result-tag bulk-badge-result-tag--warn">overwrite</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── No match — manual assign ── */}
              {bucketGroups[BUCKET.NO_MATCH].length > 0 && (
                <div className="bulk-badge-bucket">
                  <p className="bulk-badge-bucket-title">{BUCKET_LABEL[BUCKET.NO_MATCH]}</p>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    These badges decoded successfully but no roster member matched by Member ID or TLC ID.
                    You can optionally assign each to a member below.
                  </p>
                  {results.map((r, idx) =>
                    r.bucket !== BUCKET.NO_MATCH ? null : (
                      <div key={idx} className="bulk-badge-result-row">
                        <span className="bulk-badge-result-icon">❌</span>
                        <span className="bulk-badge-result-file" title={r.file.name}>{r.file.name}</span>
                        <span className="bulk-badge-result-arrow">→</span>
                        <select
                          className="bulk-badge-assign-select"
                          value={noMatchAssign[idx] || ''}
                          onChange={(e) =>
                            setNoMatchAssign(prev => {
                              const next = { ...prev };
                              if (e.target.value) next[idx] = e.target.value;
                              else delete next[idx];
                              return next;
                            })
                          }
                          aria-label={`Assign ${r.file.name} to a member`}
                        >
                          <option value="">— Skip —</option>
                          {assignableMembers.map(m => (
                            <option key={m.id} value={m.id}>
                              {getMemberName(m)}{m.tlc_id ? ' ⚠️' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* ── Already linked (same) ── */}
              {bucketGroups[BUCKET.SAME].length > 0 && (
                <div className="bulk-badge-bucket">
                  <p className="bulk-badge-bucket-title">{BUCKET_LABEL[BUCKET.SAME]}</p>
                  {bucketGroups[BUCKET.SAME].map((r, i) => (
                    <div key={i} className="bulk-badge-result-row bulk-badge-result-row--muted">
                      <span className="bulk-badge-result-icon">⚠️</span>
                      <span className="bulk-badge-result-file" title={r.file.name}>{r.file.name}</span>
                      <span className="bulk-badge-result-arrow">→</span>
                      <span className="bulk-badge-result-member">{getMemberName(r.member)}</span>
                      <span className="bulk-badge-result-tag">skipped</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Unreadable ── */}
              {bucketGroups[BUCKET.UNREADABLE].length > 0 && (
                <div className="bulk-badge-bucket">
                  <p className="bulk-badge-bucket-title">{BUCKET_LABEL[BUCKET.UNREADABLE]}</p>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Could not read a QR code from these files. Try scanning them individually.
                  </p>
                  {bucketGroups[BUCKET.UNREADABLE].map((r, i) => (
                    <div key={i} className="bulk-badge-result-row bulk-badge-result-row--muted">
                      <span className="bulk-badge-result-icon">🚫</span>
                      <span className="bulk-badge-result-file" title={r.file.name}>{r.file.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Footer buttons ── */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => { setStep(1); setResults([]); setNoMatchAssign({}); }}
              >
                ← Start Over
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleApply}
                  disabled={applying || totalToApply === 0}
                >
                  {applying
                    ? 'Linking…'
                    : totalToApply > 0
                      ? `Link ${totalToApply} Badge${totalToApply !== 1 ? 's' : ''}`
                      : 'Nothing to Link'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
