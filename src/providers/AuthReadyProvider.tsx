"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";
import { supabase } from "@/lib/supabase";
import type { AuthUser } from "@/redux/slices/authSlice"; // update path if yours differs

type AuthReadyContextValue = {
  isAuthReady: boolean;
  user: AuthUser | null;
  isLoggedIn: boolean;
};

const AuthReadyContext = createContext<AuthReadyContextValue>({
  isAuthReady: false,
  user: null,
  isLoggedIn: false,
});

export function AuthReadyProvider({ children }: { children: React.ReactNode }) {
  const reduxUser = useSelector((state: RootState) => state.auth.user);

  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        setSessionUserId(data.session?.user?.id ?? null);
        setSessionChecked(true);
      } catch {
        if (!alive) return;
        setSessionUserId(null);
        setSessionChecked(true);
      }
    };

    check();

    // keep it live (login/logout updates immediately)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null);
      setSessionChecked(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ✅ Auth is "ready" once we've checked Supabase session at least once.
  const isAuthReady = sessionChecked;

  // ✅ Logged in if Supabase has a session user
  const isLoggedIn = !!sessionUserId;

  // ✅ Prefer Redux user if you keep it in sync, otherwise fall back to session id presence
  const user = reduxUser ?? null;

  const value = useMemo(
    () => ({
      isAuthReady,
      user,
      isLoggedIn,
    }),
    [isAuthReady, user, isLoggedIn]
  );

  return (
    <AuthReadyContext.Provider value={value}>
      {children}
    </AuthReadyContext.Provider>
  );
}

export function useAuthReady() {
  return useContext(AuthReadyContext);
}
