import { LucideIcon } from "lucide-react";
interface ServiceCardProps {
  icon: LucideIcon;
  label: string;
}
export default function ServiceCard({ icon: Icon, label }: ServiceCardProps) {
  return (
    <div className="relative bg-white rounded-2xl p-6 border-2 border-purple-200 hover:border-purple-400 transition cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[120px]">
      <Icon className="w-8 h-8 text-purple-600" />
      <span className="text-gray-700 font-medium text-center">{label}</span>
    </div>
  );
}
