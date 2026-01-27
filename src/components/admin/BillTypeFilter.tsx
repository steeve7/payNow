import { useState } from "react";
import { Filter, ChevronDown } from "lucide-react";

interface BillTypeFilterProps {
  value: string;
  onFilterChange: (billType: string) => void;
}

export default function BillTypeFilter({
  value,
  onFilterChange,
}: BillTypeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const billTypes = [
    { value: "all", label: "All Bill Types" },
    { value: "electricity", label: "Electricity" },
    { value: "airtime", label: "Airtime" },
    { value: "data", label: "Internet Data" },
    { value: "cable", label: "Cable TV" },
    { value: "showmax", label: "Showmax" },
    { value: "intl_airtime", label: "International Airtime" }, // ✅ added
  ];

  const handleSelect = (billType: string) => {
    onFilterChange(billType);
    setIsOpen(false);
  };

  const getCurrentLabel = () => {
    const type = billTypes.find((t) => t.value === value);
    return type ? type.label : "All Bill Types";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Filter className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {getCurrentLabel()}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[220px]">
          {billTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => handleSelect(type.value)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                value === type.value
                  ? "bg-primary-50 text-primary-700 font-medium"
                  : "text-gray-700"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
