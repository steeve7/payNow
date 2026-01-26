import { LucideIcon } from "lucide-react";

interface PaymentTypeCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  iconBg?: string;
}

export default function PaymentTypeCard({
  icon: Icon,
  title,
  subtitle,
  description,
  iconBg = "bg-purple-100",
}: PaymentTypeCardProps) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition">
      <div
        className={`w-16 h-16 ${iconBg} rounded-2xl flex items-center justify-center mb-6`}
      >
        <Icon className="w-8 h-8 text-purple-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-lg font-semibold text-gray-700 mb-3">{subtitle}</p>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
