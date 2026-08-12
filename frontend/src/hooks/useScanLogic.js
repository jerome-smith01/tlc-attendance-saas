import { useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useScanLogic(troopId, sessionId, user, roster, setRoster) {
  const lastScanRef = useRef({}); // Tracks { [badgePayload]: timestamp }

  const handleScan = useCallback(async (payload, modeOrResult, maybeResult) => {
    let mode = 'IN';
    let onResult = null;
    if (typeof modeOrResult === 'function') {
      onResult = modeOrResult;
    } else if (typeof modeOrResult === 'string') {
      mode = modeOrResult.toUpperCase();
      onResult = maybeResult;
    }

    if (!troopId || !sessionId || !user) {
      if (onResult) onResult({ status: 'error', message: 'Missing session or user context.' });
      return;
    }

    const now = Date.now();
    const lastScanTime = lastScanRef.current[`${payload}_${mode}`] || 0;

    // 3-second debounce per payload and mode
    if (now - lastScanTime < 3000) {
      return;
    }
    lastScanRef.current[`${payload}_${mode}`] = now;

    let parts = payload.split('|').map(p => p.trim());
    let tlcIdCandidate = parts.length > 1 ? parts[1] : parts[0];
    let memberIdCandidate = parts.length > 1 ? parts[0] : parts[0];

    let matchedMember = roster.find(m => m.tlc_id === tlcIdCandidate);
    
    if (!matchedMember) {
      matchedMember = roster.find(m => m.member_id === memberIdCandidate);
      
      if (matchedMember) {
        try {
          const { error } = await supabase
            .from('roster')
            .update({ tlc_id: tlcIdCandidate })
            .eq('id', matchedMember.id);
            
          if (!error) {
            setRoster(prev => prev.map(m => m.id === matchedMember.id ? { ...m, tlc_id: tlcIdCandidate } : m));
          }
        } catch (err) {
          console.warn("Failed to backfill tlc_id:", err);
        }
      }
    }

    if (!matchedMember) {
      if (onResult) {
        onResult({ 
          status: 'unknown', 
          message: 'Unknown Member', 
          payload: { tlcId: tlcIdCandidate, memberId: memberIdCandidate }
        });
      }
      return;
    }

    // Supabase Write
    try {
      const nowIso = new Date().toISOString();
      let scanData = {};

      if (mode === 'OUT') {
        // First check if an existing scan record exists
        let { data: existingScans } = await supabase
          .from('scans')
          .select('*')
          .or(`event_id.eq.${sessionId},session_id.eq.${sessionId}`)
          .eq('roster_id', matchedMember.id);

        if (existingScans && existingScans.length > 0) {
          const existing = existingScans[0];
          let { data, error } = await supabase
            .from('scans')
            .update({
              sign_out_time: nowIso,
              signed_out_by: user.id
            })
            .eq('id', existing.id)
            .select();

          if (error) {
            if (onResult) onResult({ status: 'error', message: error.message, member: matchedMember });
          } else {
            if (onResult) onResult({ status: 'success', message: 'Signed Out', member: matchedMember, scanRecord: data ? data[0] : existing, mode: 'OUT' });
          }
          return;
        } else {
          // Member was not scanned in first, insert new record with sign_out_time
          scanData = {
            event_id: sessionId,
            roster_id: matchedMember.id,
            status: 'pending',
            sign_in_time: nowIso,
            signed_in_by: user.id,
            sign_out_time: nowIso,
            signed_out_by: user.id
          };
        }
      } else {
        // Sign IN mode
        scanData = {
          event_id: sessionId,
          roster_id: matchedMember.id,
          status: 'pending',
          sign_in_time: nowIso,
          signed_in_by: user.id
        };
      }

      let { data, error } = await supabase
        .from('scans')
        .insert([scanData])
        .select();

      // Fallback for pre-migration column name 'session_id'
      if (error && (error.code === 'PGRST204' || error.message?.includes('event_id') || error.message?.includes('session_id'))) {
        delete scanData.event_id;
        scanData.session_id = sessionId;
        const res = await supabase
          .from('scans')
          .insert([scanData])
          .select();
        data = res.data;
        error = res.error;
      }

      if (error) {
        console.error('[useScanLogic] Supabase insert error:', error);
        if (error.code === '23505') { // Postgres UNIQUE violation code
          if (mode === 'IN') {
            // Already signed in, update sign in time or notify duplicate
            if (onResult) onResult({ status: 'duplicate', message: 'Already Signed In', member: matchedMember });
          } else {
            if (onResult) onResult({ status: 'duplicate', message: 'Already Signed Out', member: matchedMember });
          }
        } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          queueOfflineScan({
            ...scanData,
            scan_time: nowIso
          });
          if (onResult) onResult({ status: 'offline_queued', message: 'Saved Offline', member: matchedMember });
        } else {
          if (onResult) onResult({ status: 'error', message: error.message, member: matchedMember });
        }
      } else {
        if (onResult) onResult({ status: 'success', message: mode === 'OUT' ? 'Signed Out' : 'Success', member: matchedMember, scanRecord: data ? data[0] : null, mode });
      }
    } catch (err) {
      queueOfflineScan({
        event_id: sessionId,
        session_id: sessionId,
        roster_id: matchedMember.id,
        status: 'pending',
        signed_in_by: user.id,
        sign_in_time: new Date().toISOString()
      });
      if (onResult) onResult({ status: 'offline_queued', message: 'Saved Offline', member: matchedMember });
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
