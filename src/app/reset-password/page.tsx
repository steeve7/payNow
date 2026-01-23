"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      setChecking(true);

      const { data, error } = await supabase.auth.getSession();

      // If no session, the reset link is likely invalid/expired or user opened page directly
      if (error || !data.session) {
        setHasSession(false);
        setChecking(false);
        return;
      }

      setHasSession(true);
      setChecking(false);
    };

    checkSession();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!hasSession) {
      setErrorMsg(
        "This reset link is invalid or has expired. Please request a new one."
      );
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg("Password updated successfully. Redirecting to sign in...");

    setTimeout(() => {
      router.push("/signin");
    }, 1200);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-[#374151] mb-6">
          Reset password
        </h2>

        {/* Loading state while checking session */}
        {checking && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            Checking reset link...
          </div>
        )}

        {/* If invalid/expired */}
        {!checking && !hasSession && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            This reset link is invalid or has expired. Please request a new one.
            <div className="mt-2">
              <Link
                href="/forgot-password"
                className="text-[#1d4ed8] underline font-medium"
              >
                Go to forgot password
              </Link>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#374151]">
              New password
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Enter your new password"
                className={`${inputClass} pr-12`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={checking || !hasSession || loading}
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label="Toggle password"
                disabled={checking || !hasSession || loading}
              >
                {showPwd ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[#374151]">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPwd ? "text" : "password"}
                placeholder="Confirm your new password"
                className={`${inputClass} pr-12`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={checking || !hasSession || loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label="Toggle confirm password"
                disabled={checking || !hasSession || loading}
              >
                {showConfirmPwd ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={checking || !hasSession || loading}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update password"}
          </button>

          <div className="text-sm text-left">
            <Link href="/signin" className="text-[#1d4ed8] font-medium">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
