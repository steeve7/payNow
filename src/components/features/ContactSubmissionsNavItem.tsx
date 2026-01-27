"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

export default function ContactSubmissionsNavItem() {
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/contact-submissions/unread-count", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread(Number(data?.unread || 0));
      } catch {}
    }

    load();
    const id = setInterval(load, 30_000); // refresh every 30s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/admin/contact-submissions"
      className="relative inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
    >
      <MessageSquare className="w-5 h-5" />
      <span>Contact</span>

      {unread > 0 && (
        <span className="ml-1 inline-flex items-center justify-center text-xs font-bold rounded-full px-2 py-0.5 bg-red-600 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
