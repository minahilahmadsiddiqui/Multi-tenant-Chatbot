import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex w-full gap-1 rounded-2xl border border-border/50 bg-muted/50 p-1.5 sm:w-auto",
        className
      )}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 sm:min-w-[120px]",
              isActive
                ? "bg-gradient-to-r from-navy to-navy-light text-white shadow-md"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
