"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [showResend, setShowResend] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setShowResend(false);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      const msg = error.message || "Unable to sign in.";
      setErrorMsg(msg);

      // common Supabase error when email confirmation is enabled
      if (msg.toLowerCase().includes("email not confirmed")) {
        setShowResend(true);
      }

      return;
    }

    router.push("/");
  };

  const resendConfirmationEmail = async () => {
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setInfoMsg(
      "Confirmation email resent. Please check your inbox."
    );
  };

  const signInWithGoogle = async () => {
    setErrorMsg("");
    setInfoMsg("");
    setShowResend(false);
    setGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setGoogleLoading(false);

    if (error) setErrorMsg(error.message);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-[#374151] mb-6">
          Sign in to your account
        </h2>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#374151]">
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[#374151]">
              Password
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Enter your password"
                className={`${inputClass} pr-12`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label="Toggle password"
              >
                {showPwd ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {/* Resend confirmation - only shows if user isn't confirmed */}
          {showResend && (
            <div className="text-left">
              <button
                type="button"
                onClick={resendConfirmationEmail}
                disabled={loading || !email}
                className="text-sm text-[#1d4ed8] underline font-medium disabled:opacity-60"
              >
                Resend confirmation email
              </button>
            </div>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading || googleLoading}
              className="text-sm underline text-[#374151] hover:text-indigo-600 disabled:opacity-60"
            >
              {googleLoading ? "Redirecting..." : "or sign in with google"}
            </button>
          </div>

          <div className="text-sm text-left space-y-2">
            <p className="text-[#374151]">
              Don’t have an account?{" "}
              <Link href="/signup" className="text-[#1d4ed8] font-medium">
                Signup
              </Link>
            </p>

            <Link
              href="/forgot-password"
              className="text-[#1d4ed8] font-medium"
            >
              forget password
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
