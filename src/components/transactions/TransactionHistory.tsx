"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { PaymentRow, TransactionStats } from "./types";

import TransactionStatsCards from "./transaction-features/TransactionStats";
import TransactionHeader from "./transaction-features/TransactionHeader";
import TransactionList from "./transaction-features/TransactionList";
import ReceiptModal from "./transaction-features/ReceiptModal";
import { ReceiptPaper } from "./transaction-features/ReceiptPaper";

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTransaction, setSelectedTransaction] =
    useState<PaymentRow | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const [filterType, setFilterType] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  // PDF download support
  const [downloadTx, setDownloadTx] = useState<PaymentRow | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const hiddenReceiptRef = useRef<HTMLDivElement | null>(null);

  const fetchTransactionsFromSupabase = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw new Error(userErr.message);

      const user = u?.user;
      if (!user?.id) {
        setTransactions([]);
        return;
      }

      const { data, error: dbErr } = await supabase
        .from("payments")
        .select(
          "id, reference, bill_type, gateway, amount, currency, status, payload, created_at, vend_status, vend_provider, vended_at, vend_last_error, vend_response"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (dbErr) throw new Error(dbErr.message);

      setTransactions((data || []) as PaymentRow[]);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to load transactions";
      console.warn("TransactionHistory fetch error:", msg);
      setError(msg);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactionsFromSupabase();

    const channel = supabase
      .channel("payments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          fetchTransactionsFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTransactions = useMemo(() => {
    if (filterType === "all") return transactions;
    return transactions.filter((t) => t.bill_type === filterType);
  }, [transactions, filterType]);

  const stats: TransactionStats = useMemo(() => {
    if (!transactions.length) {
      return {
        totalTransactions: 0,
        totalSpent: 0,
        billTypeBreakdown: [],
        mostRecentTransaction: null,
      };
    }

    const successful = transactions.filter(
      (t) => String(t.status).toLowerCase() === "success"
    );
    const totalTransactions = successful.length;
    const totalSpent = successful.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    );

    const map = new Map<
      string,
      { bill_type: string; count: number; total: number }
    >();
    for (const t of successful) {
      const key = t.bill_type || "unknown";
      const current = map.get(key) || { bill_type: key, count: 0, total: 0 };
      current.count += 1;
      current.total += Number(t.amount || 0);
      map.set(key, current);
    }

    const billTypeBreakdown = Array.from(map.values()).sort(
      (a, b) => b.total - a.total
    );
    const mostRecentTransaction = successful[0] || null;

    return {
      totalTransactions,
      totalSpent,
      billTypeBreakdown,
      mostRecentTransaction,
    };
  }, [transactions]);

  const handleViewReceipt = (transaction: PaymentRow) => {
    setSelectedTransaction(transaction);
    setShowReceipt(true);
  };

  const handleDownloadReceipt = (transaction: PaymentRow) => {
    setDownloadTx(transaction);
  };

  // ✅ PDF useEffect (same flow you’re using)
  useEffect(() => {
    const waitForImages = async (root: HTMLElement) => {
      const imgs = Array.from(
        root.querySelectorAll("img")
      ) as HTMLImageElement[];
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) return resolve();
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );
    };

    const run = async () => {
      if (!downloadTx) return;
      const node = hiddenReceiptRef.current;
      if (!node) return;

      try {
        setIsDownloading(true);

        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);

        await new Promise((r) => setTimeout(r, 50));
        await waitForImages(node);

        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: document.documentElement.clientWidth,
          windowHeight: document.documentElement.clientHeight,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "pt", "a4");

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`Receipt-${downloadTx.reference}.pdf`);
      } catch (e) {
        console.error("PDF download failed:", e);
        alert("Failed to download receipt. Check console for details.");
      } finally {
        setIsDownloading(false);
        setDownloadTx(null);
      }
    };

    run();
  }, [downloadTx]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-lg p-6 sm:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2 sm:w-1/4" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
          {error}
        </div>
      ) : null}

      <TransactionStatsCards stats={stats} />

      <div className="bg-white rounded-3xl shadow-lg p-4 sm:p-6 lg:p-8">
        <TransactionHeader
          filterType={filterType}
          setFilterType={setFilterType}
        />

        <TransactionList
          transactions={filteredTransactions}
          filterType={filterType}
          isDownloading={isDownloading}
          onView={handleViewReceipt}
          onDownload={handleDownloadReceipt}
        />
      </div>

      {/* Hidden receipt for PDF capture */}
      {downloadTx ? (
        <div
          className="fixed top-0 left-0 pointer-events-none"
          style={{ transform: "translateX(-200vw)" }}
        >
          <div ref={hiddenReceiptRef}>
            <ReceiptPaper tx={downloadTx} />
          </div>
        </div>
      ) : null}

      <ReceiptModal
        open={showReceipt}
        tx={selectedTransaction}
        isDownloading={isDownloading}
        onClose={() => setShowReceipt(false)}
        onDownload={() =>
          selectedTransaction && handleDownloadReceipt(selectedTransaction)
        }
      />
    </div>
  );
}
