"use client";

import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackClient />
    </Suspense>
  );
}

function CallbackFallback() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold mb-2">Processing...</h1>
        <p className="text-gray-700">Loading payment details...</p>
      </div>
    </div>
  );
}
