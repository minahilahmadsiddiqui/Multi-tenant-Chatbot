import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoBannerVariant = "info" | "success" | "warning";

interface InfoBannerProps {
  icon?: LucideIcon;
  title?: string;
  children: React.ReactNode;
  variant?: InfoBannerVariant;
  className?: string;
}

const variantClass: Record<InfoBannerVariant, string> = {
  info: "border-sky-200/80 bg-gradient-to-r from-sky-50 to-cyan-50/50 text-sky-900 [&_svg]:text-sky-600",
  success: "border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50/50 text-emerald-900 [&_svg]:text-emerald-600",
  warning: "border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/50 text-amber-900 [&_svg]:text-amber-600",
};

export function InfoBanner({ icon: Icon, title, children, variant = "success", className }: InfoBannerProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-5 py-4 sm:px-6 sm:py-5",
        variantClass[variant],
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          {title && <p className="font-semibold sm:text-base">{title}</p>}
          <p className={cn("text-sm leading-relaxed sm:text-base", title && "mt-1 opacity-90")}>{children}</p>
        </div>
      </div>
    </div>
  );
}
