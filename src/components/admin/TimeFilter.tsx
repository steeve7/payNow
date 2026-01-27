import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

interface TimeFilterProps {
  value: string;
  onFilterChange: (
    filter: string,
    customStart?: string,
    customEnd?: string
  ) => void;
}

export default function TimeFilter({ value, onFilterChange }: TimeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const filters = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom Range" },
    { value: "all", label: "All Time" },
  ];

  const handleFilterSelect = (filterValue: string) => {
    if (filterValue === "custom") {
      setShowCustom(true);
      setIsOpen(false);
    } else {
      setShowCustom(false);
      onFilterChange(filterValue);
      setIsOpen(false);
    }
  };

  const applyCustomFilter = () => {
    if (customStart && customEnd) {
      onFilterChange("custom", customStart, customEnd);
      setShowCustom(false);
    }
  };

  const getCurrentLabel = () => {
    const filter = filters.find((f) => f.value === value);
    return filter ? filter.label : "All Time";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {getCurrentLabel()}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[180px]">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handleFilterSelect(filter.value)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                value === filter.value
                  ? "bg-primary-50 text-primary-700 font-medium"
                  : "text-gray-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {showCustom && (
        <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-10 min-w-[280px]">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Select Date Range
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Start Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                End Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCustom(false)}
                className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCustomFilter}
                disabled={!customStart || !customEnd}
                className="flex-1 px-3 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
  