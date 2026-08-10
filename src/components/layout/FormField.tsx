import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  hint?: string;
  labelAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, hint, labelAction, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
        {labelAction}
      </div>
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
      {children}
    </div>
  );
}
