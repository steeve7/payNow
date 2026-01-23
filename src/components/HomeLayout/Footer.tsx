import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 group mb-4">
              <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-all">
                <img
                  src="https://019aa842-cd89-7a58-8535-534d63b3bcf1.mochausercontent.com/ChatGPT-Image-Dec-7-2025-05_22_17-AM.png"
                  alt="PayNow Logo Icon"
                  className="w-8 h-8"
                />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                PayNow
              </span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed">
              Fast, secure, and convenient bill payments for all Nigerians.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/"
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  How it Works
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/contact"
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              {/* <li>
                <a
                  href="#"
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  FAQs
                </a>
              </li> */}
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-of-service"
                  className="text-sm hover:text-primary-400 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm">
                <Mail className="w-4 h-4 mt-0.5 text-primary-400 flex-shrink-0" />
                <span>support@paynow.ng</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <Phone className="w-4 h-4 mt-0.5 text-primary-400 flex-shrink-0" />
                <span>+234 706 088 0335</span>
              </li>
              <li className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 text-primary-400 flex-shrink-0" />
                <span>Lagos, Nigeria</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            © 2025 PayNow. All rights reserved. PayNow is a product of King
            Technologies.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://x.com/Paynow_ng"
              className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
            >
              Twitter
            </a>
            <a
              href="https://www.linkedin.com/company/paynowng/"
              className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
            >
              LinkedIn
            </a>
            <a
              href="https://www.instagram.com/paynowng/"
              className="text-sm text-gray-400 hover:text-primary-400 transition-colors"
            >
              Instagram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
