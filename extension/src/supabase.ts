import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase specific for Chrome Extensions
// We use chrome.storage.local to persist the session securely in the background
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: async (key: string): Promise<string | null> => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await chrome.storage.local.get(key);
          const val = result[key];
          return typeof val === 'string' ? val : (val ? JSON.stringify(val) : null);
        }
        return null;
      },
      setItem: async (key: string, value: string): Promise<void> => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          await chrome.storage.local.set({ [key]: value });
        }
      },
      removeItem: async (key: string): Promise<void> => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          await chrome.storage.local.remove(key);
        }
      }
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
