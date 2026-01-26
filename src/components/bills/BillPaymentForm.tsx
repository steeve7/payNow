'use client'
import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import BillTypeSelector from "./BillTypeSelector";
import AirtimeSection from "./sections/AirtimeSection";
import DataSection from "./sections/DataSection";
import CableSection from "./sections/CableSection";
import ElectricitySection from "./sections/ElectricitySection";
import EducationSection from "./sections/EducationSection";
import InternationalAirtimeSection from "./sections/IntlAirtimeSection";
import ShowmaxSection from "./sections/ShowmaxSection";

const BillPaymentForm = () => {
  const selectedBill = useSelector(
    (state: RootState) => state.bill.selectedBill
  );

  // Optional: Set default selected bill if none
  useEffect(() => {
    // This ensures form shows on page load
    if (!selectedBill) {
      // dispatch(selectBillType("airtime")) // uncomment if using dispatch
    }
  }, [selectedBill]);

  return (
    <div className="py-16 w-full">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-white rounded-3xl shadow-2xl p-8 backdrop-blur-sm border border-gray-100">
          {/* Header */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Pay Your Bills
            </h3>
            <p className="text-gray-600">Select a bill and pay instantly</p>
            <p className="mt-4 text-gray-700 font-medium">Select Bill Type</p>
          </div>

          {/* Bill Type Selector */}
          <BillTypeSelector />

          {/* Section Content */}
          <div className="p-6 space-y-6 rounded-xl">
            {selectedBill === "airtime" && <AirtimeSection />}
            {selectedBill === "data" && <DataSection />}
            {selectedBill === "cable" && <CableSection />}
            {selectedBill === "electricity" && <ElectricitySection />}
            {selectedBill === "education" && <EducationSection />}
            {selectedBill === "international-airtime" && (
              <InternationalAirtimeSection />
            )}
            {selectedBill === "showmax" && <ShowmaxSection />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillPaymentForm;
