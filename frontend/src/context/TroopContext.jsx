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
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to settle

    if (user) {
      fetchTroops();
    } else {
      setTroops([]);
      setSelectedTroopId('');
      setIsGlobalAdmin(false);
      setLoadingTroops(false);
    }
  }, [user, authLoading]);

  async function fetchTroops() {
    try {
      setLoadingTroops(true);
      
      const { data: globalAdminData, error: globalAdminError } = await supabase
        .from('global_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (globalAdminData) {
        setIsGlobalAdmin(true);
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
        .eq('user_id', user.id);

      if (error) throw error;
      
      const formattedTroops = (data || []).map(tu => ({
        id: tu.troop_id,
        troop_number: tu?.troops?.troop_number || 'Troop',
        currentUserRole: tu.role
      }));
      
      setTroops(formattedTroops);
      setDefaultTroop(formattedTroops);

      const needsOnboarding = data?.some(tu => tu.onboarding_completed === false);
      if (needsOnboarding) {
        window.location.hash = '#/profile';
        return;
      }
      
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

  const value = {
    troops,
    selectedTroopId,
    setSelectedTroopId,
    loadingTroops,
    isGlobalAdmin,
    error,
    refreshTroops: fetchTroops,
    selectedTroop: troops.find(t => t.id === selectedTroopId)
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
