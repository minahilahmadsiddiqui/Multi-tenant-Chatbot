import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  loading?: boolean;
  dark?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, loading, dark, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5",
        dark
          ? "border-white/15 bg-white/[0.06] text-center shadow-[0_10px_35px_rgba(2,8,24,0.30)] backdrop-blur-xl hover:border-white/25"
          : "border-border/50 bg-card text-left shadow-[var(--shadow-card)] hover:border-border hover:shadow-[var(--shadow-elevated)]",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity",
          dark ? "bg-cyan-400/10 opacity-0 group-hover:opacity-100" : "bg-mint/20 opacity-40 group-hover:opacity-70"
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.14em]",
              dark ? "text-slate-300" : "text-muted-foreground"
            )}
          >
            {label}
          </p>
          {loading ? (
            <Skeleton className={cn("mt-3 h-9 w-20 rounded-lg", dark && "bg-white/20")} />
          ) : (
            <p
              className={cn(
                "mt-2 font-display text-3xl font-bold tracking-tight",
                dark ? "text-white" : "text-foreground"
              )}
            >
              {value}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              dark ? "bg-white/10 text-cyan-200" : "bg-gradient-to-br from-navy/10 to-mint/10 text-navy"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
