"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useDispatch } from "react-redux";
import { setUser, clearUser, AuthUser } from "@/redux/slices/authSlice";
import type { User } from "@supabase/supabase-js";

export default function AuthListener() {
  const dispatch = useDispatch();

  const toAuthUser = (user: User): AuthUser => ({
    id: user.id,
    email: user.email ?? null,
    user_metadata: user.user_metadata ?? {},
    app_metadata: user.app_metadata ?? {},
  });

  useEffect(() => {
    const syncSessionToServer = async (event: string, session: any) => {
      try {
        await fetch("/api/auth/session", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, session }),
        });
      } catch {
        // ignore network errors
      }
    };

    // 1) initial session load
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session ?? null;

      if (session?.user) dispatch(setUser(toAuthUser(session.user)));
      else dispatch(clearUser());

      // Sync cookies to server
      syncSessionToServer("INITIAL_SESSION", session);
    });

    // 2) listen for future changes
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) dispatch(setUser(toAuthUser(session.user)));
      else dispatch(clearUser());

      syncSessionToServer(event, session);
    });

    return () => data.subscription.unsubscribe();
  }, [dispatch]);

  return null;
}
