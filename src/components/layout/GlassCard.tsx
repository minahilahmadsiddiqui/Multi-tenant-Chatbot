import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  dark?: boolean;
}

const paddingClass = {
  none: "",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function GlassCard({ children, className, padding = "md", dark = false }: GlassCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border backdrop-blur-sm transition-shadow duration-300 hover:shadow-[var(--shadow-elevated)]",
        dark
          ? "border-white/15 bg-white/[0.06] shadow-[0_10px_35px_rgba(2,8,24,0.30)]"
          : "border-border/70 bg-card/90 shadow-[var(--shadow-card)]",
        paddingClass[padding],
        className
      )}
    >
      {children}
    </Card>
  );
}
