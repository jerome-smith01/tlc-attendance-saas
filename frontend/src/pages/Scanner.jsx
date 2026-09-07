import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { useTroop } from '../context/TroopContext';
import { supabase } from '../lib/supabaseClient';
import { useScanLogic } from '../hooks/useScanLogic';
import { useConfirm } from '../components/common/ConfirmContext';
import { useToast } from '../components/common/ToastContext';
import { Modal } from '../components/common/Modal';
import { FilterPopover } from '../components/common/FilterPopover';
import { LastInitialTooltip } from '../components/common/Tooltip';
import { formatAppDate } from '../utils/date';
import { compareMemberName } from '../utils/nameSorter';
import { getScannerDisplayData } from '../utils/scannerFeedback';
import { MembershipExpiryModal, daysUntilExpiry } from '../components/MembershipExpiryModal';

export function Scanner() {
  const { eventId, troopNumber } = useParams();
  const navigate = useNavigate();
  const { selectedTroopIdentifier, selectTroopByNumberOrId, loadingTroops } = useTroop();

  // Sync TroopContext with URL parameter when troopNumber is present in URL
  useEffect(() => {
    if (loadingTroops) return;
    if (troopNumber) {
      selectTroopByNumberOrId(troopNumber);
    }
  }, [troopNumber, loadingTroops]);

  const eventsBackPath = selectedTroopIdentifier ? `/troop/${selectedTroopIdentifier}/events` : '/events';
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';
  const storageKey = `tlc_scanner_filters_${userId}`;

  const [troopId, setTroopId] = useState('');
  const [session, setSession] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [roster, setRoster] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [scanMode, _setScanMode] = useState('IN'); // 'IN' | 'OUT'
  const scanModeRef = useRef('IN');
  const setScanMode = (mode) => {
    if (typeof mode === 'function') {
      _setScanMode(prev => {
        const next = mode(prev);
        scanModeRef.current = next;
        return next;
      });
    } else {
      scanModeRef.current = mode;
      _setScanMode(mode);
    }
  };
  const [selectedScans, setSelectedScans] = useState(new Set());
  const [recentlyScannedIds, setRecentlyScannedIds] = useState(new Set());
  const [scannerStatus, setScannerStatus] = useState('Idle');
  const [isScanning, setIsScanning] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(() => getScannerDisplayData({ status: 'ready' }));
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
  const defaultSort = { key: 'in_time', direction: 'desc' };
  const defaultFilters = { name: [], status: [], in_date: [], in_time: [], in_by: [], out_date: [], out_time: [], out_by: [] };
  const defaultColumnWidths = useMemo(() => ({
    name: 2.0,
    status: 1.0,
    in_date: 1.0,
    in_time: 1.0,
    in_by: 1.0,
    out_date: 1.0,
    out_time: 1.0,
    out_by: 1.0,
    actions: 0.8
  }), []);

  const [sortConfig, setSortConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sortConfig) {
          if (parsed.sortConfig.key === 'name' && !parsed.sortConfig.field) {
            return { ...parsed.sortConfig, field: 'first' };
          }
          return parsed.sortConfig;
        }
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

  // Membership expiry modal — set to a roster member object after a successful scan
  // when their membership_exp is expired or within 30 days.
  const [membershipExpiryTarget, setMembershipExpiryTarget] = useState(null);


  // Sound toggle state (default to muted)
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('scanner_sound_enabled') === 'true';
    } catch (e) {
      return false;
    }
  });

  const handleToggleSound = () => {
    setIsSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('scanner_sound_enabled', String(next));
      } catch (e) {
        console.warn('Failed to save sound setting', e);
      }
      return next;
    });
  };

  // Manual Entry modal state
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualEntryFirstName, setManualEntryFirstName] = useState('');
  const [manualEntryLastInitial, setManualEntryLastInitial] = useState('');
  const [manualEntryRosterIds, setManualEntryRosterIds] = useState(new Set());
  const [manualEntrySortBy, setManualEntrySortBy] = useState('first'); // 'first' | 'last'

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

      if (!error && data) {
        setSession(data);
        if (data.troop_id) {
          setTroopId(data.troop_id);
          fetchRoster(data.troop_id);
          fetchUserRole(data.troop_id);
        }
      } else {
        addToast({ type: 'error', message: 'Event not found.' });
        navigate(eventsBackPath);
      }
      setLoadingEvent(false);
    }
    loadEvent();
  }, [eventId, user]);

  useEffect(() => {
    if (troopId && session?.id) {
      fetchRoster(troopId);
    }
  }, [troopId, session?.id]);

  async function fetchRoster(targetTroopId) {
    const tId = targetTroopId || troopId;
    if (!tId) return;
    let { data, error } = await supabase
      .from('roster')
      .select('*')
      .eq('troop_id', tId);
      
    if (error) {
      console.error('[fetchRoster] Supabase error:', error);
      return;
    }
    setRoster(data || []);
  }

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
      .eq('event_id', session.id);

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
          const signInTimeRaw = s.sign_in_time || s.scan_time;
          const signOutTimeRaw = s.sign_out_time;
          const isSignedOut = !!signOutTimeRaw;
          formatted.push({
            id: s.id,
            roster_id: s.roster_id,
            member: s.roster,
            raw_sign_in_time: signInTimeRaw,
            raw_sign_out_time: signOutTimeRaw,
            in_date: signInTimeRaw ? formatAppDate(signInTimeRaw) : '-',
            in_time: signInTimeRaw ? new Date(signInTimeRaw).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '-',
            signed_in_by: s.signed_in_by || s.scanned_by,
            out_date: signOutTimeRaw ? formatAppDate(signOutTimeRaw) : '-',
            out_time: signOutTimeRaw ? new Date(signOutTimeRaw).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '-',
            signed_out_by: s.signed_out_by,
            status: isSignedOut ? 'complete' : 'pending',
            message: isSignedOut ? 'Signed Out' : 'Signed In'
          });
        }
      });
      setAttendance(formatted);
      setSelectedScans(new Set());
    }
  }

  const handleToggleScanStatus = async (scan) => {
    const canToggle = isGlobalAdmin || currentUserRole === 'roster_manager' || currentUserRole === 'troop_admin' || currentUserRole === 'admin' || currentUserRole === 'leader';
    if (!canToggle || !scan.id || String(scan.id).startsWith('temp-')) return;
    const isCurrentlySignedOut = !!(scan.raw_sign_out_time || scan.sign_out_time);
    const memberName = scan.member
      ? `${scan.member.first_name || ''} ${scan.member.last_name || scan.member.last_initial || ''}`.trim()
      : 'this member';

    const confirmed = await confirm({
      title: isCurrentlySignedOut ? 'Sign Member Back In' : 'Sign Member Out',
      message: isCurrentlySignedOut
        ? `Are you sure you want to sign ${memberName} back in?`
        : `Are you sure you want to sign ${memberName} out?`,
      confirmText: isCurrentlySignedOut ? 'Sign In' : 'Sign Out',
      cancelText: 'Cancel',
      confirmBtnClass: isCurrentlySignedOut ? 'btn btn-signin' : 'btn btn-signout'
    });

    if (!confirmed) return;

    const nowIso = new Date().toISOString();
    let updateData = {};
    if (isCurrentlySignedOut) {
      updateData = {
        sign_out_time: null,
        signed_out_by: null,
        status: 'pending'
      };
    } else {
      updateData = {
        sign_out_time: nowIso,
        signed_out_by: user?.id,
        status: 'complete'
      };
    }

    let { error } = await supabase.from('scans').update(updateData).eq('id', scan.id);
    if (error) {
      addToast({ type: 'error', message: "Failed to update attendance status: " + error.message });
      return;
    }

    addToast({ 
      type: 'success', 
      message: `${memberName} marked as ${isCurrentlySignedOut ? 'Signed In' : 'Signed Out'}.` 
    });

    await fetchAttendance();
  };

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

  const handleEndSession = async () => {
    if (await confirm({ title: 'End Event', message: 'Are you sure you want to end this event? All members currently signed in will be automatically signed out at this time.', isDestructive: true })) {
      const now = new Date().toISOString();
      let { error } = await supabase.from('events').update({ ended_at: now }).eq('id', session.id);
      if (error) {
        addToast({ type: 'error', message: "Failed to end event: " + error.message });
        return;
      }

      // Auto Sign-Out remaining signed-in members
      let { error: scansError } = await supabase
        .from('scans')
        .update({ 
          status: 'complete',
          sign_out_time: now,
          signed_out_by: user?.id
        })
        .eq('event_id', session.id)
        .is('sign_out_time', null);

      if (scansError) {
        addToast({ type: 'warning', message: "Event ended, but failed to auto sign-out members: " + scansError.message });
      } else {
        addToast({ type: 'success', message: "Event ended and remaining members signed out." });
      }

      setSession({ ...session, ended_at: now });
      await stopScanner();
      await fetchAttendance();
    }
  };

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

  const handleReenableSession = async () => {
    if (await confirm({ title: 'Reenable Event', message: "Are you sure you want to reenable this event?" })) {
      let { error } = await supabase.from('events').update({ ended_at: null }).eq('id', session.id);
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
      if (error) {
        addToast({ type: 'error', message: 'Error deleting event: ' + error.message });
      } else {
        addToast({ type: 'success', message: 'Event deleted' });
        await stopScanner();
        navigate(eventsBackPath);
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

  const handleBulkScanIn = async () => {
    if (selectedScans.size === 0) return;

    // Collect the roster IDs for each selected scan
    const selectedScanIds = Array.from(selectedScans);
    const targets = selectedScanIds
      .map(scanId => attendance.find(s => s.id === scanId))
      .filter(Boolean);

    let successCount = 0;
    let skippedCount = 0;

    for (const scan of targets) {
      const targetRosterId = scan.roster_id;
      const targetMember = scan.member;

      // Skip if already signed in (no sign-out time means currently signed in)
      if (!scan.raw_sign_out_time) {
        skippedCount++;
        continue;
      }

      // Member was signed out — re-scan them in by clearing sign_out_time
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('scans')
        .update({
          sign_in_time: nowIso,
          signed_in_by: user?.id,
          sign_out_time: null,
          signed_out_by: null,
          status: 'pending'
        })
        .eq('id', scan.id)
        .select();

      if (error) {
        addToast({ type: 'error', message: `Failed to scan in ${targetMember ? `${targetMember.first_name} ${targetMember.last_initial}` : 'member'}: ${error.message}` });
      } else {
        triggerRowHighlight(scan.id);
        setAttendance(prev => prev.map(s => {
          if (s.id !== scan.id) return s;
          return {
            ...s,
            raw_sign_in_time: nowIso,
            raw_sign_out_time: null,
            in_date: formatAppDate(nowIso),
            in_time: new Date(nowIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            signed_in_by: user?.id,
            out_date: '-',
            out_time: '-',
            signed_out_by: null,
            status: 'pending',
            message: 'Signed In'
          };
        }));
        successCount++;
      }
    }

    if (skippedCount > 0 && successCount === 0) {
      addToast({ type: 'warning', message: skippedCount === 1 ? 'Selected person is already signed in.' : `All ${skippedCount} selected are already signed in.` });
    } else if (successCount > 0) {
      playSuccessSound();
      const msg = skippedCount > 0
        ? `${successCount} scanned in. ${skippedCount} already signed in.`
        : `${successCount} member(s) scanned in.`;
      addToast({ type: 'success', message: msg });
    }

    setSelectedScans(new Set());
  };

  const handleBulkSignOut = async () => {
    if (selectedScans.size === 0) return;

    const selectedScanIds = Array.from(selectedScans);
    const targets = selectedScanIds
      .map(scanId => attendance.find(s => s.id === scanId))
      .filter(Boolean);

    let successCount = 0;
    let skippedCount = 0;

    const nowIso = new Date().toISOString();

    for (const scan of targets) {
      const targetMember = scan.member;

      // Skip if already signed out
      if (scan.raw_sign_out_time) {
        skippedCount++;
        continue;
      }

      const { error } = await supabase
        .from('scans')
        .update({
          sign_out_time: nowIso,
          signed_out_by: user?.id,
          status: 'complete'
        })
        .eq('id', scan.id);

      if (error) {
        addToast({ type: 'error', message: `Failed to sign out ${targetMember ? `${targetMember.first_name} ${targetMember.last_initial}` : 'member'}: ${error.message}` });
      } else {
        triggerRowHighlight(scan.id);
        setAttendance(prev => prev.map(s => {
          if (s.id !== scan.id) return s;
          return {
            ...s,
            raw_sign_out_time: nowIso,
            out_date: formatAppDate(nowIso),
            out_time: new Date(nowIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            signed_out_by: user?.id,
            status: 'complete',
            message: 'Signed Out'
          };
        }));
        successCount++;
      }
    }

    if (skippedCount > 0 && successCount === 0) {
      addToast({ type: 'warning', message: skippedCount === 1 ? 'Selected person is already signed out.' : `All ${skippedCount} selected are already signed out.` });
    } else if (successCount > 0) {
      const msg = skippedCount > 0
        ? `${successCount} signed out. ${skippedCount} already signed out.`
        : `${successCount} member(s) signed out.`;
      addToast({ type: 'success', message: msg });
    }

    setSelectedScans(new Set());
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
        { fps: 15, disableFlip: false, qrbox: { width: 250, height: 250 } },
        onScanSuccess
      );
      setIsScanning(true);
      setScannerStatus('Camera Active - Ready to scan');
      applyFocusHint('qr-reader');
    } catch (err) {
      console.error(err);
      setIsScanning(false);
      setScannerStatus('Failed to start camera');
    }
  };

  /**
   * Requests continuous autofocus from the device camera after the scanner
   * has started. Uses the MediaTrackConstraints API — supported on Chrome/Android,
   * silently ignored on Safari/iOS which manages focus internally.
   */
  function applyFocusHint(elementId) {
    try {
      const video = document.querySelector(`#${elementId} video`);
      const track = video?.srcObject?.getVideoTracks?.()?.[0];
      if (!track) return;
      const caps = track.getCapabilities?.() ?? {};
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
          .catch(e => console.warn('[FocusHint] applyConstraints failed:', e));
      }
    } catch (e) {
      console.warn('[FocusHint] Could not apply focus hint:', e);
    }
  }

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
    setScanFeedback(getScannerDisplayData({ status: 'ready' }));
  };

  const onScanSuccess = async (decodedText) => {
    console.log('[onScanSuccess] Decoded QR:', decodedText);
    await processPayload(decodedText);
  };

  const resolveUnknownRef = useRef(null);

  const processPayload = (payload) => {
    return new Promise((resolve) => {
      handleScan(payload, scanModeRef.current, (result) => {
        const feedback = getScannerDisplayData({
          status: result.status,
          mode: result.mode || scanModeRef.current,
          member: result.member
        });
        setScanFeedback(feedback);

        if (result.status === 'unknown') {
          if (qrEngineRef.current?.getState() === 2) qrEngineRef.current.pause(true);
          playErrorSound();
          setShowWarning(true);
          setUnknownPayload(result.payload);
          resolveUnknownRef.current = resolve;
          setTimeout(() => {
            setShowWarning(false);
            setScanFeedback(getScannerDisplayData({ status: 'ready' }));
          }, 2000);
        } else {
          if (result.status === 'success' || result.status === 'offline_queued') {
            playSuccessSound();
            setShowCheckmark(true);

            if (qrEngineRef.current?.getState() === 2) {
              qrEngineRef.current.pause(true);
            }

            setTimeout(() => {
              setShowCheckmark(false);
              setScanFeedback(getScannerDisplayData({ status: 'ready' }));

              // Check membership expiry — show blocking modal if expired or within 30 days.
              // The scanner stays paused until the user dismisses the modal.
              const member = result.member;
              const days = daysUntilExpiry(member?.membership_exp);
              const shouldWarnExpiry = days !== null && days <= 30;

              if (shouldWarnExpiry) {
                setMembershipExpiryTarget(member);
                // Scanner remains paused until onDismiss resumes it
              } else if (qrEngineRef.current?.getState() === 3 && result.status !== 'unknown' && !unknownPayload) {
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
              setScanFeedback(getScannerDisplayData({ status: 'ready' }));

              // Check membership expiry on duplicate scan as well
              const member = result.member;
              const days = daysUntilExpiry(member?.membership_exp);
              const shouldWarnExpiry = days !== null && days <= 30;

              if (shouldWarnExpiry) {
                setMembershipExpiryTarget(member);
                // Scanner remains paused until onDismiss resumes it
              } else if (qrEngineRef.current?.getState() === 3 && result.status !== 'unknown' && !unknownPayload) {
                qrEngineRef.current.resume();
              }
            }, 2000);
          } else {
            playWarningSound();
          }

          if ((result.status === 'success' || result.status === 'offline_queued') && result.member) {
            setAttendance(prev => {
              const rId = result.member.id;
              const existingIndex = prev.findIndex(item => item.roster_id === rId || item.member?.id === rId);

              if (existingIndex >= 0) {
                const updatedItem = { ...prev[existingIndex] };
                if (result.scanRecord) {
                  const s = result.scanRecord;
                  const signInTimeRaw = s.sign_in_time || s.scan_time;
                  const signOutTimeRaw = s.sign_out_time;
                  const isSignedOut = !!signOutTimeRaw;
                  
                  updatedItem.raw_sign_in_time = signInTimeRaw;
                  updatedItem.raw_sign_out_time = signOutTimeRaw;
                  updatedItem.in_date = signInTimeRaw ? formatAppDate(signInTimeRaw) : '-';
                  updatedItem.in_time = signInTimeRaw ? new Date(signInTimeRaw).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '-';
                  updatedItem.out_date = signOutTimeRaw ? formatAppDate(signOutTimeRaw) : '-';
                  updatedItem.out_time = signOutTimeRaw ? new Date(signOutTimeRaw).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '-';
                  updatedItem.signed_in_by = s.signed_in_by || s.scanned_by || updatedItem.signed_in_by;
                  updatedItem.signed_out_by = s.signed_out_by;
                  
                  updatedItem.status = isSignedOut ? 'complete' : 'pending';
                  updatedItem.message = isSignedOut ? 'Signed Out' : 'Signed In';
                } else if (result.mode === 'OUT') {
                  const nowIso = new Date().toISOString();
                  updatedItem.raw_sign_out_time = nowIso;
                  updatedItem.out_date = formatAppDate(nowIso);
                  updatedItem.out_time = new Date(nowIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  updatedItem.signed_out_by = user?.id;
                  updatedItem.status = 'complete';
                  updatedItem.message = 'Signed Out';
                } else {
                  const nowIso = new Date().toISOString();
                  updatedItem.raw_sign_in_time = nowIso;
                  updatedItem.raw_sign_out_time = null;
                  updatedItem.in_date = formatAppDate(nowIso);
                  updatedItem.in_time = new Date(nowIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  updatedItem.out_date = '-';
                  updatedItem.out_time = '-';
                  updatedItem.signed_in_by = user?.id;
                  updatedItem.signed_out_by = null;
                  updatedItem.status = 'pending';
                  updatedItem.message = 'Signed In';
                }
                
                const newPrev = [...prev];
                newPrev[existingIndex] = updatedItem;
                triggerRowHighlight(updatedItem.id);
                return newPrev;
              }

              const newId = result.scanRecord ? result.scanRecord.id : 'temp-' + Date.now();
              triggerRowHighlight(newId);
              
              const s = result.scanRecord || {};
              const signInTimeRaw = s.sign_in_time || s.scan_time || new Date().toISOString();
              const signOutTimeRaw = s.sign_out_time;
              const isSignedOut = !!signOutTimeRaw;
              
              const newEntry = {
                id: newId,
                roster_id: rId,
                member: result.member,
                raw_sign_in_time: signInTimeRaw,
                raw_sign_out_time: signOutTimeRaw,
                in_date: signInTimeRaw ? formatAppDate(signInTimeRaw) : '-',
                in_time: signInTimeRaw ? new Date(signInTimeRaw).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '-',
                signed_in_by: s.signed_in_by || user?.id,
                out_date: signOutTimeRaw ? formatAppDate(signOutTimeRaw) : '-',
                out_time: signOutTimeRaw ? new Date(signOutTimeRaw).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '-',
                signed_out_by: s.signed_out_by,
                status: isSignedOut ? 'complete' : 'pending',
                message: result.status === 'offline_queued' ? 'Saved Offline' : (isSignedOut ? 'Signed Out' : 'Signed In')
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
      let { data, error } = await supabase.from('scans').insert([{ event_id: session.id, roster_id: targetRosterId, status: 'pending', signed_in_by: user.id }]).select();
      if (data) {
        triggerRowHighlight(data[0].id);
        setAttendance(prev => {
          if (prev.some(item => item.roster_id === targetRosterId || item.member?.id === targetRosterId)) {
            return prev;
          }
          const nowIso = new Date().toISOString();
          return [
            {
              id: data[0].id,
              roster_id: targetRosterId,
              raw_sign_in_time: nowIso,
              raw_sign_out_time: null,
              in_date: formatAppDate(nowIso),
              in_time: new Date(nowIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
              signed_in_by: user?.id,
              out_date: '-',
              out_time: '-',
              signed_out_by: null,
              status: 'success',
              message: 'Scanned In',
              member: targetMember
            },
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

  const checkIsSoundEnabled = () => {
    try {
      return localStorage.getItem('scanner_sound_enabled') === 'true';
    } catch (e) {
      return false;
    }
  };

  const playSuccessSound = () => {
    if (!checkIsSoundEnabled()) return;
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
  const playErrorSound = () => {
    if (!checkIsSoundEnabled()) return;
  };
  const playWarningSound = () => {
    if (!checkIsSoundEnabled()) return;
    try {
      const audio = new Audio('/uh-oh.mp3');
      audio.play().catch(e => console.warn('Audio play failed', e));
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  };

  const handleManualEntry = async (e) => {
    e.preventDefault();
    if (manualEntryRosterIds.size === 0 && (!manualEntryFirstName.trim() && !manualEntryLastInitial.trim())) return;

    // Build list of roster IDs to scan in
    const targetIds = [];

    // Always add all selected roster members
    for (const id of manualEntryRosterIds) {
      const member = roster.find(m => m.id === id);
      targetIds.push({ id, member });
    }

    // Also add guest/new member if a name was typed (works alongside roster selection)
    if (manualEntryFirstName.trim() || manualEntryLastInitial.trim()) {
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
        targetIds.push({ id: data.id, member: data });
        setRoster(prev => [...prev, data]);
      }
    }

    let successCount = 0;
    let skippedCount = 0;

    for (const { id: targetRosterId, member: targetMember } of targetIds) {
      if (attendance.some(item => item.roster_id === targetRosterId || item.member?.id === targetRosterId)) {
        skippedCount++;
        continue;
      }
      let { data, error } = await supabase.from('scans').insert([{ event_id: session.id, roster_id: targetRosterId, status: 'pending', signed_in_by: user.id }]).select();
      if (data) {
        triggerRowHighlight(data[0].id);
        const nowIso = new Date().toISOString();
        setAttendance(prev => [
          {
            id: data[0].id,
            roster_id: targetRosterId,
            raw_sign_in_time: nowIso,
            raw_sign_out_time: null,
            in_date: formatAppDate(nowIso),
            in_time: new Date(nowIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            signed_in_by: user?.id,
            out_date: '-',
            out_time: '-',
            signed_out_by: null,
            status: 'success',
            message: 'Scanned In',
            member: targetMember
          },
          ...prev
        ]);
        successCount++;
      }
    }

    if (skippedCount > 0 && successCount === 0) {
      addToast({ type: 'warning', message: skippedCount === 1 ? 'This person is already scanned in.' : `${skippedCount} members are already scanned in.` });
    } else if (successCount > 0) {
      playSuccessSound();
      if (skippedCount > 0) {
        addToast({ type: 'info', message: `${successCount} scanned in. ${skippedCount} already scanned in.` });
      }
    }

    setIsManualEntryOpen(false);
    setManualEntryFirstName('');
    setManualEntryLastInitial('');
    setManualEntryRosterIds(new Set());
  };

  const membersWithoutIds = roster.filter(m => !m.member_id);
  const isAdminOrLeader = isGlobalAdmin || currentUserRole === 'roster_manager' || currentUserRole === 'troop_admin';
  const canManageScans = isGlobalAdmin || currentUserRole === 'badge_scanner' || currentUserRole === 'roster_manager' || currentUserRole === 'troop_admin';

  // Grid Table Resizing Handle Drag Handler
  const handleStartResize = (e, leftCol, rightCol) => {
    e.preventDefault();
    e.stopPropagation();

    if (!headerRef.current) return;

    const containerRect = headerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startLeftFr = columnWidths[leftCol] ?? defaultColumnWidths[leftCol];
    const startRightFr = columnWidths[rightCol] ?? defaultColumnWidths[rightCol];

    const activeCols = ['name', 'status', 'in_date', 'in_time', 'in_by', 'out_date', 'out_time', 'out_by', 'actions'];
    const totalFr = activeCols.reduce((sum, col) => sum + (columnWidths[col] ?? defaultColumnWidths[col]), 0);
    const availWidth = canManageScans ? Math.max(100, containerRect.width - 48) : containerRect.width;

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
    if (canManageScans) {
      return {
        gridTemplateColumns: `48px minmax(0, ${columnWidths.name || 2.0}fr) minmax(0, ${columnWidths.status || 1.0}fr) minmax(0, ${columnWidths.in_date || 1.0}fr) minmax(0, ${columnWidths.in_time || 1.0}fr) minmax(0, ${columnWidths.in_by || 1.0}fr) minmax(0, ${columnWidths.out_date || 1.0}fr) minmax(0, ${columnWidths.out_time || 1.0}fr) minmax(0, ${columnWidths.out_by || 1.0}fr) minmax(0, ${columnWidths.actions || 0.8}fr)`
      };
    }
    return {
      gridTemplateColumns: `minmax(0, ${columnWidths.name || 2.0}fr) minmax(0, ${columnWidths.status || 1.0}fr) minmax(0, ${columnWidths.in_date || 1.0}fr) minmax(0, ${columnWidths.in_time || 1.0}fr) minmax(0, ${columnWidths.in_by || 1.0}fr) minmax(0, ${columnWidths.out_date || 1.0}fr) minmax(0, ${columnWidths.out_time || 1.0}fr) minmax(0, ${columnWidths.out_by || 1.0}fr) minmax(0, ${columnWidths.actions || 0.8}fr)`
    };
  }, [canManageScans, columnWidths]);

  const getLeaderName = (userId) => {
    if (!userId) return '-';
    const found = roster.find(r => r.user_id === userId);
    if (found) {
      return `${found.first_name} ${found.last_initial}.`;
    }
    if (userId === user?.id) {
      return 'You';
    }
    return 'Leader';
  };

  // Status display and styling helpers
  const getDisplayStatus = (scan) => {
    const isOffline = scan.is_offline || scan.message === 'Saved Offline' || String(scan.id).startsWith('temp-');
    const isSignedOut = !!scan.raw_sign_out_time;
    if (isOffline) {
      return isSignedOut ? 'SIGNED OUT - OFFLINE' : 'SIGNED IN - OFFLINE';
    }
    return isSignedOut ? 'SIGNED OUT' : 'SIGNED IN';
  };

  const getStatusBadgeStyle = (scan) => {
    const isOffline = scan.is_offline || scan.message === 'Saved Offline' || String(scan.id).startsWith('temp-');
    const isSignedOut = !!scan.raw_sign_out_time;
    if (isOffline) {
      return {
        backgroundColor: '#eab308',
        color: '#ffffff'
      };
    }
    if (isSignedOut) {
      return {
        backgroundColor: '#3b82f6',
        color: '#ffffff'
      };
    }
    return {
      backgroundColor: '#10b981',
      color: '#ffffff'
    };
  };

  // Dynamic Options & Filtering for Attendance Table
  const uniqueMemberNames = useMemo(() => {
    const names = attendance.map(a => a.member ? `${a.member.first_name} ${a.member.last_initial}`.trim() : 'Unknown').filter(Boolean);
    return [...new Set(names)].sort();
  }, [attendance]);

  const uniqueStatuses = useMemo(() => {
    const statuses = attendance.map(a => getDisplayStatus(a)).filter(Boolean);
    return [...new Set(statuses)].sort();
  }, [attendance]);

  const uniqueInDates = useMemo(() => {
    const dates = attendance.map(a => a.in_date).filter(Boolean);
    return [...new Set(dates)].sort();
  }, [attendance]);

  const uniqueInTimes = useMemo(() => {
    const times = attendance.map(a => a.in_time).filter(Boolean);
    return [...new Set(times)].sort();
  }, [attendance]);

  const uniqueInBys = useMemo(() => {
    const list = attendance.map(a => getLeaderName(a.signed_in_by)).filter(Boolean);
    return [...new Set(list)].sort();
  }, [attendance, roster, user]);

  const uniqueOutDates = useMemo(() => {
    const dates = attendance.map(a => a.out_date).filter(Boolean);
    return [...new Set(dates)].sort();
  }, [attendance]);

  const uniqueOutTimes = useMemo(() => {
    const times = attendance.map(a => a.out_time).filter(Boolean);
    return [...new Set(times)].sort();
  }, [attendance]);

  const uniqueOutBys = useMemo(() => {
    const list = attendance.map(a => getLeaderName(a.signed_out_by)).filter(Boolean);
    return [...new Set(list)].sort();
  }, [attendance, roster, user]);

  const processedAttendance = useMemo(() => {
    let result = attendance.map(a => ({
      ...a,
      in_by: getLeaderName(a.signed_in_by),
      out_by: getLeaderName(a.signed_out_by)
    }));

    // Column Filters
    if (columnFilters.name?.length > 0) {
      result = result.filter(a => {
        const name = a.member ? `${a.member.first_name} ${a.member.last_initial}`.trim() : 'Unknown';
        return columnFilters.name.includes(name);
      });
    }

    if (columnFilters.status?.length > 0) {
      result = result.filter(a => columnFilters.status.includes(getDisplayStatus(a)));
    }

    if (columnFilters.in_date?.length > 0) {
      result = result.filter(a => columnFilters.in_date.includes(a.in_date));
    }

    if (columnFilters.in_time?.length > 0) {
      result = result.filter(a => columnFilters.in_time.includes(a.in_time));
    }

    if (columnFilters.in_by?.length > 0) {
      result = result.filter(a => columnFilters.in_by.includes(a.in_by));
    }

    if (columnFilters.out_date?.length > 0) {
      result = result.filter(a => columnFilters.out_date.includes(a.out_date));
    }

    if (columnFilters.out_time?.length > 0) {
      result = result.filter(a => columnFilters.out_time.includes(a.out_time));
    }

    if (columnFilters.out_by?.length > 0) {
      result = result.filter(a => columnFilters.out_by.includes(a.out_by));
    }

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        if (sortConfig.key === 'name') {
          return compareMemberName(a, b, sortConfig.field || 'first', sortConfig.direction);
        }

        let valA = '', valB = '';
        if (sortConfig.key === 'status') {
          valA = a.message || '';
          valB = b.message || '';
        } else if (sortConfig.key === 'in_date') {
          valA = a.raw_sign_in_time || '';
          valB = b.raw_sign_in_time || '';
        } else if (sortConfig.key === 'in_time') {
          valA = a.raw_sign_in_time || '';
          valB = b.raw_sign_in_time || '';
        } else if (sortConfig.key === 'in_by') {
          valA = a.in_by || '';
          valB = b.in_by || '';
        } else if (sortConfig.key === 'out_date') {
          valA = a.raw_sign_out_time || '';
          valB = b.raw_sign_out_time || '';
        } else if (sortConfig.key === 'out_time') {
          valA = a.raw_sign_out_time || '';
          valB = b.raw_sign_out_time || '';
        } else if (sortConfig.key === 'out_by') {
          valA = a.out_by || '';
          valB = b.out_by || '';
        }

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [attendance, columnFilters, sortConfig, roster, user]);

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
          <Link to={eventsBackPath} className="btn btn-primary">&larr; Back to Events</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', position: 'relative', flex: 1, width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', padding: '2rem' }}>

      {/* Membership expiry blocking modal — shown after successful scan when member exp is <= 30 days away */}
      <MembershipExpiryModal
        member={membershipExpiryTarget}
        onDismiss={() => {
          setMembershipExpiryTarget(null);
          if (qrEngineRef.current?.getState() === 3) {
            qrEngineRef.current.resume();
          }
        }}
      />

      {/* Top Sticky Pinned Title Bar (Floating, No Card) */}

      <div className="scanner-sticky-title">
        <Link
          to={eventsBackPath}
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

      {/* Top Hero Section (Actions Panel, Camera Feed & Header Card side-by-side on desktop) */}
      <div className="scanner-hero-section">
        {!session.ended_at ? (
          <>
            {/* Left Column: Actions Panel */}
            <div className="scanner-actions-panel">
              <div className="scanner-action-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span className="header-card-label">SCANNER ACTIONS</span>
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    title={isSoundEnabled ? "Mute Scanner Sound" : "Enable Scanner Sound"}
                    aria-label={isSoundEnabled ? "Mute Scanner Sound" : "Enable Scanner Sound"}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.2rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSoundEnabled ? '#10b981' : '#94a3b8',
                      transition: 'color 0.2s ease, transform 0.15s ease'
                    }}
                  >
                    {isSoundEnabled ? (
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.35rem', height: '1.35rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.35rem', height: '1.35rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="22" y1="9" x2="16" y2="15" />
                        <line x1="16" y1="9" x2="22" y2="15" />
                      </svg>
                    )}
                  </button>
                </div>
                {!isScanning ? (
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                    <button 
                      onClick={() => { setScanMode('IN'); startScanner(); }} 
                      className="scanner-btn-in"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.25rem', height: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 21h7a3 3 0 003-3V7a3 3 0 00-3-3h-7M3 12h14m-4-4l4 4-4 4" />
                      </svg>
                      <span>SCAN IN</span>
                    </button>
                    <button 
                      onClick={() => { setScanMode('OUT'); startScanner(); }} 
                      className="scanner-btn-out"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.25rem', height: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>SCAN OUT</span>
                    </button>
                  </div>
                ) : (
                    <button 
                      onClick={stopScanner} 
                      className="btn btn-destructive w-full"
                      style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.25rem', height: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>STOP SCANNER</span>
                    </button>
                )}

                {/* Secondary Options Box inside the same Card */}
                <div className="scanner-secondary-actions-box">
                  {/* Check in from Photos */}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <button className="scanner-action-item" style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                      <div className="scanner-action-icon-box">
                        <svg xmlns="http://www.w3.org/2000/svg" className="scanner-action-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="scanner-action-title">Check in from Photos</div>
                        <div className="scanner-action-subtitle">Upload badge photos to scan</div>
                      </div>
                    </button>
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      onChange={handleBulkPhotos} 
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} 
                    />
                  </div>

                  {/* Check in from Roster */}
                  <button onClick={() => setIsManualEntryOpen(true)} className="scanner-action-item">
                    <div className="scanner-action-icon-box">
                      <svg xmlns="http://www.w3.org/2000/svg" className="scanner-action-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="17" y1="11" x2="23" y2="11" />
                      </svg>
                    </div>
                    <div>
                      <div className="scanner-action-title">Check in from Roster</div>
                      <div className="scanner-action-subtitle">Select trailmen from a list</div>
                    </div>
                  </button>
                </div>

                {/* Delete Event Button inside Scanner Action Card */}
                {isAdminOrLeader && (
                  <button
                    type="button"
                    onClick={handleDeleteSession}
                    className="scanner-btn-delete"
                    aria-label="Delete Event"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1.25rem', height: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>DELETE EVENT</span>
                  </button>
                )}
              </div>
            </div>

            {/* Center Column: Camera Feed */}
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
                    <div className={`scanner-corner scanner-corner-tl scanner-corner-${scanFeedback.cornerStatus}`}></div>
                    <div className={`scanner-corner scanner-corner-tr scanner-corner-${scanFeedback.cornerStatus}`}></div>
                    <div className={`scanner-corner scanner-corner-bl scanner-corner-${scanFeedback.cornerStatus}`}></div>
                    <div className={`scanner-corner scanner-corner-br scanner-corner-${scanFeedback.cornerStatus}`}></div>

                    {/* Single Pass Scan Line */}
                    <div key={isScanning ? 'scanning' : 'idle'} className={`scanner-scan-line ${isScanning ? 'scan-line-active' : ''}`}></div>
                    
                    {/* Success/Warning Overlays (Centered Icon inside square) */}
                    {showCheckmark && (
                      <div className="scanner-feedback-overlay scanner-feedback-success">
                        <img src="/logo.png" alt="Success" className="scanner-feedback-icon-solo" />
                      </div>
                    )}
                    {showWarning && (
                      <div className="scanner-feedback-overlay scanner-feedback-warning">
                        <div className="scanner-feedback-warning-circle">
                          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Member Name Banner directly below square */}
                    {(showCheckmark || showWarning) && scanFeedback.displayText && (
                      <div className="scanner-feedback-sub-banner">
                        <span className="scanner-feedback-name">
                          {scanFeedback.displayText}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Accessibility: Screen Reader Live Region */}
                  <div aria-live="polite" aria-atomic="true" className="sr-only">
                    {scanFeedback.ariaAnnouncement}
                  </div>

                  {isScanning && (
                    <div className="scanner-live-badge">
                      <span 
                        className={`badge ${scanMode === 'IN' ? 'badge-success' : 'badge-info'}`} 
                        style={{ 
                          backgroundColor: 'rgba(0,0,0,0.5)', 
                          backdropFilter: 'blur(8px)',
                          borderColor: scanMode === 'IN' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)',
                          color: scanMode === 'IN' ? '#10b981' : '#3b82f6'
                        }}
                      >
                        <div 
                          className="scanner-pulse-dot" 
                          style={{ backgroundColor: scanMode === 'IN' ? '#10b981' : '#3b82f6' }}
                        ></div>
                        {scanMode === 'IN' ? 'SCANNING IN' : 'SCANNING OUT'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-card scanner-closed-container" style={{ flex: 1, textAlign: 'center', padding: '2rem', color: 'var(--foreground)' }}>
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

        {/* Right Column: Header Card */}
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
                {!session.ended_at && (
                  <button
                    type="button"
                    className="status-popover-item"
                    disabled={!isAdminOrLeader}
                    title={!isAdminOrLeader ? "Close unavailable: requires admin role" : undefined}
                    onClick={() => {
                      if (!isAdminOrLeader) return;
                      setShowStatusMenu(false);
                      handleEndSession();
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Close Event
                  </button>
                )}

                {session.ended_at && !session.synced_at && (
                  <button
                    type="button"
                    className="status-popover-item"
                    disabled={!isAdminOrLeader}
                    title={!isAdminOrLeader ? "Reopen unavailable: requires admin role" : undefined}
                    onClick={() => {
                      if (!isAdminOrLeader) return;
                      setShowStatusMenu(false);
                      handleReenableSession();
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </svg>
                    Reopen Event
                  </button>
                )}

                <button
                  type="button"
                  className="status-popover-item"
                  disabled={!isAdminOrLeader}
                  title={!isAdminOrLeader ? "Delete unavailable: requires admin role" : undefined}
                  style={{ color: 'var(--color-error)' }}
                  onClick={() => {
                    if (!isAdminOrLeader) return;
                    setShowStatusMenu(false);
                    handleDeleteSession();
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete Event
                </button>
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

          {/* Scanned Metrics */}
          {(() => {
            const scannedInCount = attendance.filter(s => !s.raw_sign_out_time).length;
            const scannedOutCount = attendance.filter(s => !!s.raw_sign_out_time).length;
            const scannedTotalCount = scannedInCount + scannedOutCount;

            return (
              <>
                {/* Scanned In Count Row */}
                <div className="grid-table-cell" role="cell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.2rem 0' }}>
                  <span className="header-card-label">Scanned In</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {scannedInCount}
                  </span>
                </div>

                {/* Scanned Out Count Row */}
                <div className="grid-table-cell" role="cell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.2rem 0' }}>
                  <span className="header-card-label">Scanned Out</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {scannedOutCount}
                  </span>
                </div>

                {/* Scanned Total Count Row */}
                <div className="grid-table-cell" role="cell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.2rem 0' }}>
                  <span className="header-card-label">Scanned Total</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {scannedTotalCount}
                  </span>
                </div>
              </>
            );
          })()}

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
                <div className="grid-table-scroll-wrapper">
                  <div className="grid-table-container">
                  {/* Table Header */}
                  <div
                    ref={headerRef}
                    className={`grid-table-header ${!canManageScans ? 'no-manage' : ''}`}
                    style={gridTemplateStyle}
                    role="row"
                  >
                    {canManageScans && (
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
                        aria-sort={sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                        title={sortConfig.key === 'name'
                          ? `Sorted by ${sortConfig.field === 'last' ? 'Last Initial' : 'First Name'} (${sortConfig.direction === 'asc' ? 'A to Z' : 'Z to A'}). Click to filter or change sort.`
                          : 'Click to filter or sort'}
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
                          sortFields={[
                            { key: 'first', label: 'First Name' },
                            { key: 'last', label: 'Last Initial' }
                          ]}
                          activeSortField={sortConfig.key === 'name' ? (sortConfig.field || 'first') : 'first'}
                          onSortFieldChange={(field) => setSortConfig(prev => ({ ...prev, key: 'name', field }))}
                          onSort={(dir) => setSortConfig(prev => ({
                            ...prev,
                            key: 'name',
                            field: prev.key === 'name' ? (prev.field || 'first') : 'first',
                            direction: dir
                          }))}
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
                        onMouseDown={(e) => handleStartResize(e, 'status', 'in_date')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Scanned In Date Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'in_date' ? null : 'in_date')}
                      >
                        Scanned in date
                        {sortConfig.key === 'in_date' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.in_date?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'in_date' && (
                        <FilterPopover
                          isOpen={true}
                          title="Scanned in date"
                          type="multiselect"
                          options={uniqueInDates.map(d => ({ label: d, value: d }))}
                          value={columnFilters.in_date || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, in_date: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="in_date"
                          onSort={(dir) => setSortConfig({ key: 'in_date', direction: dir })}
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'in_date', 'in_time')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Scanned In Time Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'in_time' ? null : 'in_time')}
                      >
                        Scanned in time
                        {sortConfig.key === 'in_time' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.in_time?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'in_time' && (
                        <FilterPopover
                          isOpen={true}
                          title="Scanned in time"
                          type="multiselect"
                          options={uniqueInTimes.map(t => ({ label: t, value: t }))}
                          value={columnFilters.in_time || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, in_time: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="in_time"
                          onSort={(dir) => setSortConfig({ key: 'in_time', direction: dir })}
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'in_time', 'in_by')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Scanned In By Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'in_by' ? null : 'in_by')}
                      >
                        Scanned in by
                        {sortConfig.key === 'in_by' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.in_by?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'in_by' && (
                        <FilterPopover
                          isOpen={true}
                          title="Scanned in by"
                          type="multiselect"
                          options={uniqueInBys.map(b => ({ label: b, value: b }))}
                          value={columnFilters.in_by || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, in_by: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="in_by"
                          onSort={(dir) => setSortConfig({ key: 'in_by', direction: dir })}
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'in_by', 'out_date')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Scanned Out Date Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'out_date' ? null : 'out_date')}
                      >
                        Scanned out date
                        {sortConfig.key === 'out_date' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.out_date?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'out_date' && (
                        <FilterPopover
                          isOpen={true}
                          title="Scanned out date"
                          type="multiselect"
                          options={uniqueOutDates.map(d => ({ label: d, value: d }))}
                          value={columnFilters.out_date || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, out_date: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="out_date"
                          onSort={(dir) => setSortConfig({ key: 'out_date', direction: dir })}
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'out_date', 'out_time')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Scanned Out Time Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'out_time' ? null : 'out_time')}
                      >
                        Scanned out time
                        {sortConfig.key === 'out_time' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.out_time?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'out_time' && (
                        <FilterPopover
                          isOpen={true}
                          title="Scanned out time"
                          type="multiselect"
                          options={uniqueOutTimes.map(t => ({ label: t, value: t }))}
                          value={columnFilters.out_time || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, out_time: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="out_time"
                          onSort={(dir) => setSortConfig({ key: 'out_time', direction: dir })}
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'out_time', 'out_by')}
                        title="Drag to resize column"
                      />
                    </div>

                    {/* Scanned Out By Header */}
                    <div role="columnheader" className="column-header-cell">
                      <button
                        type="button"
                        className="column-header-btn"
                        onClick={() => setActivePopover(activePopover === 'out_by' ? null : 'out_by')}
                      >
                        Scanned out by
                        {sortConfig.key === 'out_by' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        {columnFilters.out_by?.length > 0 && ' 🌪️'}
                      </button>
                      {activePopover === 'out_by' && (
                        <FilterPopover
                          isOpen={true}
                          title="Scanned out by"
                          type="multiselect"
                          options={uniqueOutBys.map(b => ({ label: b, value: b }))}
                          value={columnFilters.out_by || []}
                          onChange={(val) => setColumnFilters(prev => ({ ...prev, out_by: val }))}
                          onClose={() => setActivePopover(null)}
                          sortConfig={sortConfig}
                          columnKey="out_by"
                          onSort={(dir) => setSortConfig({ key: 'out_by', direction: dir })}
                        />
                      )}
                      <div
                        className="column-resizer"
                        onMouseDown={(e) => handleStartResize(e, 'out_by', 'actions')}
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
                        className={`grid-table-row ${!canManageScans ? 'no-manage' : ''} ${isNew ? 'newly-scanned' : ''}`}
                        style={gridTemplateStyle}
                        role="row"
                      >
                        <div className="grid-table-card-header">
                          {canManageScans && (
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

                          <div className="grid-table-cell grid-table-cell-name" role="cell" style={{ gridColumn: canManageScans ? 2 : 1 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{memberName}</strong>
                          </div>

                          <div className="grid-table-cell grid-table-cell-actions" role="cell" style={{ gridColumn: canManageScans ? 10 : 9 }}>
                            <button
                              type="button"
                              className="btn-icon-action btn-icon-destructive"
                              onClick={() => handleDeleteSingleScan(scan.id)}
                              title={!canManageScans ? "Delete unavailable: requires admin role" : (!scan.id || String(scan.id).startsWith('temp-') ? "Delete unavailable: scan not saved yet" : "Remove scan")}
                              disabled={!canManageScans || !scan.id || String(scan.id).startsWith('temp-')}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: canManageScans ? 3 : 2 }}>
                          <span className="grid-table-label">Status</span>
                          <button
                            type="button"
                            onClick={() => handleToggleScanStatus(scan)}
                            className="badge"
                            style={{ 
                              cursor: canManageScans ? 'pointer' : 'default', 
                              border: 'none', 
                              fontWeight: '600',
                              padding: '0.25rem 0.65rem',
                              ...getStatusBadgeStyle(scan)
                            }}
                            title={canManageScans ? "Click to toggle between Signed In and Signed Out" : undefined}
                          >
                            {getDisplayStatus(scan)}
                          </button>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: canManageScans ? 4 : 3 }}>
                          <span className="grid-table-label">Scanned in date</span>
                          <span>{scan.in_date}</span>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: canManageScans ? 5 : 4 }}>
                          <span className="grid-table-label">Scanned in time</span>
                          <span>{scan.in_time}</span>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: canManageScans ? 6 : 5 }}>
                          <span className="grid-table-label">Scanned in by</span>
                          <span>{scan.in_by}</span>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: canManageScans ? 7 : 6 }}>
                          <span className="grid-table-label">Scanned out date</span>
                          <span>{scan.out_date}</span>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: canManageScans ? 8 : 7 }}>
                          <span className="grid-table-label">Scanned out time</span>
                          <span>{scan.out_time}</span>
                        </div>

                        <div className="grid-table-cell" role="cell" style={{ gridColumn: canManageScans ? 9 : 8 }}>
                          <span className="grid-table-label">Scanned out by</span>
                          <span>{scan.out_by}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Action Floating Pill */}
        {canManageScans && selectedScans.size > 0 && (
          <div className="bulk-action-pill">
            {/* Left Side: Count, Label & Clear */}
            <div className="bulk-action-pill-info">
              <span className="bulk-action-pill-count">{selectedScans.size}</span>
              <span className="bulk-action-pill-label">Selected</span>
              <button
                type="button"
                className="btn-icon-action btn-icon-clear"
                onClick={() => setSelectedScans(new Set())}
                title="Clear selection"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Vertical Divider */}
            <div className="bulk-action-pill-divider" />

            {/* Right Side: Action Buttons */}
            <div className="bulk-action-pill-actions">
              {/* Sign in: Green */}
              <button
                type="button"
                className="btn-icon-action btn-icon-reopen"
                onClick={handleBulkScanIn}
                title="Sign in selected members"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 21h7a3 3 0 003-3V7a3 3 0 00-3-3h-7M3 12h14m-4-4l4 4-4 4" />
                </svg>
                <span className="bulk-action-btn-text">Sign in</span>
              </button>

              {/* Sign out: Blue */}
              <button
                type="button"
                className="btn-icon-action btn-icon-close"
                onClick={handleBulkSignOut}
                title="Sign out selected members"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="bulk-action-btn-text">Sign out</span>
              </button>

              {/* Remove: Red */}
              <button
                type="button"
                className="btn-icon-action btn-icon-destructive"
                onClick={handleBulkRemove}
                title="Remove selected scans"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span className="bulk-action-btn-text">Remove</span>
              </button>
            </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Last Initial"
                          maxLength={1}
                          value={manualLastInitial}
                          onChange={e => { setManualLastInitial(e.target.value); setSelectedRosterId(''); }}
                          style={{ width: '100px', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                        />
                        <LastInitialTooltip />
                      </div>
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
          setManualEntryRosterIds(new Set());
        }}
        title="Manual Entry"
        tall
      >
        <form onSubmit={handleManualEntry} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', flex: 1, minHeight: 0 }}>
            {/* Left column: roster list */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Header row: label + sort toggles */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexShrink: 0 }}>
                <label style={{ fontWeight: 600 }}>
                  Select Member{manualEntryRosterIds.size > 1 ? `s (${manualEntryRosterIds.size} selected)` : manualEntryRosterIds.size === 1 ? ' (1 selected)' : ':'}
                </label>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[
                    { key: 'first', label: 'First' },
                    { key: 'last',  label: 'Last'  },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setManualEntrySortBy(key)}
                      style={{
                        padding: '0.2rem 0.55rem',
                        fontSize: '0.78rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        fontWeight: manualEntrySortBy === key ? 700 : 400,
                        backgroundColor: manualEntrySortBy === key ? 'var(--color-primary)' : 'var(--bg-primary)',
                        color: manualEntrySortBy === key ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  flex: 1,
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0
                }}
              >
                {roster.length === 0 ? (
                  <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', margin: 'auto' }}>
                    No members found.
                  </div>
                ) : (
                  [...roster]
                    .sort((a, b) => {
                      if (manualEntrySortBy === 'last') {
                        const liA = (a.last_initial || '').toLowerCase();
                        const liB = (b.last_initial || '').toLowerCase();
                        if (liA !== liB) return liA.localeCompare(liB);
                        return (a.first_name || '').toLowerCase().localeCompare((b.first_name || '').toLowerCase());
                      }
                      // default: sort by first name then last initial
                      const fnA = (a.first_name || '').toLowerCase();
                      const fnB = (b.first_name || '').toLowerCase();
                      if (fnA !== fnB) return fnA.localeCompare(fnB);
                      return (a.last_initial || '').toLowerCase().localeCompare((b.last_initial || '').toLowerCase());
                    })
                    .map(m => {
                      const isSelected = manualEntryRosterIds.has(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setManualEntryRosterIds(prev => {
                              const next = new Set(prev);
                              if (next.has(m.id)) {
                                next.delete(m.id);
                              } else {
                                next.add(m.id);
                              }
                              return next;
                            });
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
                          {manualEntrySortBy === 'last'
                            ? <span>{m.last_initial} — {m.first_name}</span>
                            : <span>{m.first_name} {m.last_initial}</span>
                          }
                          {isSelected && <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>✓</span>}
                        </button>
                      );
                    })
                )}
              </div>
              {manualEntryRosterIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setManualEntryRosterIds(new Set())}
                  style={{ marginTop: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'left', padding: 0, flexShrink: 0 }}
                >
                  Clear selection
                </button>
              )}
            </div>

            {/* Right column: guest/new entry */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Also Add Guest/New:
              </label>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', marginTop: 0 }}>
                Roster selections stay active while you fill in a guest name.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="First Name"
                  value={manualEntryFirstName}
                  onChange={e => setManualEntryFirstName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Last Initial"
                    maxLength={1}
                    value={manualEntryLastInitial}
                    onChange={e => setManualEntryLastInitial(e.target.value)}
                    style={{ width: '100px', padding: '0.5rem', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                  />
                  <LastInitialTooltip />
                </div>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexShrink: 0 }}>
            {(() => {
              const totalCount = manualEntryRosterIds.size + (manualEntryFirstName.trim() || manualEntryLastInitial.trim() ? 1 : 0);
              const disabled = totalCount === 0;
              const label = totalCount > 1 ? `Save ${totalCount} Scans` : 'Save Scan';
              return (
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={disabled}>
                  {label}
                </button>
              );
            })()}
            <button type="button" onClick={() => setIsManualEntryOpen(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </Modal>



    </div>
  );
}
