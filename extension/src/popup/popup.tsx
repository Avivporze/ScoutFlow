import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { User } from '@supabase/supabase-js';
import { LogIn, LogOut, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';

function isOnTmPlayerProfile(url: string | undefined): boolean {
  if (!url) return false;
  return /transfermarkt\.com\/.*\/profil\/spieler\//i.test(url);
}

function Popup() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onTmProfile, setOnTmProfile] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Detect current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setOnTmProfile(isOnTmPlayerProfile(tabs[0]?.url));
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthenticating(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
    } catch (err: any) {
      setAuthError(err.message || 'Failed to login');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // LOGGED IN VIEW
  if (user) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className={`${onTmProfile ? 'bg-green-600 border-green-700' : 'bg-blue-600 border-blue-700'} text-white p-4 items-center justify-center flex flex-col pt-8 pb-6 border-b`}>
          <div className="bg-white/20 p-3 rounded-full mb-3">
             <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">ScoutFlow Connected</h1>
          <p className={`${onTmProfile ? 'text-green-100' : 'text-blue-100'} text-sm mt-1`}>
            {onTmProfile ? 'Syncing player data...' : 'Ready to extract Transfermarkt data'}
          </p>
        </div>

        <div className="flex-1 p-5 flex flex-col text-sm text-gray-600 text-center justify-center">
          <p className="mb-2">Logged in as:</p>
          <p className="font-medium text-gray-900 truncate bg-gray-50 p-2 rounded border border-gray-200">{user.email}</p>

          <div className="mt-8">
            {onTmProfile ? (
              <p className="text-xs text-green-700 bg-green-50 p-3 rounded-lg border border-green-100 mb-6">
                Player data is being extracted and synced automatically.
              </p>
            ) : (
              <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-6">
                Navigate to any Transfermarkt player profile. The Ride-Along script runs automatically behind the scenes.
              </p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // LOGGED OUT VIEW
  return (
    <div className="flex flex-col h-full p-6 bg-white">
      <div className="text-center mb-6 mt-4">
        <h1 className="text-xl font-bold text-gray-900">ScoutFlow</h1>
        <p className="text-sm text-gray-500 mt-1">Ride-Along Extension</p>
      </div>

      <form onSubmit={handleLogin} className="flex-1 flex flex-col gap-4">
        {authError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md">
            {authError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="scout@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="••••••••"
          />
        </div>

        <div className="mt-auto">
          <button
            type="submit"
            disabled={authenticating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {authenticating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {authenticating ? 'Connecting...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
