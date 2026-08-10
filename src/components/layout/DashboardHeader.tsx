import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  loading?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  loading,
  actions,
  className,
}: DashboardHeaderProps) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-r from-[hsl(226,58%,11%)] via-[hsl(212,62%,18%)] to-[hsl(166,54%,20%)] px-6 py-7 text-white shadow-[var(--shadow-elevated)] sm:px-8 sm:py-8 lg:px-10 lg:py-10",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 page-grid-overlay [background-size:28px_28px]" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-mint/20 blur-3xl" />
      <div className="relative space-y-4">
        {actions && <div className="flex flex-wrap items-center justify-between gap-3">{actions}</div>}
        <div>
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">{eyebrow}</p>
          )}
          {loading ? (
            <Skeleton className="mt-2 h-9 w-56 max-w-full rounded-lg bg-white/20 sm:h-10 sm:w-72" />
          ) : (
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{title}</h1>
          )}
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base lg:text-lg">
              {description}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
