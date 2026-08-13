import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const TroopContext = createContext(null);

export function TroopProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [troops, setTroops] = useState([]);
  const [selectedTroopId, setSelectedTroopId] = useState('');
  const [loadingTroops, setLoadingTroops] = useState(true);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to settle

    if (user) {
      fetchTroops();
    } else {
      setTroops([]);
      setSelectedTroopId('');
      setIsGlobalAdmin(false);
      setNeedsOnboarding(false);
      setUserDisplayName('');
      setLoadingTroops(false);
    }
  }, [user, authLoading]);

  async function refreshDisplayName() {
    const activeUser = user || (await supabase.auth.getUser())?.data?.user;
    if (!activeUser?.id || !selectedTroopId) {
      setUserDisplayName('');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('roster')
        .select('first_name, last_initial')
        .eq('user_id', activeUser.id)
        .eq('troop_id', selectedTroopId)
        .maybeSingle();

      if (error) throw error;
      if (data && data.first_name) {
        const initial = data.last_initial ? ` ${data.last_initial.charAt(0).toUpperCase()}.` : '';
        setUserDisplayName(`${data.first_name.trim()}${initial}`);
      } else {
        setUserDisplayName('');
      }
    } catch (err) {
      console.error('Error fetching user display name:', err);
      setUserDisplayName('');
    }
  }

  useEffect(() => {
    if (user && selectedTroopId) {
      refreshDisplayName();
    } else {
      setUserDisplayName('');
    }
  }, [user, selectedTroopId]);

  async function fetchTroops() {
    try {
      setLoadingTroops(true);

      const activeUser = user || (await supabase.auth.getUser())?.data?.user;
      if (!activeUser?.id) {
        setTroops([]);
        setSelectedTroopId('');
        setIsGlobalAdmin(false);
        setNeedsOnboarding(false);
        setUserDisplayName('');
        setLoadingTroops(false);
        return;
      }

      const { data: globalAdminData, error: globalAdminError } = await supabase
        .from('global_admins')
        .select('id')
        .eq('user_id', activeUser.id)
        .maybeSingle();
        
      if (globalAdminData) {
        setIsGlobalAdmin(true);
        setNeedsOnboarding(false);
        const { data: allTroops, error: troopsError } = await supabase
          .from('troops')
          .select('id, troop_number');
          
        if (troopsError) throw troopsError;
        setTroops(allTroops || []);
        setDefaultTroop(allTroops || []);
        return;
      }

      const { data, error } = await supabase
        .from('troop_users')
        .select(`
          troop_id,
          role,
          onboarding_completed,
          troops (
            troop_number
          )
        `)
        .eq('user_id', activeUser.id);

      if (error) throw error;
      
      const formattedTroops = (data || []).map(tu => ({
        id: tu.troop_id,
        troop_number: tu?.troops?.troop_number || 'Troop',
        currentUserRole: tu.role
      }));
      
      setTroops(formattedTroops);
      setDefaultTroop(formattedTroops);

      const needsOnboardingFlag = data?.some(tu => tu.onboarding_completed === false);
      setNeedsOnboarding(needsOnboardingFlag || false);
      
    } catch (err) {
      console.error('Error fetching troops:', err);
      setError(err.message);
    } finally {
      setLoadingTroops(false);
    }
  }

  function setDefaultTroop(availableTroops) {
    if (availableTroops.length === 0) return;
    
    const saved = localStorage.getItem('tlc_last_troop_id');
    if (saved && availableTroops.find(t => t.id === saved)) {
      setSelectedTroopId(saved);
    } else {
      setSelectedTroopId(availableTroops[0].id);
    }
  }

  // Update localStorage whenever selectedTroopId changes
  useEffect(() => {
    if (selectedTroopId) {
      localStorage.setItem('tlc_last_troop_id', selectedTroopId);
    }
  }, [selectedTroopId]);

  const selectedTroop = troops.find(t => t.id === selectedTroopId);
  const selectedTroopIdentifier = selectedTroop?.troop_number || selectedTroopId || '';

  function getTroopByNumberOrId(identifier) {
    if (!identifier) return null;
    const lower = identifier.toLowerCase();
    return troops.find(t => t.id === identifier || (t.troop_number && t.troop_number.toLowerCase() === lower)) || null;
  }

  function selectTroopByNumberOrId(identifier) {
    const found = getTroopByNumberOrId(identifier);
    if (found && found.id !== selectedTroopId) {
      setSelectedTroopId(found.id);
      return found;
    }
    return found;
  }

  const value = {
    troops,
    selectedTroopId,
    setSelectedTroopId,
    selectedTroop,
    selectedTroopIdentifier,
    getTroopByNumberOrId,
    selectTroopByNumberOrId,
    loadingTroops,
    isGlobalAdmin,
    needsOnboarding,
    userDisplayName,
    refreshDisplayName,
    error,
    refreshTroops: fetchTroops
  };

  return <TroopContext.Provider value={value}>{children}</TroopContext.Provider>;
}

export function useTroop() {
  const ctx = useContext(TroopContext);
  if (ctx === null) {
    throw new Error('useTroop() must be used inside <TroopProvider>');
  }
  return ctx;
}
