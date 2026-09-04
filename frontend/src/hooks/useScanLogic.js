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

      // Helper to fetch existing scan safely
      async function getExistingScan() {
        let { data, error } = await supabase
          .from('scans')
          .select('*')
          .eq('event_id', sessionId)
          .eq('roster_id', matchedMember.id)
          .maybeSingle();

        return data;
      }

      const existingScan = await getExistingScan();

      if (mode === 'OUT') {
        if (existingScan) {
          if (existingScan.sign_out_time) {
            // Already signed out! Block duplicate scan out
            if (onResult) onResult({ status: 'duplicate', message: 'Already Signed Out', member: matchedMember });
            return;
          }

          // Member is currently Signed In -> Update record to Sign Out
          let { data, error } = await supabase
            .from('scans')
            .update({
              sign_out_time: nowIso,
              signed_out_by: user.id,
              status: 'complete'
            })
            .eq('id', existingScan.id)
            .select();

          if (error) {
            if (onResult) onResult({ status: 'error', message: error.message, member: matchedMember });
          } else {
            if (onResult) onResult({ status: 'success', message: 'Signed Out', member: matchedMember, scanRecord: data ? data[0] : existingScan, mode: 'OUT' });
          }
          return;
        } else {
          // Member was not scanned in first, insert new scan out record
          const newRecord = {
            event_id: sessionId,
            roster_id: matchedMember.id,
            status: 'complete',
            sign_in_time: nowIso,
            signed_in_by: user.id,
            sign_out_time: nowIso,
            signed_out_by: user.id
          };
          let { data, error } = await supabase.from('scans').insert([newRecord]).select();
          if (error) {
            if (onResult) onResult({ status: 'error', message: error.message, member: matchedMember });
          } else {
            if (onResult) onResult({ status: 'success', message: 'Signed Out', member: matchedMember, scanRecord: data ? data[0] : null, mode: 'OUT' });
          }
          return;
        }
      } else {
        // Mode === 'IN'
        if (existingScan) {
          if (!existingScan.sign_out_time) {
            // Already signed in (and not signed out yet)! Block duplicate scan in
            if (onResult) onResult({ status: 'duplicate', message: 'Already Signed In', member: matchedMember });
            return;
          }

          // Member was previously signed out, now re-signing IN -> Clear sign_out_time & update sign_in_time
          let { data, error } = await supabase
            .from('scans')
            .update({
              sign_in_time: nowIso,
              signed_in_by: user.id,
              sign_out_time: null,
              signed_out_by: null,
              status: 'pending'
            })
            .eq('id', existingScan.id)
            .select();

          if (error) {
            if (onResult) onResult({ status: 'error', message: error.message, member: matchedMember });
          } else {
            if (onResult) onResult({ status: 'success', message: 'Signed In', member: matchedMember, scanRecord: data ? data[0] : existingScan, mode: 'IN' });
          }
          return;
        }

        // New Sign In record
        const scanData = {
          event_id: sessionId,
          roster_id: matchedMember.id,
          status: 'pending',
          sign_in_time: nowIso,
          signed_in_by: user.id
        };

        let { data, error } = await supabase.from('scans').insert([scanData]).select();

        if (error) {
          console.error('[useScanLogic] Supabase insert error:', error);
          if (error.code === '23505') {
            if (onResult) onResult({ status: 'duplicate', message: 'Already Signed In', member: matchedMember });
          } else if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
            queueOfflineScan({ ...scanData, scan_time: nowIso });
            if (onResult) onResult({ status: 'offline_queued', message: 'Saved Offline', member: matchedMember });
          } else {
            if (onResult) onResult({ status: 'error', message: error.message, member: matchedMember });
          }
        } else {
          if (onResult) onResult({ status: 'success', message: 'Signed In', member: matchedMember, scanRecord: data ? data[0] : null, mode: 'IN' });
        }
      }
    } catch (err) {
      queueOfflineScan({
        event_id: sessionId,
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
