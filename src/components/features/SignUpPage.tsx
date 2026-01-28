"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600";

function normalizeEmail(v: string) {
  return (v || "").trim().toLowerCase();
}

function isEmailExistsError(message: string) {
  const m = (message || "").toLowerCase();

  // Supabase can return slightly different strings depending on config/provider.
  // These catch the most common cases.
  return (
    m.includes("already registered") ||
    m.includes("already exists") ||
    m.includes("user already registered") ||
    m.includes("email already") ||
    m.includes("duplicate") ||
    m.includes("unique constraint")
  );
}

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPostSignupActions, setShowPostSignupActions] = useState(false);

  // store the email used for signup, so we can resend even after clearing input
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
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setShowPostSignupActions(false);

    if (phoneError) {
      setErrorMsg(phoneError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    const usedEmail = normalizeEmail(email);
    setSignupEmail(usedEmail);

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: usedEmail,
      password,
      options: {
        // Redirect link inside the confirmation email
        emailRedirectTo: `${window.location.origin}/signin`,
        data: {
          full_name: fullName,
          phone,
          role: "user",
        },
      },
    });

    setLoading(false);

    if (error) {
      // ✅ Email exists handling
      if (isEmailExistsError(error.message)) {
        setErrorMsg("Email already exist, kindly signin");
        setShowPostSignupActions(false);
        return;
      }

      setErrorMsg(error.message || "Unable to sign up.");
      return;
    }

    // If email confirmations are enabled:
    // - user may be null or user exists but session null until confirmed.
    // We'll just show your success message either way.
    // If confirmations are disabled, Supabase may auto-create session; still fine.
    const createdEmail = data?.user?.email || usedEmail;

    clearInputs();

    // ✅ Your exact message
    setSuccessMsg("Sign-Up Successfull, Confirmation email sent!");

    // Helpful note (doesn't change your message)
    // You can remove this block if you want.
    // (Still not guaranteeing delivery; just helps user find it.)
    // setSuccessMsg(
    //   (prev) =>
    //     `${prev}\nIf you don’t see it in 1–2 minutes, check Spam/Promotions.`
    // );

    // show resend + signin section
    setShowPostSignupActions(true);

    // keep signupEmail even after clearInputs (we already stored it)
    setSignupEmail(normalizeEmail(createdEmail));
  };

  const resendConfirmationEmail = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setResendLoading(true);

    const targetEmail = normalizeEmail(signupEmail);

    if (!targetEmail) {
      setResendLoading(false);
      setErrorMsg("Please enter an email first.");
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/signin`,
      },
    });

    setResendLoading(false);

    if (error) {
      // If they try resending for an email that doesn't exist or other issues
      setErrorMsg(error.message || "Unable to resend confirmation email.");
      return;
    }

    // ✅ Your exact message
    setSuccessMsg("Confirmation email resent. Please check your inbox.");
    setSuccessMsg((prev) => `${prev}\nAlso check Spam/Promotions.`);
    setShowPostSignupActions(true);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-[#374151] mb-6">
          Create your account
        </h2>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 whitespace-pre-line">
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
              placeholder="Enter you Full name"
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
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                setPhone(v);
              }}
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
                aria-label="Toggle password"
                disabled={loading || resendLoading}
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
                aria-label="Toggle confirm password"
                disabled={loading || resendLoading}
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
            disabled={loading || resendLoading}
            className="w-full rounded-xl bg-indigo-600 text-white py-3 font-medium hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>

          {/* Post-signup actions */}
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
