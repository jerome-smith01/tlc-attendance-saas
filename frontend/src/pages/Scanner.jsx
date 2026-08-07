import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { SessionSelector } from '../components/SessionSelector';
import { useScanLogic } from '../hooks/useScanLogic';
import { ThemeToggle } from '../components/ThemeToggle';
import { useConfirm } from '../components/common/ConfirmContext';
import { useToast } from '../components/common/ToastContext';
import { Modal } from '../components/common/Modal';

export function Scanner() {
  const { user } = useAuth();
  const [troopId, setTroopId] = useState('');
  const [session, setSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedScans, setSelectedScans] = useState(new Set());
  const [scannerStatus, setScannerStatus] = useState('Idle');
  const [isScanning, setIsScanning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

  // Unknown member modal state
  const [unknownPayload, setUnknownPayload] = useState(null);
  const [manualFirstName, setManualFirstName] = useState('');
  const [manualLastInitial, setManualLastInitial] = useState('');
  const [selectedRosterId, setSelectedRosterId] = useState('');
  const [isTableVisible, setIsTableVisible] = useState(true);

  // Manual Entry modal state
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualEntryFirstName, setManualEntryFirstName] = useState('');
  const [manualEntryLastInitial, setManualEntryLastInitial] = useState('');
  const [manualEntryRosterId, setManualEntryRosterId] = useState('');

  const { confirm } = useConfirm();
  const { addToast } = useToast();

  const qrEngineRef = useRef(null);
  const { handleScan } = useScanLogic(troopId, session?.id, user, roster, setRoster);

  useEffect(() => {
    // Load last troop
    const savedTroop = localStorage.getItem('tlc_last_troop_id');
    if (savedTroop) {
      setTroopId(savedTroop);
      fetchRoster(savedTroop);
      fetchUserRole(savedTroop);
    }
  }, [user]);

  // Restore last session from localStorage on mount
  useEffect(() => {
    async function restoreSession() {
      const savedSessionId = localStorage.getItem('tlc_last_session_id');
      const savedTroop = localStorage.getItem('tlc_last_troop_id');
      if (savedSessionId && savedTroop && !session) {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', savedSessionId)
          .eq('troop_id', savedTroop)
          .maybeSingle();
        if (!error && data) {
          setSession(data);
        } else {
          // Session no longer exists or RLS blocked it — clear stale reference
          localStorage.removeItem('tlc_last_session_id');
        }
      }
    }
    restoreSession();
  }, [user]); // re-run once auth is ready

  useEffect(() => {
    if (session) {
      // Persist session selection so navigation away and back restores it
      localStorage.setItem('tlc_last_session_id', session.id);
      fetchAttendance();
    }
  }, [session?.id]);

  async function fetchAttendance() {
    if (!session) return;
    const { data, error } = await supabase
      .from('scans')
      .select(`*, roster (id, first_name, last_initial, member_id, tlc_id)`)
      .eq('session_id', session.id)
      .order('scan_time', { ascending: false });
    if (error) {
      console.error('[fetchAttendance] Supabase error:', error);
      return;
    }
    if (data) {
      const seen = new Set();
      const formatted = [];
      data.forEach(s => {
        const key = s.roster_id || s.roster?.id || s.id;
        if (key && !seen.has(key)) {
          seen.add(key);
          formatted.push({
            id: s.id,
            roster_id: s.roster_id,
            member: s.roster,
            time: new Date(s.scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            status: 'success',
            message: 'Scanned In'
          });
        }
      });
      setAttendance(formatted);
      setSelectedScans(new Set());
    }
  }

  async function fetchUserRole(tId) {
    if (!user) return;

    // Check global admin
    const { data: globalAdmin } = await supabase.from('global_admins').select('id').eq('user_id', user.id).maybeSingle();
    if (globalAdmin) setIsGlobalAdmin(true);

    // Check troop role
    const { data } = await supabase.from('troop_users').select('role').eq('troop_id', tId).eq('user_id', user.id).maybeSingle();
    if (data) setCurrentUserRole(data.role);
  }

  useEffect(() => {
    // Cleanup scanner on unmount
    return () => {
      if (qrEngineRef.current && qrEngineRef.current.getState() === 2) {
        qrEngineRef.current.stop().catch(console.error);
      }
    };
  }, []);

  async function fetchRoster(tId) {
    const { data } = await supabase.from('roster').select('*').eq('troop_id', tId);
    if (data) setRoster(data);
  }

  const handleEndSession = async () => {
    if (await confirm({ title: 'End Session', message: 'Are you sure you want to end this session? No more scans can be recorded after ending.', isDestructive: true })) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('sessions').update({ ended_at: now }).eq('id', session.id);
      if (error) {
        addToast({ type: 'error', message: "Failed to end session: " + error.message });
        return;
      }

      // Approve all pending scans so they are visible to the sync extension
      const { error: scansError } = await supabase
        .from('scans')
        .update({ status: 'approved' })
        .eq('session_id', session.id)
        .eq('status', 'pending');
      if (scansError) {
        addToast({ type: 'warning', message: "Session ended, but failed to approve scans: " + scansError.message });
      } else {
        addToast({ type: 'success', message: "Session ended and scans approved." });
      }

      setSession({ ...session, ended_at: now });
      await stopScanner();
    }
  };

  const handleReenableSession = async () => {
    if (await confirm({ title: 'Reenable Session', message: "Are you sure you want to reenable this session?" })) {
      const { error } = await supabase.from('sessions').update({ ended_at: null }).eq('id', session.id);
      if (error) {
        addToast({ type: 'error', message: "Failed to reenable session: " + error.message });
      } else {
        addToast({ type: 'success', message: "Session reenabled." });
        setSession({ ...session, ended_at: null });
      }
    }
  };

  const handleResetSyncSession = async () => {
    if (await confirm({ title: 'Reset Sync Status', message: "Are you sure you want to reset the sync status for this session? This will mark it as not synced so it can be synced again." })) {
      const { error } = await supabase
        .from('sessions')
        .update({ synced_at: null, synced_by: null, purge_after: null })
        .eq('id', session.id);
      if (error) {
        addToast({ type: 'error', message: "Error resetting sync status: " + error.message });
      } else {
        addToast({ type: 'success', message: "Sync status reset." });
        setSession({ ...session, synced_at: null, synced_by: null, purge_after: null });
      }
    }
  };

  const handleBulkRemove = async () => {
    if (selectedScans.size === 0) return;
    if (!(await confirm({ title: 'Remove Scans', message: `Are you sure you want to remove ${selectedScans.size} scan(s)?`, isDestructive: true }))) return;

    const idsToRemove = Array.from(selectedScans);

    // Delete from DB
    const { error } = await supabase
      .from('scans')
      .delete()
      .in('id', idsToRemove);

    if (error) {
      addToast({ type: 'error', message: "Failed to remove scans: " + error.message });
    } else {
      addToast({ type: 'success', message: `Removed ${selectedScans.size} scan(s).` });
      setAttendance(prev => prev.filter(s => !selectedScans.has(s.id)));
      setSelectedScans(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedScans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedScans(new Set(attendance.filter(s => s.id && !String(s.id).startsWith('temp-')).map(s => s.id)));
    } else {
      setSelectedScans(new Set());
    }
  };

  const startScanner = async () => {
    if (!qrEngineRef.current) {
      qrEngineRef.current = new Html5Qrcode('qr-reader', { verbose: false });
    }
    try {
      setScannerStatus('Starting camera...');
      await qrEngineRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 }, disableFlip: false },
        onScanSuccess
      );
      setIsScanning(true);
      setScannerStatus('Camera Active - Ready to scan');
    } catch (err) {
      console.error(err);
      setIsScanning(false);
      setScannerStatus('Failed to start camera');
    }
  };

  const stopScanner = async () => {
    if (qrEngineRef.current) {
      const state = qrEngineRef.current.getState();
      if (state === 2 || state === 3) {
        try {
          await qrEngineRef.current.stop();
        } catch (err) {
          console.error(err);
        }
      }
    }
    setIsScanning(false);
    setScannerStatus('Camera Stopped');
  };

  const onScanSuccess = async (decodedText) => {
    await processPayload(decodedText);
  };

  const resolveUnknownRef = useRef(null);

  const processPayload = (payload) => {
    return new Promise((resolve) => {
      handleScan(payload, (result) => {
        if (result.status === 'unknown') {
          // Pause camera if running
          if (qrEngineRef.current?.getState() === 2) qrEngineRef.current.pause(true);
          // Beep error
          playErrorSound();
          setUnknownPayload(result.payload);
          resolveUnknownRef.current = resolve;
        } else {
          if (result.status === 'success' || result.status === 'offline_queued') {
            playSuccessSound();
            setShowCheckmark(true);

            // Freeze the camera feed
            if (qrEngineRef.current?.getState() === 2) {
              qrEngineRef.current.pause(true);
            }

            setTimeout(() => {
              setShowCheckmark(false);
              // Resume camera if it was paused for this success freeze
              if (qrEngineRef.current?.getState() === 3 && result.status !== 'unknown' && !unknownPayload) {
                qrEngineRef.current.resume();
              }
            }, 2000);
          } else if (result.status === 'duplicate') {
            playWarningSound();
            setShowWarning(true);

            // Freeze the camera feed
            if (qrEngineRef.current?.getState() === 2) {
              qrEngineRef.current.pause(true);
            }

            setTimeout(() => {
              setShowWarning(false);
              if (qrEngineRef.current?.getState() === 3 && result.status !== 'unknown' && !unknownPayload) {
                qrEngineRef.current.resume();
              }
            }, 2000);
          } else {
            playWarningSound();
          }

          // Add to attendance list only if it's a valid scan and not already scanned in (no duplicate rows)
          if ((result.status === 'success' || result.status === 'offline_queued') && result.member) {
            setAttendance(prev => {
              const rId = result.member.id;
              if (prev.some(item => item.roster_id === rId || item.member?.id === rId)) {
                return prev;
              }
              const newEntry = {
                id: result.scanRecord ? result.scanRecord.id : 'temp-' + Date.now(),
                roster_id: rId,
                member: result.member,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                status: 'success',
                message: result.status === 'offline_queued' ? 'Saved Offline' : 'Scanned In'
              };
              return [newEntry, ...prev];
            });
          }

          resolve(); // Resolve immediately for known members
        }
      });
    });
  };

  const handleBulkPhotos = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Stop live camera if running
    await stopScanner();

    if (!qrEngineRef.current) {
      qrEngineRef.current = new Html5Qrcode('qr-reader', { verbose: false });
    }

    setScannerStatus('Processing Photos...');
    for (let i = 0; i < files.length; i++) {
      setProgressText(`Processing ${i + 1} of ${files.length}...`);
      try {
        // Pass 1: Fast scan
        const text = await qrEngineRef.current.scanFile(files[i], false);
        await processPayload(text);
      } catch (err) {
        // Pass 2 logic would go here if we implement custom canvas resize 
        // For MVP frontend we will attempt standard scanFile
        setAttendance(prev => [
          { id: 'temp-' + Date.now(), member: null, time: new Date().toLocaleTimeString(), status: 'error', message: 'No QR found in image' },
          ...prev
        ]);
      }
    }
    setProgressText('Finished processing photos.');
    setTimeout(() => setProgressText(''), 3000);
  };

  const handleResolveUnknown = async (e) => {
    e.preventDefault();
    if (!selectedRosterId && (!manualFirstName.trim() && !manualLastInitial.trim())) return;

    let targetRosterId = selectedRosterId;
    let targetMember = roster.find(m => m.id === selectedRosterId);

    // If manual name typed, create new roster entry
    if ((manualFirstName.trim() || manualLastInitial.trim()) && !selectedRosterId) {
      let fName = manualFirstName.trim();
      let lInitial = manualLastInitial.trim();

      // If user typed space-separated full name into first name field and left last initial blank
      if (fName.includes(' ') && !lInitial) {
        const parts = fName.split(' ');
        fName = parts[0];
        lInitial = parts.slice(1).join(' ');
      }
      lInitial = lInitial ? lInitial.charAt(0).toUpperCase() : '';

      const newMemberData = {
        troop_id: troopId,
        first_name: fName,
        last_initial: lInitial,
        tlc_id: unknownPayload.tlcId
      };
      if (unknownPayload.memberId && unknownPayload.memberId !== unknownPayload.tlcId) {
        newMemberData.member_id = unknownPayload.memberId;
      }

      const { data, error } = await supabase
        .from('roster')
        .insert([newMemberData])
        .select()
        .single();

      if (!error && data) {
        targetRosterId = data.id;
        targetMember = data;
        setRoster(prev => [...prev, data]);
      }
    } else if (selectedRosterId) {
      // Update existing roster with tlc_id and member_id if available
      const updateData = { tlc_id: unknownPayload.tlcId };
      if (unknownPayload.memberId && unknownPayload.memberId !== unknownPayload.tlcId) {
        updateData.member_id = unknownPayload.memberId;
      }

      await supabase.from('roster').update(updateData).eq('id', selectedRosterId);
      setRoster(prev => prev.map(m => m.id === selectedRosterId ? { ...m, ...updateData } : m));
    }

    // Now insert the scan
    if (targetRosterId) {
      const { data } = await supabase.from('scans').insert([{ session_id: session.id, roster_id: targetRosterId, status: 'pending', scanned_by: user.id }]).select();
      if (data) {
        setAttendance(prev => {
          if (prev.some(item => item.roster_id === targetRosterId || item.member?.id === targetRosterId)) {
            return prev;
          }
          return [
            { id: data[0].id, roster_id: targetRosterId, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), status: 'success', message: 'Scanned In', member: targetMember },
            ...prev
          ];
        });
      }
    }

    // Resume
    setUnknownPayload(null);
    setManualFirstName('');
    setManualLastInitial('');
    setSelectedRosterId('');
    if (qrEngineRef.current?.getState() === 3) { // 3 = PAUSED
      qrEngineRef.current.resume();
    }
    if (resolveUnknownRef.current) {
      resolveUnknownRef.current();
      resolveUnknownRef.current = null;
    }
  };

  // Audio helpers
  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Synthetic "camera shutter / click" sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  };
  const playErrorSound = () => { /* Add buzzer audio logic here */ };
  const playWarningSound = () => {
    try {
      const audio = new Audio('/uh-oh.mp3');
      audio.play().catch(e => console.warn('Audio play failed', e));
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  };

  const exportOffline = () => {
    const offline = localStorage.getItem('tlc_offline_scans');
    if (!offline) return addToast({ type: 'warning', message: 'No offline scans to export.' });

    // Create CSV blob and download
    const blob = new Blob([offline], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offline-scans-${new Date().toISOString()}.json`;
    a.click();
    addToast({ type: 'success', message: 'Exported offline scans.' });
  };

  const handleManualEntry = async (e) => {
    e.preventDefault();
    if (!manualEntryRosterId && (!manualEntryFirstName.trim() && !manualEntryLastInitial.trim())) return;

    let targetRosterId = manualEntryRosterId;
    let targetMember = roster.find(m => m.id === manualEntryRosterId);

    if ((manualEntryFirstName.trim() || manualEntryLastInitial.trim()) && !manualEntryRosterId) {
      let fName = manualEntryFirstName.trim();
      let lInitial = manualEntryLastInitial.trim();

      if (fName.includes(' ') && !lInitial) {
        const parts = fName.split(' ');
        fName = parts[0];
        lInitial = parts.slice(1).join(' ');
      }
      lInitial = lInitial ? lInitial.charAt(0).toUpperCase() : '';

      const newMemberData = {
        troop_id: troopId,
        first_name: fName,
        last_initial: lInitial
      };

      const { data, error } = await supabase
        .from('roster')
        .insert([newMemberData])
        .select()
        .single();

      if (!error && data) {
        targetRosterId = data.id;
        targetMember = data;
        setRoster(prev => [...prev, data]);
      }
    }

    if (targetRosterId) {
      if (attendance.some(item => item.roster_id === targetRosterId || item.member?.id === targetRosterId)) {
        addToast({ type: 'warning', message: 'This person is already marked as scanned in.' });
        return;
      }
      const { data } = await supabase.from('scans').insert([{ session_id: session.id, roster_id: targetRosterId, status: 'pending', scanned_by: user.id }]).select();
      if (data) {
        setAttendance(prev => {
          return [
            { id: data[0].id, roster_id: targetRosterId, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), status: 'success', message: 'Scanned In', member: targetMember },
            ...prev
          ];
        });
        playSuccessSound();
      }
    }

    setIsManualEntryOpen(false);
    setManualEntryFirstName('');
    setManualEntryLastInitial('');
    setManualEntryRosterId('');
  };

  const membersWithoutIds = roster.filter(m => !m.member_id);
  const isAdminOrLeader = isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin';

  if (!troopId) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card scan-empty-state">
          <h2>No Troop Selected</h2>
          <p>Please select a troop in the Dashboard first.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', flex: 1 }}>
      {!session ? (
        <div style={{ padding: 'var(--spacing-lg)', maxWidth: '800px', margin: '0 auto', width: '100%' }} className="glass-card">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 className="app-title" style={{ margin: 0 }}>Attendance Scanner</h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <ThemeToggle />
              {isAdminOrLeader && (
                <a href="#/dashboard" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>&larr; Back to Dashboard</a>
              )}
            </div>
          </header>
          <SessionSelector troopId={troopId} onSessionSelect={setSession} />
        </div>
      ) : (
        <>
          {/* Top Status Bar */}
          <div className="glass-card" style={{ padding: 'var(--spacing-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
            <div>
              <h2 className="app-title" style={{ fontSize: '1.2rem', margin: 0 }}>{session.event_name}</h2>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span className={`badge ${session.ended_at ? 'badge-error' : 'badge-success'}`}>
                  {session.ended_at ? 'Ended' : 'Active'}
                </span>
                <span className={`badge ${session.synced_at ? 'badge-neutral' : 'badge-warning'}`}>
                  {session.synced_at ? 'Synced' : 'Unsynced'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="badge badge-pending" title="Offline Queue">{attendance.filter(s => s.message === 'Saved Offline').length}</span>
              {isAdminOrLeader && !session.ended_at && (
                <button onClick={handleEndSession} className="btn btn-destructive" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                  End Session
                </button>
              )}
              <button onClick={() => setSession(null)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                Change
              </button>
            </div>
          </div>

          {/* Camera Viewfinder (Top Half) */}
          <div className="scanner-viewfinder" style={{ flex: isTableVisible ? '0 0 45%' : '1', minHeight: 0 }}>
            {!session.ended_at ? (
              <>
                <div id="qr-reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}></div>
                {showCheckmark && (
                  <div className="scan-overlay scan-overlay--success">
                    <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '50%', padding: '1rem', display: 'flex', boxShadow: 'var(--glass-shadow)' }}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  </div>
                )}
                {showWarning && (
                  <div className="scan-overlay scan-overlay--warning">
                    <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '50%', padding: '1rem', display: 'flex', boxShadow: 'var(--glass-shadow)' }}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--foreground)' }}>
                <h2>Session Ended</h2>
                <p>No further scans can be recorded.</p>
                {isAdminOrLeader && (
                  session.synced_at ? (
                    <button onClick={handleResetSyncSession} className="btn btn-action" style={{ marginTop: 'var(--spacing-md)' }}>Reset Sync Status</button>
                  ) : (
                    <button onClick={handleReenableSession} className="btn btn-primary" style={{ marginTop: 'var(--spacing-md)' }}>Reenable Session</button>
                  )
                )}
              </div>
            )}
          </div>
          {/* Action Bar — sits between viewfinder and the Recent Scans panel */}
          {!session.ended_at && (
            <div className="scanner-action-bar" style={{ gridTemplateColumns: '1fr 1fr 1fr', flexShrink: 0 }}>
              <button
                onClick={isScanning ? stopScanner : startScanner}
                className={`btn ${isScanning ? 'btn-destructive' : 'btn-primary'}`}
                style={{ padding: 'var(--spacing-lg) var(--spacing-md)', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
              >
                {isScanning ? '⏹ Stop Scan' : '📷 Start Scan'}
              </button>
              <div style={{ position: 'relative', overflow: 'hidden', display: 'flex' }}>
                <button className="btn btn-secondary" style={{ width: '100%', padding: 'var(--spacing-lg) var(--spacing-md)', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                  📁 Load Photos
                </button>
                <input type="file" multiple accept="image/*" onChange={handleBulkPhotos} style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setIsManualEntryOpen(true)}
                style={{ padding: 'var(--spacing-lg) var(--spacing-md)', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
              >
                ✏️ Manual Entry
              </button>
            </div>
          )}

          {/* Inline Table & Collapsible Panel */}
          <div style={{ flex: isTableVisible ? 1 : 'none', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', transition: 'flex 0.3s cubic-bezier(0.4, 0, 0.2, 1)', minHeight: 0, flexShrink: 0 }}>

            {/* Interactive Header to Toggle Table */}
            <div
              className="scanner-panel-header glass-card"
              onClick={() => setIsTableVisible(!isTableVisible)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Attendance</h3>
                <span className="badge badge-success">{attendance.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isAdminOrLeader && (
                  <label onClick={(e) => e.stopPropagation()} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="checkbox" onChange={handleSelectAll} checked={attendance.length > 0 && selectedScans.size === attendance.filter(s => s.id && !String(s.id).startsWith('temp-')).length} />
                    All
                  </label>
                )}
                <button className="btn" style={{ background: 'transparent', padding: '4px 8px' }}>
                  {isTableVisible ? '⌄ Collapse' : '⌃ Expand'}
                </button>
              </div>
            </div>

            {/* Scrollable list inside table - Animated Wrapper */}
            <div style={{
              display: 'grid',
              gridTemplateRows: isTableVisible ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              flex: isTableVisible ? 1 : 'none',
              minHeight: 0
            }}>
              <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--spacing-md)' }}>
                  {attendance.length === 0 ? (
                    <div className="glass-card scan-empty-state" style={{ marginTop: 'var(--spacing-md)' }}>
                      <p>No people scanned in yet.</p>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '1rem' }}>
                      <tbody>
                        {attendance.map((scan) => (
                          <tr key={scan.id} id={`scan-row-${scan.id}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            {(isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin') && (
                              <td style={{ padding: '0.75rem', width: '40px' }}>
                                {scan.id && !String(scan.id).startsWith('temp-') && (
                                  <input
                                    type="checkbox"
                                    checked={selectedScans.has(scan.id)}
                                    onChange={() => handleToggleSelect(scan.id)}
                                  />
                                )}
                              </td>
                            )}
                            <td style={{ padding: '0.75rem' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>{scan.member ? `${scan.member.first_name} ${scan.member.last_initial}` : 'Unknown'}</strong>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <span className={`badge badge-${scan.status === 'success' ? 'success' : scan.status === 'duplicate' ? 'warning' : 'error'}`}>
                                {scan.message}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{scan.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Selected items actions */}
            {isAdminOrLeader && selectedScans.size > 0 && (
              <div style={{ padding: '0.5rem var(--spacing-md)', background: 'color-mix(in srgb, var(--color-error) 15%, transparent)', borderTop: '1px solid color-mix(in srgb, var(--color-error) 30%, transparent)', color: 'var(--color-error)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span>{selectedScans.size} selected</span>
                <button onClick={handleBulkRemove} className="btn btn-destructive" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Unknown Member Modal using our new common Modal */}
      <Modal
        isOpen={!!unknownPayload}
        onClose={() => {
          setUnknownPayload(null);
          if (qrEngineRef.current?.getState() === 3) qrEngineRef.current.resume();
          if (resolveUnknownRef.current) {
            resolveUnknownRef.current();
            resolveUnknownRef.current = null;
          }
        }}
        title="Unknown Member"
      >
        {(() => {
          const displayMemberId = typeof unknownPayload === 'object'
            ? (unknownPayload?.memberId || unknownPayload?.tlcId || '')
            : (unknownPayload || '');
          const displayTlcId = typeof unknownPayload === 'object'
            ? (unknownPayload?.tlcId || unknownPayload?.memberId || '')
            : (unknownPayload || '');

          return (
            <div>
              <p style={{ marginBottom: displayMemberId ? '0.5rem' : '1rem' }}>This badge is not recognized.</p>
              {displayMemberId && (
                <p style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
                  Member ID:{' '}
                  <a
                    href={`https://www.traillifeconnect.com/profile/${displayTlcId}?tab=print-id-card`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    {displayMemberId}
                  </a>
                </p>
              )}
              <form onSubmit={handleResolveUnknown}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  {/* Left: Existing members selection list */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Select Existing Member (no ID):
                    </label>
                    <div
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        maxHeight: '240px',
                        minHeight: '120px',
                        overflowY: 'auto',
                        backgroundColor: 'var(--bg-secondary)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {membersWithoutIds.length === 0 ? (
                        <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', margin: 'auto' }}>
                          No members without an ID found.
                        </div>
                      ) : (
                        membersWithoutIds.map(m => {
                          const isSelected = selectedRosterId === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedRosterId('');
                                } else {
                                  setSelectedRosterId(m.id);
                                  setManualFirstName('');
                                  setManualLastInitial('');
                                }
                              }}
                              style={{
                                padding: '0.6rem 0.8rem',
                                textAlign: 'left',
                                backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                                color: isSelected ? 'var(--bg-primary)' : 'inherit',
                                border: 'none',
                                borderBottom: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                fontWeight: isSelected ? 600 : 400,
                                transition: 'background-color 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexShrink: 0
                              }}
                            >
                              <span>{m.first_name} {m.last_initial}</span>
                              {isSelected && <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>✓</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Add new member inputs */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Or Add New Member:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input
                        type="text"
                        placeholder="First Name"
                        value={manualFirstName}
                        onChange={e => { setManualFirstName(e.target.value); setSelectedRosterId(''); }}
                        style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                      />
                      <input
                        type="text"
                        placeholder="Last Initial"
                        maxLength={1}
                        value={manualLastInitial}
                        onChange={e => { setManualLastInitial(e.target.value); setSelectedRosterId(''); }}
                        style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                      />
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4' }}>
                  Due to browser security, we cannot automatically fetch names from Trail Life Connect. Please select the member or enter their name.
                </p>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Link & Save Scan</button>
                  <button type="button" onClick={() => {
                    setUnknownPayload(null);
                    if (qrEngineRef.current?.getState() === 3) qrEngineRef.current.resume();
                    if (resolveUnknownRef.current) {
                      resolveUnknownRef.current();
                      resolveUnknownRef.current = null;
                    }
                  }} className="btn btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          );
        })()}
      </Modal>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={isManualEntryOpen}
        onClose={() => {
          setIsManualEntryOpen(false);
          setManualEntryFirstName('');
          setManualEntryLastInitial('');
          setManualEntryRosterId('');
        }}
        title="Manual Entry"
      >
        <form onSubmit={handleManualEntry}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Select Member:
              </label>
              <div
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  maxHeight: '240px',
                  minHeight: '120px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {roster.length === 0 ? (
                  <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', margin: 'auto' }}>
                    No members found.
                  </div>
                ) : (
                  [...roster]
                    .sort((a, b) => {
                      const nameA = `${a.first_name || ''} ${a.last_initial || ''}`.toLowerCase();
                      const nameB = `${b.first_name || ''} ${b.last_initial || ''}`.toLowerCase();
                      return nameA.localeCompare(nameB);
                    })
                    .map(m => {
                      const isSelected = manualEntryRosterId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setManualEntryRosterId('');
                          } else {
                            setManualEntryRosterId(m.id);
                            setManualEntryFirstName('');
                            setManualEntryLastInitial('');
                          }
                        }}
                        style={{
                          padding: '0.6rem 0.8rem',
                          textAlign: 'left',
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                          color: isSelected ? 'var(--bg-primary)' : 'inherit',
                          border: 'none',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                          fontWeight: isSelected ? 600 : 400,
                          transition: 'background-color 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexShrink: 0
                        }}
                      >
                        <span>{m.first_name} {m.last_initial}</span>
                        {isSelected && <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Or Add Guest/New:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="First Name"
                  value={manualEntryFirstName}
                  onChange={e => { setManualEntryFirstName(e.target.value); setManualEntryRosterId(''); }}
                  style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                />
                <input
                  type="text"
                  placeholder="Last Initial"
                  maxLength={1}
                  value={manualEntryLastInitial}
                  onChange={e => { setManualEntryLastInitial(e.target.value); setManualEntryRosterId(''); }}
                  style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!manualEntryRosterId && (!manualEntryFirstName.trim() && !manualEntryLastInitial.trim())}>Save Scan</button>
            <button type="button" onClick={() => setIsManualEntryOpen(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>

    </div>

  );
}
