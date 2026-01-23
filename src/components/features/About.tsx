"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Shield } from "lucide-react";
import BillPaymentForm from "@/components/bills/BillPaymentForm";
import TransactionHistory from "@/components/transactions/TransactionHistory";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/trackEvent";

import type { Session } from "@supabase/supabase-js";

type AuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "MFA_CHALLENGE_VERIFIED";

export default function About() {
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const trackedPageViewRef = useRef(false);
  const trackedLoginRef = useRef(false);

  useEffect(() => {
    const initAuth = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.log("getUser error:", error.message);

      setUser(data?.user ?? null);
      setLoadingAuth(false);
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: AuthEvent, session: Session | null) => {
        const nextUser = session?.user ?? null;

        setUser(nextUser);
        setLoadingAuth(false);

        // Track login separately
        if (event === "SIGNED_IN" && nextUser?.id && !trackedLoginRef.current) {
          trackedLoginRef.current = true;

          trackEvent("User Logged In", {
            provider: nextUser?.app_metadata?.provider ?? "unknown",
          });
        }

        if (event === "SIGNED_OUT") {
          trackedLoginRef.current = false;
          trackEvent("User Logged Out");
        }
      }
    );

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loadingAuth) return;
    if (trackedPageViewRef.current) return;

    trackedPageViewRef.current = true;

    trackEvent("Page Viewed", {
      page: "about",
      isAuthenticated: !!user,
    });
  }, [loadingAuth, user]);

  const handleBnplClick = () => {
    trackEvent("BNPL Feature Clicked", {
      page: "about",
      isAuthenticated: !!user,
    });
  };

  return (
    <div>
      <section className="bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <BillPaymentForm />
        </div>
      </section>

      {user && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TransactionHistory />
          </div>
        </section>
      )}

      <section className="py-20 bg-white">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose PayNow?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Experience the fastest and most secure way to manage your bills
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="group p-8 rounded-2xl bg-gradient-to-br from-primary-50 to-purple-50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-shadow">
                <img
                  src="https://mocha-cdn.com/019aa842-cd89-7a58-8535-534d63b3bcf1/Untitled-design-(31).png"
                  alt="Instant Payments"
                  className="w-9 h-9"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Instant Payments
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Process your bill payments in seconds with our lightning-fast
                platform.
              </p>
            </div>

            <div className="group p-8 rounded-2xl bg-gradient-to-br from-accent-50 to-green-50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 gradient-accent rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-accent-500/30 group-hover:shadow-accent-500/50 transition-shadow">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Secure & Safe
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Bank-grade encryption protects your transactions. Your financial
                data is always safe with us.
              </p>
            </div>

            <button
              onClick={handleBnplClick}
              className="group p-8 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left w-full"
              type="button"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-shadow">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Pay Later Option
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Short on cash? Use our Buy Now Pay Later feature to pay your
                bills and settle later.
              </p>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
