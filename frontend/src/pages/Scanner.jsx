import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useScanLogic } from '../hooks/useScanLogic';
import { useConfirm } from '../components/common/ConfirmContext';
import { useToast } from '../components/common/ToastContext';
import { Modal } from '../components/common/Modal';
import { FilterPopover } from '../components/common/FilterPopover';
import { formatAppDate } from '../utils/date';

export function Scanner() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';
  const storageKey = `tlc_scanner_filters_${userId}`;

  const [troopId, setTroopId] = useState('');
  const [session, setSession] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [roster, setRoster] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedScans, setSelectedScans] = useState(new Set());
  const [recentlyScannedIds, setRecentlyScannedIds] = useState(new Set());
  const [scannerStatus, setScannerStatus] = useState('Idle');
  const [isScanning, setIsScanning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showOfflineInfo, setShowOfflineInfo] = useState(false);
  const scannerContainerRef = useRef(null);
  const statusMenuRef = useRef(null);
  const offlineInfoRef = useRef(null);

  // Auto-close popovers when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
        setShowStatusMenu(false);
      }
      if (offlineInfoRef.current && !offlineInfoRef.current.contains(event.target)) {
        setShowOfflineInfo(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Table Filter, Sort & Column Resizing states
  const [activePopover, setActivePopover] = useState(null);
  const defaultSort = { key: 'time', direction: 'desc' };
  const defaultFilters = { name: [], status: [], time: [] };
  const defaultColumnWidths = useMemo(() => ({
    name: 2.5,
    status: 1.0,
    time: 1.0,
    actions: 0.8
  }), []);

  const [sortConfig, setSortConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sortConfig) return parsed.sortConfig;
      }
    } catch (e) {
      console.warn('Failed to load saved sort config', e);
    }
    return defaultSort;
  });

  const [columnFilters, setColumnFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.columnFilters) return { ...defaultFilters, ...parsed.columnFilters };
      }
    } catch (e) {
      console.warn('Failed to load saved column filters', e);
    }
    return defaultFilters;
  });

  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.columnWidths) return { ...defaultColumnWidths, ...parsed.columnWidths };
      }
    } catch (e) {
      console.warn('Failed to load saved column widths', e);
    }
    return defaultColumnWidths;
  });

  // Persist table settings
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sortConfig, columnFilters, columnWidths }));
    } catch (e) {
      console.warn('Failed to persist table state', e);
    }
  }, [sortConfig, columnFilters, columnWidths, storageKey]);

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
  const headerRef = useRef(null);
  const { handleScan } = useScanLogic(troopId, session?.id, user, roster, setRoster);

  // Fetch Event details by eventId
  useEffect(() => {
    async function loadEvent() {
      if (!eventId) {
        setLoadingEvent(false);
        return;
      }
      setLoadingEvent(true);
      let { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (error && (error.code === '42P01' || error.message?.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .select('*')
          .eq('id', eventId)
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (!error && data) {
        setSession(data);
        if (data.troop_id) {
          setTroopId(data.troop_id);
          fetchRoster(data.troop_id);
          fetchUserRole(data.troop_id);
        }
      } else {
        addToast({ type: 'error', message: 'Event not found.' });
        navigate('/events');
      }
      setLoadingEvent(false);
    }
    loadEvent();
  }, [eventId, user]);

  useEffect(() => {
    if (session) {
      fetchAttendance();
    }
  }, [session?.id]);

  const triggerRowHighlight = (id) => {
    setRecentlyScannedIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setRecentlyScannedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  };

  async function fetchAttendance() {
    if (!session) return;
    let { data, error } = await supabase
      .from('scans')
      .select(`*, roster (id, first_name, last_initial, member_id, tlc_id)`)
      .eq('event_id', session.id)
      .order('scan_time', { ascending: false });

    if (error && (error.code === 'PGRST204' || error.message?.includes('event_id'))) {
      const res = await supabase
        .from('scans')
        .select(`*, roster (id, first_name, last_initial, member_id, tlc_id)`)
        .eq('session_id', session.id)
        .order('scan_time', { ascending: false });
      data = res.data;
      error = res.error;
    }
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
            time: new Date(s.scan_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
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
    const { data: globalAdmin } = await supabase.from('global_admins').select('id').eq('user_id', user.id).maybeSingle();
    if (globalAdmin) setIsGlobalAdmin(true);

    const { data } = await supabase.from('troop_users').select('role').eq('troop_id', tId).eq('user_id', user.id).maybeSingle();
    if (data) setCurrentUserRole(data.role);
  }

  useEffect(() => {
    return () => {
      if (qrEngineRef.current) {
        const state = qrEngineRef.current.getState();
        if (state === 2 || state === 3) {
          qrEngineRef.current.stop().catch(console.error);
        }
      }
    };
  }, []);

  // Pause camera when scrolled out of viewport
  useEffect(() => {
    if (loadingEvent || !scannerContainerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (qrEngineRef.current) {
          const state = qrEngineRef.current.getState();
          // state 2 = SCANNING, state 3 = PAUSED
          if (!entry.isIntersecting && state === 2) {
            console.log('[Camera Observer] Pausing camera (scrolled out of view)');
            try {
              qrEngineRef.current.pause(true);
              setScannerStatus('Camera Paused (Out of view)');
            } catch (e) {
              console.warn('[Camera Observer] Failed to pause camera:', e);
            }
          } else if (entry.isIntersecting && state === 3) {
            console.log('[Camera Observer] Resuming camera (scrolled into view)');
            try {
              qrEngineRef.current.resume();
              setScannerStatus('Camera Active - Ready to scan');
            } catch (e) {
              console.warn('[Camera Observer] Failed to resume camera:', e);
            }
          }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(scannerContainerRef.current);
    return () => observer.disconnect();
  }, [loadingEvent]);

  // Auto-scroll to camera viewfinder when scanning starts
  useEffect(() => {
    if (isScanning && scannerContainerRef.current) {
      setTimeout(() => {
        scannerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [isScanning]);

  async function fetchRoster(tId) {
    const { data } = await supabase.from('roster').select('*').eq('troop_id', tId);
    if (data) setRoster(data);
  }

  const handleEndSession = async () => {
    if (await confirm({ title: 'End Event', message: 'Are you sure you want to end this event? No more scans can be recorded after ending.', isDestructive: true })) {
      const now = new Date().toISOString();
      let { error } = await supabase.from('events').update({ ended_at: now }).eq('id', session.id);
      if (error && (error.code === '42P01' || error.message?.includes('events'))) {
        const res = await supabase.from('sessions').update({ ended_at: now }).eq('id', session.id);
        error = res.error;
      }
      if (error) {
        addToast({ type: 'error', message: "Failed to end event: " + error.message });
        return;
      }

      let { error: scansError } = await supabase
        .from('scans')
        .update({ status: 'approved' })
        .eq('event_id', session.id)
        .eq('status', 'pending');
      if (scansError && (scansError.code === 'PGRST204' || scansError.message?.includes('event_id'))) {
        const res = await supabase
          .from('scans')
          .update({ status: 'approved' })
          .eq('session_id', session.id)
          .eq('status', 'pending');
        scansError = res.error;
      }
      if (scansError) {
        addToast({ type: 'warning', message: "Event ended, but failed to approve scans: " + scansError.message });
      } else {
        addToast({ type: 'success', message: "Event ended and scans approved." });
      }

      setSession({ ...session, ended_at: now });
      await stopScanner();
    }
  };

  const handleReenableSession = async () => {
    if (await confirm({ title: 'Reenable Event', message: "Are you sure you want to reenable this event?" })) {
      let { error } = await supabase.from('events').update({ ended_at: null }).eq('id', session.id);
      if (error && (error.code === '42P01' || error.message?.includes('events'))) {
        const res = await supabase.from('sessions').update({ ended_at: null }).eq('id', session.id);
        error = res.error;
      }
      if (error) {
        addToast({ type: 'error', message: "Failed to reenable event: " + error.message });
      } else {
        addToast({ type: 'success', message: "Event reenabled." });
        setSession({ ...session, ended_at: null });
      }
    }
  };

  const handleResetSyncSession = async () => {
    if (await confirm({ title: 'Reset Sync Status', message: "Are you sure you want to reset the sync status for this event? This will mark it as not synced so it can be synced again." })) {
      let { error } = await supabase
        .from('events')
        .update({ synced_at: null, synced_by: null, purge_after: null })
        .eq('id', session.id);
      if (error && (error.code === '42P01' || error.message?.includes('events'))) {
        const res = await supabase
          .from('sessions')
          .update({ synced_at: null, synced_by: null, purge_after: null })
          .eq('id', session.id);
        error = res.error;
      }
      if (error) {
        addToast({ type: 'error', message: "Error resetting sync status: " + error.message });
      } else {
        addToast({ type: 'success', message: "Sync status reset." });
        setSession({ ...session, synced_at: null, synced_by: null, purge_after: null });
      }
    }
  };

  const handleDeleteSession = async () => {
    if (await confirm({ title: 'Delete Event', message: 'Are you sure you want to delete this event? This will also delete all associated scans and cannot be undone.', isDestructive: true })) {
      let { error } = await supabase.from('events').delete().eq('id', session.id);
      if (error && (error.code === '42P01' || error.message?.includes('events'))) {
        const res = await supabase.from('sessions').delete().eq('id', session.id);
        error = res.error;
      }
      if (error) {
        addToast({ type: 'error', message: 'Error deleting event: ' + error.message });
      } else {
        addToast({ type: 'success', message: 'Event deleted' });
        await stopScanner();
        navigate('/events');
      }
    }
  };

  const handleBulkRemove = async () => {
    if (selectedScans.size === 0) return;
    if (!(await confirm({ title: 'Remove Scans', message: `Are you sure you want to remove ${selectedScans.size} scan(s)?`, isDestructive: true }))) return;

    const idsToRemove = Array.from(selectedScans);
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

  const handleDeleteSingleScan = async (scanId) => {
    if (await confirm({ title: 'Remove Scan', message: 'Are you sure you want to remove this scan?', isDestructive: true })) {
      const { error } = await supabase.from('scans').delete().eq('id', scanId);
      if (error) {
        addToast({ type: 'error', message: 'Failed to remove scan: ' + error.message });
      } else {
        addToast({ type: 'success', message: 'Scan removed.' });
        setAttendance(prev => prev.filter(s => s.id !== scanId));
        setSelectedScans(prev => {
          const next = new Set(prev);
          next.delete(scanId);
          return next;
        });
      }
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
      setSelectedScans(new Set(processedAttendance.filter(s => s.id && !String(s.id).startsWith('temp-')).map(s => s.id)));
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
          if (qrEngineRef.current?.getState() === 2) qrEngineRef.current.pause(true);
          playErrorSound();
          setUnknownPayload(result.payload);
          resolveUnknownRef.current = resolve;
        } else {
          if (result.status === 'success' || result.status === 'offline_queued') {
            playSuccessSound();
            setShowCheckmark(true);

            if (qrEngineRef.current?.getState() === 2) {
              qrEngineRef.current.pause(true);
            }

            setTimeout(() => {
              setShowCheckmark(false);
              if (qrEngineRef.current?.getState() === 3 && result.status !== 'unknown' && !unknownPayload) {
                qrEngineRef.current.resume();
              }
            }, 2000);
          } else if (result.status === 'duplicate') {
            playWarningSound();
            setShowWarning(true);

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

          if ((result.status === 'success' || result.status === 'offline_queued') && result.member) {
            setAttendance(prev => {
              const rId = result.member.id;
              if (prev.some(item => item.roster_id === rId || item.member?.id === rId)) {
                return prev;
              }
              const newId = result.scanRecord ? result.scanRecord.id : 'temp-' + Date.now();
              triggerRowHighlight(newId);
              const newEntry = {
                id: newId,
                roster_id: rId,
                member: result.member,
                time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                status: 'success',
                message: result.status === 'offline_queued' ? 'Saved Offline' : 'Scanned In'
              };
              return [newEntry, ...prev];
            });
          }

          resolve();
        }
      });
    });
  };

  const handleBulkPhotos = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await stopScanner();

    if (!qrEngineRef.current) {
      qrEngineRef.current = new Html5Qrcode('qr-reader', { verbose: false });
    }

    setScannerStatus('Processing Photos...');
    for (let i = 0; i < files.length; i++) {
      setProgressText(`Processing ${i + 1} of ${files.length}...`);
      try {
        const text = await qrEngineRef.current.scanFile(files[i], false);
        await processPayload(text);
      } catch (err) {
        setAttendance(prev => [
          { id: 'temp-' + Date.now(), member: null, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), status: 'error', message: 'No QR found in image' },
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

    if ((manualFirstName.trim() || manualLastInitial.trim()) && !selectedRosterId) {
      let fName = manualFirstName.trim();
      let lInitial = manualLastInitial.trim();

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
      const updateData = { tlc_id: unknownPayload.tlcId };
      if (unknownPayload.memberId && unknownPayload.memberId !== unknownPayload.tlcId) {
        updateData.member_id = unknownPayload.memberId;
      }

      await supabase.from('roster').update(updateData).eq('id', selectedRosterId);
      setRoster(prev => prev.map(m => m.id === selectedRosterId ? { ...m, ...updateData } : m));
    }

    if (targetRosterId) {
      let { data, error } = await supabase.from('scans').insert([{ event_id: session.id, roster_id: targetRosterId, status: 'pending', scanned_by: user.id }]).select();
      if (error && (error.code === 'PGRST204' || error.message?.includes('event_id') || error.message?.includes('session_id'))) {
        const res = await supabase.from('scans').insert([{ session_id: session.id, roster_id: targetRosterId, status: 'pending', scanned_by: user.id }]).select();
        data = res.data;
      }
      if (data) {
        triggerRowHighlight(data[0].id);
        setAttendance(prev => {
          if (prev.some(item => item.roster_id === targetRosterId || item.member?.id === targetRosterId)) {
            return prev;
          }
          return [
            { id: data[0].id, roster_id: targetRosterId, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), status: 'success', message: 'Scanned In', member: targetMember },
            ...prev
          ];
        });
      }
    }

    setUnknownPayload(null);
    setManualFirstName('');
    setManualLastInitial('');
    setSelectedRosterId('');
    if (qrEngineRef.current?.getState() === 3) {
      qrEngineRef.current.resume();
    }
    if (resolveUnknownRef.current) {
      resolveUnknownRef.current();
      resolveUnknownRef.current = null;
    }
  };

  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

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
  const playErrorSound = () => {};
  const playWarningSound = () => {
    try {
      const audio = new Audio('/uh-oh.mp3');
      audio.play().catch(e => console.warn('Audio play failed', e));
    } catch (e) {
      console.warn('Audio play failed', e);
    }
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
      let { data, error } = await supabase.from('scans').insert([{ event_id: session.id, roster_id: targetRosterId, status: 'pending', scanned_by: user.id }]).select();
      if (error && (error.code === 'PGRST204' || error.message?.includes('event_id') || error.message?.includes('session_id'))) {
        const res = await supabase.from('scans').insert([{ session_id: session.id, roster_id: targetRosterId, status: 'pending', scanned_by: user.id }]).select();
        data = res.data;
      }
      if (data) {
        triggerRowHighlight(data[0].id);
        setAttendance(prev => {
          return [
            { id: data[0].id, roster_id: targetRosterId, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), status: 'success', message: 'Scanned In', member: targetMember },
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

  // Grid Table Resizing Handle Drag Handler
  const handleStartResize = (e, leftCol, rightCol) => {
    e.preventDefault();
    e.stopPropagation();

    if (!headerRef.current) return;

    const containerRect = headerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startLeftFr = columnWidths[leftCol] ?? defaultColumnWidths[leftCol];
    const startRightFr = columnWidths[rightCol] ?? defaultColumnWidths[rightCol];

    const activeCols = ['name', 'status', 'time', 'actions'];
    const totalFr = activeCols.reduce((sum, col) => sum + (columnWidths[col] ?? defaultColumnWidths[col]), 0);
    const availWidth = isAdminOrLeader ? Math.max(100, containerRect.width - 48) : containerRect.width;

    const handleMouseMove = (moveEv) => {
      const deltaX = moveEv.clientX - startX;
      const deltaFr = (deltaX / availWidth) * totalFr;

      const minFr = 0.4;
      let newLeftFr = startLeftFr + deltaFr;
      let newRightFr = startRightFr - deltaFr;

      if (newLeftFr < minFr) {
        newLeftFr = minFr;
        newRightFr = startLeftFr + startRightFr - minFr;
      } else if (newRightFr < minFr) {
        newRightFr = minFr;
        newLeftFr = startLeftFr + startRightFr - minFr;
      }

      setColumnWidths(prev => ({
        ...prev,
        [leftCol]: Number(newLeftFr.toFixed(2)),
        [rightCol]: Number(newRightFr.toFixed(2))
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const gridTemplateStyle = useMemo(() => {
    if (isAdminOrLeader) {
      return {
        gridTemplateColumns: `48px minmax(0, ${columnWidths.name || 2.5}fr) minmax(0, ${columnWidths.status || 1.0}fr) minmax(0, ${columnWidths.time || 1.0}fr) minmax(0, ${columnWidths.actions || 0.8}fr)`
      };
    }
    return {
      gridTemplateColumns: `minmax(0, ${columnWidths.name || 2.5}fr) minmax(0, ${columnWidths.status || 1.0}fr) minmax(0, ${columnWidths.time || 1.0}fr) minmax(0, ${columnWidths.actions || 0.8}fr)`
    };
  }, [isAdminOrLeader, columnWidths]);

  // Dynamic Options & Filtering for Attendance Table
  const uniqueMemberNames = useMemo(() => {
    const names = attendance.map(a => a.member ? `${a.member.first_name} ${a.member.last_initial}`.trim() : 'Unknown').filter(Boolean);
    return [...new Set(names)].sort();
  }, [attendance]);

  const uniqueStatuses = useMemo(() => {
    const statuses = attendance.map(a => a.message || 'Scanned In').filter(Boolean);
    return [...new Set(statuses)].sort();
  }, [attendance]);

  const uniqueTimes = useMemo(() => {
    const times = attendance.map(a => a.time).filter(Boolean);
    return [...new Set(times)].sort((a, b) => b.localeCompare(a));
  }, [attendance]);

  const processedAttendance = useMemo(() => {
    let result = [...attendance];

    // Column Filters
    if (columnFilters.name?.length > 0) {
      result = result.filter(a => {
        const name = a.member ? `${a.member.first_name} ${a.member.last_initial}`.trim() : 'Unknown';
        return columnFilters.name.includes(name);
      });
    }

    if (columnFilters.status?.length > 0) {
      result = result.filter(a => columnFilters.status.includes(a.message || 'Scanned In'));
    }

    if (columnFilters.time?.length > 0) {
      result = result.filter(a => columnFilters.time.includes(a.time));
    }

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let valA = '', valB = '';
        if (sortConfig.key === 'name') {
          valA = a.member ? `${a.member.first_name} ${a.member.last_initial}`.trim() : 'Unknown';
          valB = b.member ? `${b.member.first_name} ${b.member.last_initial}`.trim() : 'Unknown';
        } else if (sortConfig.key === 'status') {
          valA = a.message || '';
          valB = b.message || '';
        } else if (sortConfig.key === 'time') {
          valA = a.time || '';
          valB = b.time || '';
        }

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [attendance, columnFilters, sortConfig]);

  if (loadingEvent) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card scan-empty-state">
          <h2>Loading Event...</h2>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card scan-empty-state">
          <h2>Event Not Found</h2>
          <p style={{ marginBottom: '1rem' }}>The requested event could not be found.</p>
          <Link to="/events" className="btn btn-primary">&larr; Back to Events</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', position: 'relative', flex: 1, width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>
      {/* Top Sticky Pinned Title Bar (Floating, No Card) */}
      <div className="scanner-sticky-title">
        <Link
          to="/events"
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          title="Back to Events"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-move-left-icon lucide-move-left">
            <path d="M6 8L2 12L6 16" />
            <path d="M2 12H22" />
          </svg>
        </Link>
        <h2 className="app-title" style={{ fontSize: '1.2rem', margin: 0, flex: 1, wordBreak: 'break-word' }}>
          {session.event_name}
        </h2>
      </div>

      {/* Top Hero Section (Header Card + Viewfinder side-by-side on desktop) */}
      <div className="scanner-hero-section">
        {/* Header Card (Scrolls Away) */}
        <div className="scanner-header-card">
          {/* Status Row */}
          <div ref={statusMenuRef} style={{ position: 'relative' }}>
            <div
              className="grid-table-cell grid-table-cell-status"
              role="cell"
              onClick={() => setShowStatusMenu(prev => !prev)}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.2rem 0' }}
            >
              <span className="header-card-label">Status</span>
              <div>
                <span className={`badge ${session.ended_at ? (session.synced_at ? 'badge-neutral' : 'badge-error') : 'badge-success'}`}>
                  {session.ended_at ? (session.synced_at ? 'Synced' : 'Closed') : 'Open'}
                </span>
              </div>
            </div>

            {showStatusMenu && (
              <div className="status-popover-menu">
                {isAdminOrLeader && !session.ended_at && (
                  <button
                    type="button"
                    className="status-popover-item"
                    onClick={() => { setShowStatusMenu(false); handleEndSession(); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Close Event
                  </button>
                )}

                {isAdminOrLeader && session.ended_at && !session.synced_at && (
                  <button
                    type="button"
                    className="status-popover-item"
                    onClick={() => { setShowStatusMenu(false); handleReenableSession(); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </svg>
                    Reopen Event
                  </button>
                )}

                {isAdminOrLeader && (
                  <button
                    type="button"
                    className="status-popover-item"
                    style={{ color: 'var(--color-error)' }}
                    onClick={() => { setShowStatusMenu(false); handleDeleteSession(); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete Event
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Event Date Row */}
          <div className="grid-table-cell grid-table-cell-time" role="cell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.2rem 0' }}>
            <span className="header-card-label">Event Date</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {session.event_date ? formatAppDate(session.event_date) : (session.created_at ? formatAppDate(session.created_at) : 'N/A')}
            </span>
          </div>

          {/* Scanned In Count Row */}
          <div className="grid-table-cell" role="cell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.2rem 0' }}>
            <span className="header-card-label">Scanned In</span>
            <div>
              <span className="badge badge-success" style={{ borderRadius: '9999px', padding: '0.15rem 0.6rem' }}>
                {attendance.length}
              </span>
            </div>
          </div>

          {/* Offline Queue Row */}
          {(() => {
            const offlineCount = attendance.filter(s => s.message === 'Saved Offline').length;
            return (
              <div ref={offlineInfoRef} style={{ position: 'relative' }}>
                <div
                  className="grid-table-cell"
                  role="cell"
                  onClick={() => setShowOfflineInfo(prev => !prev)}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.2rem 0' }}
                  title="Click to view Offline Queue details"
                >
                  <span className="header-card-label">Offline Queue</span>
                  <div>
                    {offlineCount > 0 ? (
                      <span className="badge badge-pending">{offlineCount}</span>
                    ) : (
                      <span className="badge badge-success">0</span>
                    )}
                  </div>
                </div>

                {showOfflineInfo && (
                  <div className="status-popover-menu" style={{ right: 0, left: 'auto', minWidth: '220px', maxWidth: '280px', padding: '0.75rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Offline Queue</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowOfflineInfo(false); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: '0.9rem', padding: 0 }}
                      >
                        ✕
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Scans taken while offline or during weak network conditions are saved locally on your device.
                    </p>
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                      <strong>How to resolve:</strong> Reconnect to the internet and the app will automatically sync queued scans to the server.
                    </div>
                  </div>
                )}
              </div>
            );
          })()}        </div>

        {/* New Scanner Viewfinder & Controls Layout */}
        <div className="scanner-layout-wrapper">
          {!session.ended_at ? (
            <>
              {/* Top Row: Camera Feed */}
              <div className="scanner-feed-container" ref={scannerContainerRef}>
                <div className="glass-card scanner-camera-card">
                  {/* Disabled State Overlay */}
                  {!isScanning && (
                    <div className="scanner-idle-overlay">
                      <svg xmlns="http://www.w3.org/2000/svg" className="scanner-idle-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <h2 className="scanner-idle-title">Scanner Idle</h2>
                      <p className="scanner-idle-subtitle">Camera is paused to save battery.</p>
                      <button onClick={startScanner} className="btn btn-primary">SCAN</button>
                    </div>
                  )}

                  {/* Active Camera View */}
                  <div className="scanner-active-view">
                    {/* HTML5 QR Code Container */}
                    <div id="qr-reader" className="scanner-qr-container" style={{ opacity: isScanning ? 1 : 0 }}></div>
                    
                    {/* Dimmed overlay outside the square */}
                    <div className="scanner-dim-overlay"></div>

                    {/* STRICT SQUARE VIEWFINDER */}
                    <div className="scanner-strict-square">
                      {/* Corner brackets */}
                      <div className="scanner-corner scanner-corner-tl"></div>
                      <div className="scanner-corner scanner-corner-tr"></div>
                      <div className="scanner-corner scanner-corner-bl"></div>
                      <div className="scanner-corner scanner-corner-br"></div>

                      {/* Single Pass Scan Line */}
                      <div key={isScanning ? 'scanning' : 'idle'} className={`scanner-scan-line ${isScanning ? 'scan-line-active' : ''}`}></div>
                      
                      {/* Success/Warning Overlays */}
                      {showCheckmark && (
                        <div className="scanner-feedback-overlay scanner-feedback-success">
                          <img src="/logo.png" alt="Success" style={{ width: '36%', height: '36%', objectFit: 'contain' }} />
                        </div>
                      )}
                      {showWarning && (
                        <div className="scanner-feedback-overlay scanner-feedback-warning">
                          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '50%', padding: '1rem', display: 'flex', boxShadow: 'var(--glass-shadow)' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    {isScanning && (
                      <div className="scanner-live-badge">
                        <span className="badge badge-success" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
                          <div className="scanner-pulse-dot"></div>
                          Live
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Controls */}
              <div className="scanner-controls-grid">
                <button 
                  onClick={isScanning ? stopScanner : startScanner} 
                  className={`btn ${isScanning ? 'btn-destructive' : 'btn-primary'}`}
                  style={{ width: '100%', padding: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isScanning ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.25rem', height: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>STOP SCAN</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.25rem', height: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span>SCAN</span>
                    </>
                  )}
                </button>

                <div style={{ position: 'relative', width: '100%' }}>
                  <button className="scanner-control-btn-card">
                    <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.25rem', height: '1.25rem', color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Load Photos
                  </button>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    onChange={handleBulkPhotos} 
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} 
                  />
                </div>

                <button onClick={() => setIsManualEntryOpen(true)} className="scanner-control-btn-card">
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.25rem', height: '1.25rem', color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Member
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--foreground)' }}>
              <h2>Event Closed</h2>
              <p>No further scans can be recorded.</p>
              {isAdminOrLeader && (
                session.synced_at ? (
                  <button onClick={handleResetSyncSession} className="btn btn-reset-sync" style={{ marginTop: 'var(--spacing-md)' }}>Reset Sync</button>
                ) : (
                  <button onClick={handleReenableSession} className="btn btn-reopen" style={{ marginTop: 'var(--spacing-md)' }}>Reopen Event</button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Attendance Section Header */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'transparent', flexShrink: 0 }}>
        <div className="attendance-section-header">
          <div
            onClick={() => setIsTableVisible(!isTableVisible)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
            title={isTableVisible ? "Click to collapse" : "Click to expand"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isTableVisible ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s ease',
                color: 'var(--muted-foreground)'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Attendance</h3>
          </div>

        </div>

        {/* Scrollable list inside table - Pattern 07 Responsive Grid Table */}
        <div style={{
          display: 'grid',
          gridTemplateRows: isTableVisible ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 var(--spacing-md)' }}>
              {attendance.length === 0 ? (
                <div className="glass-card scan-empty-state" style={{ marginTop: 'var(--spacing-md)' }}>
                  <p>No people scanned in yet.</p>
                </div>
              ) : (
                <div className="grid-table-container">
                  {/* Table Header */}
                  <div
                    ref={headerRef}
                    className={`grid-table-header ${!isAdminOrLeader ? 'no-manage' : ''}`}
                    style={gridTemplateStyle}
                    role="row"
                  >
                    {isAdminOrLeader && (
                      <div role="columnheader" className="grid-table-cell-select" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '1rem', width: '48px' }}>
                        <input
                          type="checkbox"
                          checked={processedAttendance.length > 0 && processedAttendance.every(s => selectedScans.has(s.id))}
                          ref={el => {
                            if (el) {
                              const someSelected = processedAttendance.some(s => selectedScans.has(s.id));
                              const allSelected = processedAttendance.length > 0 && processedAttendance.every(s => selectedScans.has(s.id));
                              el.indeterminate = someSelected && !allSelected;
                            }
                          }}
                          onChange={handleSelectAll}
                          title="Select all"
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </div>
                    )}

                    {/* Member Name Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'name' ? null : 'name')}
                      >
                        Member Name
                        {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.name?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'name' && (
                        <FilterPopover
                          isOpen={true}
                          title="Member Name"
                          type="multiselect"
                          options={uniqueMemberNames.map(n => ({ label: n, value: n }))}
                          value={columnFilters.name || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, name: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="name"
                          onSort={(dir) => setSortConfig({ key: 'name', direction: dir })}
                          sortAscLabel="Sort A to Z"
                          sortDescLabel="Sort Z to A"
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'name', 'status')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Status Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
                      >
                        Status
                        {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.status?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'status' && (
                        <FilterPopover
                          isOpen={true}
                          title="Status"
                          type="multiselect"
                          options={uniqueStatuses.map(s => ({ label: s, value: s }))}
                          value={columnFilters.status || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, status: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="status"
                          onSort={(dir) => setSortConfig({ key: 'status', direction: dir })}
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'status', 'time')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Time Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'time' ? null : 'time')}
                      >
                        Scan Time
                        {sortConfig.key === 'time' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.time?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'time' && (
                        <FilterPopover
                          isOpen={true}
                          title="Scan Time"
                          type="multiselect"
                          options={uniqueTimes.map(t => ({ label: t, value: t }))}
                          value={columnFilters.time || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, time: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="time"
                          onSort={(dir) => setSortConfig({ key: 'time', direction: dir })}
                          sortAscLabel="Sort Newest to Oldest"
                          sortDescLabel="Sort Oldest to Newest"
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'time', 'actions')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Actions Header */}
                    <div role="columnheader" className="column-header-cell" style={{ justifyContent: 'flex-start' }}>
                      <span>Actions</span>
                    </div>
                  </div>

                  {/* Grid Table Rows */}
                  {processedAttendance.map((scan) => {
                    const isNew = recentlyScannedIds.has(scan.id);
                    const memberName = scan.member ? `${scan.member.first_name} ${scan.member.last_initial}`.trim() : 'Unknown';

                    return (
                      <div
                        key={scan.id}
                        id={`scan-row-${scan.id}`}
                        className={`grid-table-row ${!isAdminOrLeader ? 'no-manage' : ''} ${isNew ? 'newly-scanned' : ''}`}
                        style={gridTemplateStyle}
                        role="row"
                      >
                        <div className="grid-table-card-header">
                          {isAdminOrLeader && (
                            <div className="grid-table-cell grid-table-cell-select" role="cell" style={{ gridColumn: 1 }}>
                              {scan.id && !String(scan.id).startsWith('temp-') && (
                                <input
                                  type="checkbox"
                                  checked={selectedScans.has(scan.id)}
                                  onChange={() => handleToggleSelect(scan.id)}
                                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                />
                              )}
                            </div>
                          )}

                          <div className="grid-table-cell grid-table-cell-name" role="cell" style={{ gridColumn: isAdminOrLeader ? 2 : 1 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{memberName}</strong>
                          </div>

                          <div className="grid-table-cell grid-table-cell-actions" role="cell" style={{ gridColumn: isAdminOrLeader ? 5 : 4 }}>
                            <button
                              type="button"
                              className="btn-icon-action btn-icon-destructive"
                              onClick={() => handleDeleteSingleScan(scan.id)}
                              title={!isAdminOrLeader ? "Delete unavailable: requires admin role" : (!scan.id || String(scan.id).startsWith('temp-') ? "Delete unavailable: scan not saved yet" : "Remove scan")}
                              disabled={!isAdminOrLeader || !scan.id || String(scan.id).startsWith('temp-')}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: isAdminOrLeader ? 3 : 2 }}>
                          <span className="grid-table-label">Status</span>
                          <span className={`badge badge-${scan.status === 'success' ? 'success' : scan.status === 'duplicate' ? 'warning' : 'error'}`}>
                            {scan.message || 'Scanned In'}
                          </span>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: isAdminOrLeader ? 4 : 3 }}>
                          <span className="grid-table-label">Scan Time</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{scan.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected items actions bar */}
        {isAdminOrLeader && selectedScans.size > 0 && (
          <div style={{ padding: '0.5rem var(--spacing-md)', background: 'color-mix(in srgb, var(--color-error) 15%, transparent)', borderTop: '1px solid color-mix(in srgb, var(--color-error) 30%, transparent)', color: 'var(--color-error)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span>{selectedScans.size} scan(s) selected</span>
            <button onClick={handleBulkRemove} className="btn btn-destructive" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Unknown Member Modal */}
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
