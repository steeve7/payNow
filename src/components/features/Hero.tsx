"use client";

import ServiceCard from "@/components/features/ServiceCard";
import FeatureCard from "@/components/features/FeatureCard";
import PaymentTypeCard from "@/components/features/PaymentTypeCard";
import {
  Lightbulb,
  Smartphone,
  Plane,
  Wifi,
  Tv,
  GraduationCap,
  Lock,
  Zap,
  MapPin,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Hero() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Prevent flicker: don't show Sign-In until we confirm session
  useEffect(() => {
    let alive = true;

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        setIsLoggedIn(!!data.session?.user);
        setIsAuthReady(true);
      } catch {
        if (!alive) return;
        setIsLoggedIn(false);
        setIsAuthReady(true);
      }
    };

    boot();

    // Also listen for auth changes (login/logout) to update CTA immediately
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
      setIsAuthReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const primaryBtnClass =
    "px-8 py-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition shadow-lg shadow-purple-200";

  const secondaryBtnClass =
    "px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition border-2 border-gray-200";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* Hero Section */}
      <section className="py-16 px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center lg:px-10">
          <div className="lg:-mt-52">
            <h1 className="text-5xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Pay Your Bills Instantly
              <br />
              in Nigeria
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Buy airtime, data, electricity, cable TV, WAEC &amp; international
              airtime — all in one secure platform.
            </p>

            {/* Updated CTA */}
            <div className="flex flex-wrap gap-4 min-h-[64px]">
              {!isAuthReady ? (
                // Skeleton (no flicker)
                <>
                  <div className="h-[56px] w-[160px] rounded-xl bg-gray-200 animate-pulse" />
                  <div className="h-[56px] w-[160px] rounded-xl bg-gray-200 animate-pulse" />
                </>
              ) : isLoggedIn ? (
                // Logged in => Pay Bills (same Sign-In style)
                <Link href="/pay-bills" className={primaryBtnClass}>
                  Pay Bills
                </Link>
              ) : (
                // Logged out => Sign-In / Sign-Up
                <>
                  <Link href="/signin" className={primaryBtnClass}>
                    Sign-In
                  </Link>
                  <Link href="/signup" className={secondaryBtnClass}>
                    Sign-Up
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Pay Your Bills
            </h2>
            <p className="text-gray-600 mb-6">
              Select a bill and receive instant service
            </p>

            <div className="grid grid-cols-2 gap-4">
              <ServiceCard icon={Lightbulb} label="Electricity" />
              <ServiceCard icon={Smartphone} label="Airtime" />
              <ServiceCard icon={Plane} label="International Airtime" />
              <ServiceCard icon={Wifi} label="Internet Data" />
              <ServiceCard icon={Tv} label="Cable TV" />
              <ServiceCard icon={GraduationCap} label="Education (WAEC)" />
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section className="py-20 px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">
            Why Nigerians Use <span className="text-purple-600">PayNow.ng</span>
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            <FeatureCard
              icon={Lock}
              title="Secure Payments"
              description="Choose the bill you want to pay securely with advanced encryption"
            />
            <FeatureCard
              icon={Zap}
              title="Instant Processing"
              description="Meter number, phone number, or smart card processed instantly"
            />
            <FeatureCard
              icon={MapPin}
              title="Built for Nigeria 🇳🇬"
              description="Meter number, phone number, or smart card - optimized for Nigerian services"
            />
            <FeatureCard
              icon={Tv}
              title="Cable TV"
              description="Television subscriptions for DsTv, GoTv, Startimes, and Showmax"
            />
            <FeatureCard
              icon={Clock}
              title="24/7 Availability"
              description="Delivery in seconds, anytime you need it"
            />
          </div>
        </div>
      </section>

      {/* What You Can Pay Section */}
      <section className="py-20 px-8 bg-gradient-to-br from-purple-50 to-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">
            What You Can Pay on{" "}
            <span className="text-purple-600">PayNow.ng</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <PaymentTypeCard
              icon={Lightbulb}
              title="Electricity"
              subtitle="Bills"
              description="All Discos are available for instant electricity payment"
            />
            <PaymentTypeCard
              icon={Smartphone}
              title="Airtime"
              subtitle="Instant airtime"
              description="Top up your phone or friends instantly with any network"
            />
            <PaymentTypeCard
              icon={Plane}
              title="International"
              subtitle="Airtime"
              description="Buy airtime for friends & family in diaspora across the world"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
