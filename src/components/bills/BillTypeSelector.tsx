import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectBillType, BillType } from "@/redux/slices/billSlice";
import { RootState } from "@/redux/store";

// React icons
import { FaWifi } from "react-icons/fa";
import { FiTv, FiSmartphone } from "react-icons/fi";
import { GoLightBulb, GoVideo } from "react-icons/go";
import { RiGraduationCapFill } from "react-icons/ri";

// Define bills with icon and comingSoon
const bills: {
  id: BillType;
  label: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}[] = [
  {
    id: "airtime",
    label: "Airtime",
    icon: <FiSmartphone size={20} color="#374151" />,
  },
  {
    id: "data",
    label: "Internet Data",
    icon: <FaWifi size={20} color="#374151" />,
  },
  { id: "cable", label: "Cable TV", icon: <FiTv size={20} color="#374151" /> },
  {
    id: "electricity",
    label: "Electricity",
    icon: <GoLightBulb size={20} color="#374151" />,
  },
  {
    id: "education",
    label: "Education",
    icon: <RiGraduationCapFill size={20} color="#374151" />,
  },
  {
    id: "international-airtime",
    label: "International Airtime",
    icon: <FiSmartphone size={20} color="#374151" />,
  },
  {
    id: "showmax",
    label: "Showmax",
    icon: <GoVideo size={20} color="#374151" />,
  },
];

const BillTypeSelector: React.FC = () => {
  const dispatch = useDispatch();
  const selectedBill = useSelector((state: RootState) => state.bill.selectedBill);

  const handleSelect = (billId: BillType, comingSoon?: boolean) => {
    if (!comingSoon) dispatch(selectBillType(billId));
  };

  return (
    <div
      className="
        mx-auto w-full max-w-5xl
        grid grid-cols-2 min-[527px]:grid-cols-3
        gap-3 sm:gap-4 md:gap-5
        place-items-center
        mb-8
      "
    >
      {bills.map((bill) => (
        <div key={bill.id} className="relative w-full flex justify-center">
          {bill.comingSoon && (
            <span className="absolute -top-2 -right-2 bg-orange-500 z-10 text-white text-[10px] px-2 py-1 rounded-full">
              Coming Soon
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSelect(bill.id, bill.comingSoon)}
            className={[
              // fluid sizing: fill grid cell but cap it so it doesn't get too wide on big screens
              "w-full max-w-[220px] min-[527px]:max-w-[240px] lg:max-w-[260px]",

              //  heights scale by screen; tiny phones get slightly taller cards
              "min-h-[120px] min-[400px]:min-h-[130px] min-[527px]:min-h-[115px] md:min-h-[120px] lg:min-h-[130px]",

              //  layout
              "flex flex-col items-center justify-center",
              "rounded-xl border-2 transition-all",
              "px-3 py-4 sm:px-4",

              //  selection state
              selectedBill === bill.id
                ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-200"
                : "border-gray-200 hover:border-blue-300 hover:bg-gray-50",

              //  coming soon state
              bill.comingSoon
                ? "opacity-50 cursor-not-allowed hover:!border-gray-200 hover:!bg-gray-50"
                : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-center text-[#374151]">
              {bill.icon}
            </div>

            <span
              className="
                mt-2 text-center font-medium text-[#374151]
                text-[13px] sm:text-sm
                leading-tight
                px-1
              "
            >
              {bill.label}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
};

export default BillTypeSelector;
