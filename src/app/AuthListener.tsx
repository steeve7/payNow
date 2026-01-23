"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useDispatch } from "react-redux";
import { setUser, clearUser, AuthUser } from "@/redux/slices/authSlice";
import type { User } from "@supabase/supabase-js";

export default function AuthListener() {
  const dispatch = useDispatch();

  const toAuthUser = (user: User): AuthUser => {
    return {
      id: user.id,
      email: user.email ?? null, // fix undefined vs null
      user_metadata: user.user_metadata ?? {},
      app_metadata: user.app_metadata ?? {},
    };
  };

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.log("getSession error:", error.message);
        dispatch(clearUser());
        return;
      }

      if (data.session?.user) {
        dispatch(setUser(toAuthUser(data.session.user)));
      } else {
        dispatch(clearUser());
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          dispatch(setUser(toAuthUser(session.user)));
        } else {
          dispatch(clearUser());
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [dispatch]);

  return null;
}
