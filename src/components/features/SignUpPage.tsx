"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

function normalizeEmail(raw: string) {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [agreed, setAgreed] = useState(false); // NEW

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPostSignupActions, setShowPostSignupActions] = useState(false);

  const [signupEmail, setSignupEmail] = useState("");

  const phoneError = useMemo(() => {
    if (!phone) return "";
    if (!/^\d+$/.test(phone)) return "Phone number must contain digits only.";
    if (phone.length !== 11) return "Phone number must be 11 digits.";
    return "";
  }, [phone]);

  const clearInputs = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setShowPwd(false);
    setShowConfirmPwd(false);
    setAgreed(false); // NEW
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setShowPostSignupActions(false);

    // Guard (also keep on server-side logic, even though button is disabled)
    if (!agreed) {
      return setErrorMsg(
        "You must agree to PayNow’s Privacy Policy and Terms & Conditions."
      );
    }

    if (phoneError) return setErrorMsg(phoneError);
    if (password !== confirmPassword)
      return setErrorMsg("Passwords do not match.");

    const usedEmail = normalizeEmail(email);
    if (!usedEmail || !isValidEmail(usedEmail)) {
      return setErrorMsg("Unable to validate email.");
    }

    setSignupEmail(usedEmail);
    setLoading(true);

    // 1) CHECK EMAIL EXISTS FIRST
    try {
      const res = await fetch(
        `/api/auth/email-exists?email=${encodeURIComponent(usedEmail)}`,
        { cache: "no-store" }
      );

      const text = await res.text();
      let json: any = null;

      try {
        json = JSON.parse(text);
      } catch {
        setLoading(false);
        return setErrorMsg(
          `Email check failed (non-JSON): ${text.slice(0, 120)}`
        );
      }

      if (!res.ok) {
        setLoading(false);
        return setErrorMsg(json?.error || `Email check failed (${res.status})`);
      }

      if (json?.exists) {
        setLoading(false);
        setShowPostSignupActions(true);
        return setErrorMsg("Email already exist, kindly sign-in.");
      }
    } catch (e: any) {
      setLoading(false);
      return setErrorMsg(
        `Email check failed: ${e?.message || "Network error"}`
      );
    }

    // 2) NOW create account
    const { error } = await supabase.auth.signUp({
      email: usedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName.trim(),
          phone,
          role: "user",
          agreed_to_terms: true, // optional metadata flag
          agreed_at: new Date().toISOString(), // optional metadata timestamp
        },
      },
    });

    setLoading(false);

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("exists") ||
        msg.includes("registered")
      ) {
        setShowPostSignupActions(true);
        return setErrorMsg("Email already exist, kindly sign-in.");
      }
      if (msg.includes("validate email")) {
        return setErrorMsg("Unable to validate email.");
      }
      return setErrorMsg(error.message);
    }

    clearInputs();
    setSuccessMsg("Sign-Up Successfull, Confirmation email sent!");
    setShowPostSignupActions(true);
  };

  const resendConfirmationEmail = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setResendLoading(true);

    const targetEmail = normalizeEmail(signupEmail);
    if (!targetEmail || !isValidEmail(targetEmail)) {
      setResendLoading(false);
      return setErrorMsg("Unable to validate email.");
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setResendLoading(false);

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("validate email"))
        return setErrorMsg("Unable to validate email.");
      return setErrorMsg(error.message);
    }

    setSuccessMsg("Confirmation email resent. Please check your inbox.");
    setShowPostSignupActions(true);
  };

  // Disable submit until checkbox is checked (and also block while loading)
  const submitDisabled = loading || resendLoading || !agreed;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-[#374151] mb-6">
          Create your account
        </h2>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#374151]">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Enter your Full name"
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading || resendLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[#374151]">
              Email
            </label>
            <input
              type="email"
              placeholder="enter your email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || resendLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[#374151]">
              Phone number (11 digits)
            </label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Enter your Phone number"
              className={inputClass}
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              required
              disabled={loading || resendLoading}
            />
            {phoneError && (
              <p className="mt-1 text-sm text-red-600">{phoneError}</p>
            )}
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
                disabled={loading || resendLoading}
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={loading || resendLoading}
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

          <div>
            <label className="block text-sm font-medium mb-1 text-[#374151]">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPwd ? "text" : "password"}
                placeholder="Confirm password"
                className={`${inputClass} pr-12`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading || resendLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={loading || resendLoading}
                aria-label="Toggle confirm password"
              >
                {showConfirmPwd ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Terms & Privacy (must agree) */}
          <div className="flex items-start gap-2 text-sm text-[#374151]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
              disabled={loading || resendLoading}
            />
            <p>
              I have read and agreed to PayNow’s{" "}
              <Link
                href="/privacy-policy"
                target="_blank"
                className="text-[#1d4ed8] font-medium underline hover:text-indigo-700"
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/terms-of-service"
                target="_blank"
                className="text-[#1d4ed8] font-medium underline hover:text-indigo-700"
              >
                Terms & Conditions
              </Link>
            </p>
          </div>

          {/* Submit disabled until agreed */}
          <button
            type="submit"
            disabled={submitDisabled}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            title={
              !agreed ? "Please agree to Privacy Policy and Terms first" : ""
            }
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>

          {showPostSignupActions ? (
            <div className="space-y-2 text-sm text-left">
              <button
                type="button"
                onClick={resendConfirmationEmail}
                disabled={resendLoading || !signupEmail}
                className="text-[#1d4ed8] underline font-medium disabled:opacity-60"
              >
                {resendLoading ? "Resending..." : "Resend confirmation email"}
              </button>

              <p className="text-[#374151]">
                Already have an account?{" "}
                <Link href="/signin" className="text-[#1d4ed8] font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <div className="text-sm text-left">
              <p className="text-[#374151]">
                Already have an account?{" "}
                <Link href="/signin" className="text-[#1d4ed8] font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
