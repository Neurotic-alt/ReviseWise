import { supabase } from "@/integrations/supabase/client";

// The generated client throws when the build is missing its connection settings.
// Everything that reaches the account goes through here, so a missing connection
// leaves the app in guest mode (data kept in this browser) instead of crashing.
let available: boolean | undefined;

export function backend(): typeof supabase | null {
  if (available === undefined) {
    try {
      void supabase.auth;
      available = true;
    } catch (err) {
      console.warn("[backend] not configured — running in guest mode", err);
      available = false;
    }
  }
  return available ? supabase : null;
}

/** For tests only. */
export function resetBackendCheck() {
  available = undefined;
}
