"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OAuthCallbackClient() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      // This parses #access_token... and stores session in local storage/cookies
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        router.replace(`/signin?error=${encodeURIComponent(error.message)}`);
        return;
      }

      if (!data.session) {
        router.replace(`/signin?error=${encodeURIComponent("No session found")}`);
        return;
      }

      // Optional: sync to server if you rely on /api/auth/session
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ event: "SIGNED_IN", session: data.session }),
      });

      router.replace("/pay-bills");
    };

    run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-gray-600">Finishing sign-in…</div>
    </div>
  );
}
