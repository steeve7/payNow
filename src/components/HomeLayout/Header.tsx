"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { supabase } from "@/lib/supabase";

import { Menu, X, User, LogOut, Copy, Check } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);

  const user = useSelector((state: RootState) => state.auth.user);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.log("Logout error:", error.message);
  };

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 2000);
    }
  };

  const navLinks = [
    { path: "/", label: "Home" },
    { path: "/pay-bills", label: "Pay Bills" },
    { path: "/blog", label: "Blog" },
    // { path: "/faq", label: "FAQs" },
    // { path: "/how-it-works", label: "How it Works" },
    { path: "/contact", label: "Contact" },
  ];

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="bg-gradient-to-br from-purple-50 via-white to-purple-50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img
              src="https://019aa842-cd89-7a58-8535-534d63b3bcf1.mochausercontent.com/ChatGPT-Image-Dec-7-2025-05_22_17-AM.png"
              alt="PayNow Logo"
              className="w-10 h-10 rounded-lg"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              PayNow
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`font-medium transition-colors ${
                  pathname === link.path
                    ? "text-primary-600"
                    : "text-gray-600 hover:text-primary-600"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={
                        user.user_metadata?.full_name || user.email || "User"
                      }
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-600" />
                    </div>
                  )}

                  <button
                    onClick={copyUserId}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-mono bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded transition-colors"
                  >
                    {copiedUserId ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>ID</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/signin"
                  className="gradient-primary text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all hover:scale-105"
                >
                  Sign In
                </Link>

                <Link
                  href="/signup"
                  className="gradient-primary text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all hover:scale-105"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen((s) => !s)}
            className="md:hidden p-2 text-gray-600 hover:text-primary-600 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (slides from left, under header) */}
      <div
        className={`md:hidden fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-72 bg-white border-r border-gray-200 shadow-xl
        transform transition-transform duration-700 ease-in-out
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`font-medium transition-colors ${
                  pathname === link.path
                    ? "text-primary-600"
                    : "text-gray-700 hover:text-primary-600"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {!user ? (
            <div className="pt-4 flex flex-col items-center gap-3">
              <Link
                href="/signin"
                className="gradient-primary text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all hover:scale-105 w-full text-center"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="gradient-primary text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all hover:scale-105 w-full text-center"
              >
                Sign Up
              </Link>
            </div>
          ) : (
            <div className="pt-4">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 text-gray-700 hover:text-red-600 transition-colors py-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
