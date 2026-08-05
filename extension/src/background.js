import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create Supabase client and configure it to use chrome.storage.local
const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    storage: {
      getItem: async (key) => {
        const result = await chrome.storage.local.get(key);
        return result[key] || null;
      },
      setItem: async (key, value) => {
        await chrome.storage.local.set({ [key]: value });
      },
      removeItem: async (key) => {
        await chrome.storage.local.remove(key);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'LOGIN') {
    handleLogin(request.email, request.password).then(sendResponse);
    return true;
  }
  if (request.action === 'GET_ENDED_SESSIONS') {
    handleGetEndedSessions().then(sendResponse);
    return true; // Indicates async response
  }
  if (request.action === 'SYNC_ATTENDANCE') {
    handleSyncRequest(request.sessionId).then(sendResponse);
    return true; // Indicates async response
  }
  if (request.action === 'MARK_SESSION_SYNCED') {
    handleMarkSessionSynced(request.sessionId).then(sendResponse);
    return true;
  }
});

async function handleLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await chrome.storage.local.set({ supabase_session: data.session });
    return { success: true, session: data.session };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGetEndedSessions() {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) return { error: 'Authentication required' };

    // Fetch sessions that have an ended_at but no synced_at
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('id, event_name, event_date')
      .not('ended_at', 'is', null)
      .is('synced_at', null)
      .order('event_date', { ascending: false });

    if (error) {
      console.error('[TLC Sync] Error fetching sessions:', error);
      return { error: error.message };
    }

    return { data: sessions };
  } catch (err) {
    console.error('[TLC Sync] Background script error:', err);
    return { error: err.message };
  }
}

async function handleSyncRequest(sessionId) {
  try {
    if (!sessionId) return { error: 'Missing sessionId' };
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) return { error: 'Authentication required' };

    const { data: scans, error } = await supabase
      .from('scans')
      .select(`
        id,
        status,
        roster (
          member_id,
          tlc_id,
          first_name,
          last_initial
        )
      `)
      .eq('session_id', sessionId)
      .eq('status', 'approved');
      
    if (error) {
      console.error('[TLC Sync] Supabase error:', error);
      return { error: error.message };
    }

    return { data: scans };
  } catch (err) {
    console.error('[TLC Sync] Background script error:', err);
    return { error: err.message };
  }
}

async function handleMarkSessionSynced(sessionId) {
  try {
    if (!sessionId) return { error: 'Missing sessionId' };
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) return { error: 'Authentication required' };

    const { error } = await supabase
      .from('sessions')
      .update({ 
        synced_at: new Date().toISOString(),
        synced_by: session.user.id
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[TLC Sync] Error marking synced:', error);
      return { error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[TLC Sync] Background script error:', err);
    return { error: err.message };
  }
}
