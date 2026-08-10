import { cn } from "@/lib/utils";

interface FormPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function FormPanel({ children, className }: FormPanelProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border/50 bg-card shadow-[var(--shadow-elevated)] ring-1 ring-black/[0.03]",
        "p-6 sm:p-8 lg:p-10",
        className
      )}
    >
      {children}
    </div>
  );
}
