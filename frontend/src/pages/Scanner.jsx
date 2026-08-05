import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { SessionSelector } from '../components/SessionSelector';
import { useScanLogic } from '../hooks/useScanLogic';
import { ThemeToggle } from '../components/ThemeToggle';

export function Scanner() {
  const { user } = useAuth();
  const [troopId, setTroopId] = useState('');
  const [session, setSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedScans, setSelectedScans] = useState(new Set());
  const [scannerStatus, setScannerStatus] = useState('Idle');
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

  useEffect(() => {
    if (session) {
      fetchAttendance();
    }
  }, [session]);

  async function fetchAttendance() {
    if (!session) return;
    const { data, error } = await supabase
      .from('scans')
      .select(`*, roster (id, first_name, last_initial, member_id, tlc_id)`)
      .eq('session_id', session.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
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
            time: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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
    if (window.confirm("Are you sure you want to end this session? No more scans can be recorded after ending.")) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('sessions').update({ ended_at: now }).eq('id', session.id);
      if (error) {
        alert("Failed to end session: " + error.message);
        return;
      }

      // Approve all pending scans so they are visible to the sync extension
      const { error: scansError } = await supabase
        .from('scans')
        .update({ status: 'approved' })
        .eq('session_id', session.id)
        .eq('status', 'pending');
      if (scansError) {
        alert("Session ended, but failed to approve scans: " + scansError.message);
      }

      setSession({ ...session, ended_at: now });
      await stopScanner();
    }
  };

  const handleReenableSession = async () => {
    if (window.confirm("Are you sure you want to reenable this session?")) {
      const { error } = await supabase.from('sessions').update({ ended_at: null }).eq('id', session.id);
      if (error) {
        alert("Failed to reenable session: " + error.message);
      } else {
        setSession({ ...session, ended_at: null });
      }
    }
  };

  const handleResetSyncSession = async () => {
    if (window.confirm("Are you sure you want to reset the sync status for this session? This will mark it as not synced so it can be synced again.")) {
      const { error } = await supabase
        .from('sessions')
        .update({ synced_at: null, synced_by: null, purge_after: null })
        .eq('id', session.id);
      if (error) {
        alert("Error resetting sync status: " + error.message);
      } else {
        setSession({ ...session, synced_at: null, synced_by: null, purge_after: null });
      }
    }
  };

  const handleBulkRemove = async () => {
    if (selectedScans.size === 0) return;
    if (!window.confirm(`Are you sure you want to remove ${selectedScans.size} scan(s)?`)) return;

    const idsToRemove = Array.from(selectedScans);
    
    // Delete from DB
    const { error } = await supabase
      .from('scans')
      .delete()
      .in('id', idsToRemove);

    if (error) {
      alert("Failed to remove scans: " + error.message);
    } else {
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
      setScannerStatus('Camera Active - Ready to scan');
    } catch (err) {
      console.error(err);
      setScannerStatus('Failed to start camera');
    }
  };

  const stopScanner = async () => {
    if (qrEngineRef.current && qrEngineRef.current.getState() === 2) {
      await qrEngineRef.current.stop();
      setScannerStatus('Camera Stopped');
    }
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
    if (!offline) return alert('No offline scans to export.');

    // Create CSV blob and download
    const blob = new Blob([offline], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offline-scans-${new Date().toISOString()}.json`;
    a.click();
  };

  const membersWithoutIds = roster.filter(m => !m.member_id);

  if (!troopId) {
    return <div style={{ padding: '2rem' }}>Please select a troop in the Dashboard first.</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'var(--foreground)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Attendance Scanner</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ThemeToggle />
          <a href="#/dashboard" style={{ color: 'var(--color-primary)' }}>&larr; Back to Dashboard</a>
        </div>
      </header>

      {!session ? (
        <SessionSelector troopId={troopId} onSessionSelect={setSession} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Status Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--glass-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div>
              <strong>Active Session:</strong> {session.event_name}
              {session.ended_at && <span style={{ marginLeft: '1rem', color: 'var(--color-warning)', fontWeight: 'bold' }}>(Ended)</span>}
              <button onClick={() => setSession(null)} style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Change</button>
              {(isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin') && !session.ended_at && (
                <button
                  onClick={handleEndSession}
                  style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', backgroundColor: 'var(--color-error)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  End Session
                </button>
              )}
            </div>
            <div>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)' }}>{scannerStatus}</span>
            </div>
          </div>

          {/* Scanner Viewfinder */}
          {!session.ended_at ? (
            <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px', backgroundColor: '#000' }}>
              <div id="qr-reader" style={{ width: '100%' }}></div>
              {showCheckmark && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 255, 0, 0.1)', zIndex: 10 }}>
                  <div style={{ backgroundColor: 'white', borderRadius: '50%', padding: '1rem', display: 'flex', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
              )}
              {showWarning && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 165, 0, 0.1)', zIndex: 10 }}>
                  <div style={{ backgroundColor: 'white', borderRadius: '50%', padding: '1rem', display: 'flex', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <h2>This session has been ended.</h2>
              <p style={{ color: 'var(--muted-foreground)' }}>No further scans can be recorded.</p>
              {(isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin') && (
                session.synced_at ? (
                  <button
                    onClick={handleResetSyncSession}
                    style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', backgroundColor: '#eab308', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Reset Sync Status
                  </button>
                ) : (
                  <button
                    onClick={handleReenableSession}
                    style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Reenable Session
                  </button>
                )
              )}
            </div>
          )}

          {/* Controls */}
          {!session.ended_at && (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={startScanner} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-primary)', color: 'white' }}>Start Camera</button>
              <button onClick={stopScanner} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#555', color: 'white' }}>Stop Camera</button>

              <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                <button style={{ padding: '0.75rem 1.5rem', backgroundColor: '#333', color: 'white' }}>Select Photos</button>
                <input type="file" multiple accept="image/*" onChange={handleBulkPhotos} style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
              </div>

              <button onClick={exportOffline} style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--glass-bg)', color: 'var(--foreground)', border: '1px solid var(--glass-border)' }}>Export Offline Scans</button>
            </div>
          )}

          {progressText && <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{progressText}</div>}

          {/* Unknown Member Modal */}
          {unknownPayload && (() => {
            const displayMemberId = typeof unknownPayload === 'object'
              ? (unknownPayload?.memberId || unknownPayload?.tlcId || '')
              : (unknownPayload || '');
            const displayTlcId = typeof unknownPayload === 'object'
              ? (unknownPayload?.tlcId || unknownPayload?.memberId || '')
              : (unknownPayload || '');

            return (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ backgroundColor: 'var(--background)', padding: '2rem', borderRadius: '8px', maxWidth: '650px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                  <h2 style={{ color: 'var(--color-error)', marginTop: 0 }}>Unknown Member</h2>
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
                            border: '1px solid var(--glass-border, #ccc)',
                            borderRadius: '6px',
                            maxHeight: '240px',
                            minHeight: '120px',
                            overflowY: 'auto',
                            backgroundColor: 'var(--glass-bg, rgba(0,0,0,0.05))',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          {membersWithoutIds.length === 0 ? (
                            <div style={{ padding: '1rem', color: 'var(--muted-foreground)', fontSize: '0.9rem', textAlign: 'center', margin: 'auto' }}>
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
                                    backgroundColor: isSelected ? 'var(--color-primary, #0066cc)' : 'transparent',
                                    color: isSelected ? '#fff' : 'inherit',
                                    border: 'none',
                                    borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.1))',
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
                            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
                          />
                          <input
                            type="text"
                            placeholder="Last Initial"
                            maxLength={1}
                            value={manualLastInitial}
                            onChange={e => { setManualLastInitial(e.target.value); setSelectedRosterId(''); }}
                            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground, #888)', marginTop: '0.75rem', lineHeight: '1.4' }}>
                        Due to browser security, we cannot automatically fetch names from Trail Life Connect. Please select the member or enter their name.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button type="submit" style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-primary)', color: 'white' }}>Link & Save Scan</button>
                      <button type="button" onClick={() => { 
                        setUnknownPayload(null); 
                        if (qrEngineRef.current?.getState() === 2) qrEngineRef.current.resume(); 
                        if (resolveUnknownRef.current) {
                          resolveUnknownRef.current();
                          resolveUnknownRef.current = null;
                        }
                      }} style={{ padding: '0.75rem' }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })()}

          {/* Scanned In People */}
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Scanned In ({attendance.length})</h3>
              {(isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin') && selectedScans.size > 0 && (
                <button
                  onClick={handleBulkRemove}
                  style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-error)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Remove Selected ({selectedScans.size})
                </button>
              )}
            </div>
            
            <div style={{ overflowX: 'auto', backgroundColor: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                    {(isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin') && (
                      <th style={{ padding: '1rem', width: '40px' }}>
                        <input 
                          type="checkbox" 
                          checked={attendance.filter(s => s.id && !String(s.id).startsWith('temp-')).length > 0 && selectedScans.size === attendance.filter(s => s.id && !String(s.id).startsWith('temp-')).length}
                          onChange={handleSelectAll} 
                        />
                      </th>
                    )}
                    <th style={{ padding: '1rem' }}>Name</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                    <th style={{ padding: '1rem' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>No people scanned in yet for this session.</td>
                    </tr>
                  ) : (
                    attendance.map((scan) => (
                      <tr key={scan.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        {(isGlobalAdmin || currentUserRole === 'troop_admin' || currentUserRole === 'billing_admin') && (
                          <td style={{ padding: '1rem' }}>
                            {scan.id && !String(scan.id).startsWith('temp-') && (
                              <input 
                                type="checkbox" 
                                checked={selectedScans.has(scan.id)}
                                onChange={() => handleToggleSelect(scan.id)} 
                              />
                            )}
                          </td>
                        )}
                        <td style={{ padding: '1rem' }}>
                          <strong>{scan.member ? `${scan.member.first_name} ${scan.member.last_initial}` : 'Unknown'}</strong>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ 
                            color: scan.status === 'success' ? 'var(--color-success)' : scan.status === 'duplicate' ? 'var(--color-warning)' : 'var(--color-error)',
                            fontWeight: 'bold'
                          }}>
                            {scan.message}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--muted-foreground)' }}>
                          {scan.time}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
