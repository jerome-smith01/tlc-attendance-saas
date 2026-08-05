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

document.addEventListener('DOMContentLoaded', async () => {
  const loginContainer = document.getElementById('login-container');
  const loggedInContainer = document.getElementById('logged-in-container');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userEmailSpan = document.getElementById('user-email');
  const statusMessage = document.getElementById('status-message');

  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'error' : 'success';
  }

  function updateUI(session) {
    if (session) {
      loginContainer.classList.add('hidden');
      loggedInContainer.classList.remove('hidden');
      userEmailSpan.textContent = session.user.email;
      showStatus('');
    } else {
      loginContainer.classList.remove('hidden');
      loggedInContainer.classList.add('hidden');
      userEmailSpan.textContent = '';
    }
  }

  // Check initial session
  const { data: { session } } = await supabase.auth.getSession();
  updateUI(session);

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    updateUI(session);
    
    // Explicitly save the session object to 'supabase_session' as referenced by content script spec
    if (session) {
      chrome.storage.local.set({ supabase_session: session });
    } else {
      chrome.storage.local.remove('supabase_session');
    }
  });

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
      showStatus('Please enter email and password', true);
      return;
    }
    
    loginBtn.disabled = true;
    showStatus('Logging in...');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    loginBtn.disabled = false;
    
    if (error) {
      showStatus(error.message, true);
    } else {
      showStatus('Logged in successfully!');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    await supabase.auth.signOut();
    logoutBtn.disabled = false;
    showStatus('Logged out.');
  });
});
