import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [loading, setLoading]  = useState(true);
  
  // Store the initial redirect intent so we can restore it after Supabase clears the hash
  const isInvite = useRef(false);

  useEffect(() => {
    isInvite.current = window.location.hash.includes('type=invite');

    const hasAuthParams = 
      window.location.search.includes('access_token=') ||
      window.location.search.includes('code=') ||
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('type=invite') ||
      window.location.hash.includes('type=recovery');

    // Get the session that was persisted in localStorage on page load/PWA restart.
    // This resolves before onAuthStateChange fires, preventing a Login flash.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session || !hasAuthParams) {
        setSession(session);
        setLoading(false);
      }
    });

    // Subscribe to all future auth events (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Restore the intended route for invite links before the router mounts
        if (event === 'SIGNED_IN' && isInvite.current) {
          window.location.hash = '/profile';
          isInvite.current = false;
        }

        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // session will be set to null by onAuthStateChange automatically
  };

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Custom hook — throws a descriptive error if used outside AuthProvider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Check your component tree.');
  }
  return ctx;
}
