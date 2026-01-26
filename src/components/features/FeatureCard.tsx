import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconBg?: string;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  iconBg = "bg-purple-100",
}: FeatureCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition">
      <div
        className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center mb-4`}
      >
        <Icon className="w-6 h-6 text-purple-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}
