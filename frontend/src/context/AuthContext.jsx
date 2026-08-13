import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

async function ensureOAuthProfileMetadata(user) {
  if (!user) return;
  if (user.user_metadata?.first_name && user.user_metadata?.last_initial) return;

  const metaFirst = user.user_metadata?.given_name || user.user_metadata?.first_name || '';
  const metaLast = user.user_metadata?.family_name || user.user_metadata?.last_name || user.user_metadata?.last_initial || '';
  const metaFullName = (user.user_metadata?.full_name || user.user_metadata?.name || '').trim();

  let extractedFirst = metaFirst.trim();
  let extractedLastInitial = metaLast.trim() ? metaLast.trim().charAt(0).toUpperCase() : '';

  if ((!extractedFirst || !extractedLastInitial) && metaFullName) {
    const parts = metaFullName.split(/\s+/).filter(Boolean);
    if (!extractedFirst && parts.length > 0) {
      extractedFirst = parts[0];
    }
    if (!extractedLastInitial && parts.length > 1) {
      extractedLastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    }
  }

  if ((!extractedFirst || !extractedLastInitial) && user.email) {
    const prefix = user.email.split('@')[0];
    const nameParts = prefix.split(/[._-]/).filter(Boolean);
    if (!extractedFirst && nameParts.length > 0) {
      extractedFirst = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
    }
    if (!extractedLastInitial && nameParts.length > 1) {
      extractedLastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
    }
  }

  if (extractedFirst && extractedLastInitial) {
    try {
      await supabase.auth.updateUser({
        data: {
          first_name: extractedFirst,
          last_initial: extractedLastInitial,
          full_name: `${extractedFirst} ${extractedLastInitial}.`
        }
      });
    } catch (err) {
      console.error('[AuthContext] Failed to seed OAuth user_metadata:', err);
    }
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [loading, setLoading]  = useState(true);
  
  useEffect(() => {
    const hasAuthParams = 
      window.location.search.includes('access_token=') ||
      window.location.search.includes('code=') ||
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('type=recovery');

    // Get the session that was persisted in localStorage on page load/PWA restart.
    // This resolves before onAuthStateChange fires, preventing a Login flash.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session || !hasAuthParams) {
        setSession(session);
        setLoading(false);
        if (session?.user) {
          ensureOAuthProfileMetadata(session.user);
        }
      }
    });

    // Subscribe to all future auth events (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          ensureOAuthProfileMetadata(session.user);
        }
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
