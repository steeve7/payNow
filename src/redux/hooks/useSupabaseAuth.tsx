"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const initializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);

      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) console.error("getSession error:", error.message);

      setUser(data.session?.user ?? null);
      setLoading(false);
      initializedRef.current = true;
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      // only end loading after we have initialized once
      if (!initializedRef.current) {
        initializedRef.current = true;
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // NOTE: Google login removed because you said google is for users only
  const logout = async () => {
    await supabase.auth.signOut();
  };

  return { user, logout, loading };
}
