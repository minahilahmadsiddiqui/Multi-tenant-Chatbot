import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconBadgeProps {
  icon: LucideIcon;
  variant?: "navy" | "mint" | "glass";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClass = {
  sm: "h-8 w-8 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-10 w-10 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
  lg: "h-12 w-12 rounded-2xl [&_svg]:h-6 [&_svg]:w-6",
};

const variantClass = {
  navy: "bg-gradient-to-br from-navy to-navy-light text-primary-foreground shadow-[var(--shadow-glow-navy)]",
  mint: "bg-gradient-to-br from-mint to-mint-glow text-primary-foreground shadow-[var(--shadow-glow-mint)]",
  glass: "border border-white/20 bg-white/10 text-white backdrop-blur-md",
};

export function IconBadge({ icon: Icon, variant = "navy", size = "md", className }: IconBadgeProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        sizeClass[size],
        variantClass[variant],
        className
      )}
    >
      <Icon />
    </div>
  );
}
