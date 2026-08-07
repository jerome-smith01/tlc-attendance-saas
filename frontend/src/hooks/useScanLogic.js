import { useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useScanLogic(troopId, sessionId, user, roster, setRoster) {
  const lastScanRef = useRef({}); // Tracks { [badgePayload]: timestamp }

  const handleScan = useCallback(async (payload, onResult) => {
    if (!troopId || !sessionId || !user) {
      onResult({ status: 'error', message: 'Missing session or user context.' });
      return;
    }

    const now = Date.now();
    const lastScanTime = lastScanRef.current[payload] || 0;

    // 3-second debounce
    if (now - lastScanTime < 3000) {
      // Silently ignore rapid duplicate scans of the exact same payload
      return;
    }
    lastScanRef.current[payload] = now;

    // Parse payload (TLC format usually is memberId | tlcId or just tlcId)
    // We will loosely check if it contains a pipe, or try to match both
    let parts = payload.split('|').map(p => p.trim());
    let tlcIdCandidate = parts.length > 1 ? parts[1] : parts[0];
    let memberIdCandidate = parts.length > 1 ? parts[0] : parts[0];

    // Find match in roster
    let matchedMember = roster.find(m => m.tlc_id === tlcIdCandidate);
    
    // Fallback: match by member_id
    if (!matchedMember) {
      matchedMember = roster.find(m => m.member_id === memberIdCandidate);
      
      // TLC ID Backfill
      if (matchedMember) {
        try {
          const { error } = await supabase
            .from('roster')
            .update({ tlc_id: tlcIdCandidate })
            .eq('id', matchedMember.id);
            
          if (!error) {
            // Update local roster state so we don't hit DB again for this
            setRoster(prev => prev.map(m => m.id === matchedMember.id ? { ...m, tlc_id: tlcIdCandidate } : m));
          }
        } catch (err) {
          console.warn("Failed to backfill tlc_id:", err);
        }
      }
    }

    if (!matchedMember) {
      // Unknown member logic: play error sound, trigger modal
      onResult({ 
        status: 'unknown', 
        message: 'Unknown Member', 
        payload: { tlcId: tlcIdCandidate, memberId: memberIdCandidate }
      });
      return;
    }

    // Supabase Write (Online)
    try {
      const { data, error } = await supabase
        .from('scans')
        .insert([{
          session_id: sessionId,
          roster_id: matchedMember.id,
          status: 'pending',
          scanned_by: user.id
        }])
        .select();

      if (error) {
        console.error('[useScanLogic] Supabase insert error:', error);
        if (error.code === '23505') { // Postgres UNIQUE violation code
          onResult({ status: 'duplicate', message: 'Already Scanned', member: matchedMember });
        } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          // Network error -> Queue offline
          queueOfflineScan({
            session_id: sessionId,
            roster_id: matchedMember.id,
            status: 'pending',
            scanned_by: user.id,
            scan_time: new Date().toISOString()
          });
          onResult({ status: 'offline_queued', message: 'Saved Offline', member: matchedMember });
        } else {
          onResult({ status: 'error', message: error.message, member: matchedMember });
        }
      } else {
        onResult({ status: 'success', message: 'Success', member: matchedMember, scanRecord: data[0] });
      }
    } catch (err) {
      // Fallback for network error exception
      queueOfflineScan({
        session_id: sessionId,
        roster_id: matchedMember.id,
        status: 'pending',
        scanned_by: user.id,
        scan_time: new Date().toISOString()
      });
      onResult({ status: 'offline_queued', message: 'Saved Offline', member: matchedMember });
    }
  }, [troopId, sessionId, user, roster, setRoster]);

  function queueOfflineScan(scanRecord) {
    try {
      const existing = JSON.parse(localStorage.getItem('tlc_offline_scans') || '[]');
      existing.push(scanRecord);
      localStorage.setItem('tlc_offline_scans', JSON.stringify(existing));
    } catch (e) {
      console.error("Local storage error:", e);
    }
  }

  return { handleScan };
}
