import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type BackButtonVariant = "default" | "inverted" | "ghost";

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  shortLabel?: string;
  variant?: BackButtonVariant;
  size?: "sm" | "md";
  iconOnly?: boolean;
  className?: string;
}

const variantStyles: Record<
  BackButtonVariant,
  { pill: string; icon: string }
> = {
  default: {
    pill: "border-border/70 bg-background/90 text-foreground shadow-sm hover:border-border hover:bg-muted/50 hover:shadow-md",
    icon: "bg-muted/90 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
  },
  inverted: {
    pill: "border-white/25 bg-white/10 text-white shadow-sm backdrop-blur-md hover:border-white/40 hover:bg-white/15",
    icon: "bg-white/15 text-white/90 group-hover:bg-white/25 group-hover:text-white",
  },
  ghost: {
    pill: "border-transparent bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    icon: "bg-muted/70 text-muted-foreground group-hover:bg-muted group-hover:text-foreground",
  },
};

export function BackButton({
  onClick,
  label = "Back",
  shortLabel,
  variant = "default",
  size = "md",
  iconOnly = false,
  className,
}: BackButtonProps) {
  const styles = variantStyles[variant];
  const iconSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const arrowSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={cn(
          "group inline-flex shrink-0 items-center justify-center rounded-full border transition-all duration-200 active:scale-[0.97]",
          iconSize,
          styles.pill,
          styles.icon,
          className
        )}
      >
        <ArrowLeft className={arrowSize} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
        size === "sm" && "pr-3 text-xs",
        styles.pill,
        className
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full transition-colors duration-200",
          iconSize,
          styles.icon
        )}
      >
        <ArrowLeft className={arrowSize} />
      </span>
      {shortLabel ? (
        <>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
