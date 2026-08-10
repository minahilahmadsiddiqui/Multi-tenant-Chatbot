import { cn } from "@/lib/utils";

type PageTheme = "light" | "dark" | "hero";

interface PageShellProps {
  children: React.ReactNode;
  theme?: PageTheme;
  className?: string;
  contentClassName?: string;
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "6xl" | "7xl" | "full";
  centered?: boolean;
}

const maxWidthClass: Record<NonNullable<PageShellProps["maxWidth"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export function PageShell({
  children,
  theme = "light",
  className,
  contentClassName,
  maxWidth = "full",
  centered = false,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden",
        theme === "light"
          ? "page-bg-light text-foreground"
          : theme === "hero"
            ? "page-bg-hero text-white"
            : "page-bg-dark text-slate-100",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 page-grid-overlay" aria-hidden />
      <div className="pointer-events-none absolute inset-0 page-dot-overlay" aria-hidden />
      {theme === "light" && (
        <>
          <div className="pointer-events-none absolute top-10 left-10 h-44 w-44 rounded-full bg-emerald-400/30 blur-3xl" />
          <div className="pointer-events-none absolute top-1/3 right-8 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-1/3 h-52 w-52 rounded-full bg-cyan-300/30 blur-3xl" />
        </>
      )}
      {theme === "dark" && (
        <>
          <div className="pointer-events-none absolute -left-10 top-0 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute right-4 top-2 h-36 w-36 rounded-full bg-violet-400/15 blur-3xl" />
        </>
      )}
      {theme === "hero" && (
        <>
          <div className="pointer-events-none absolute -top-20 left-[-8%] h-72 w-72 rounded-full bg-mint/25 blur-3xl" />
          <div className="pointer-events-none absolute top-1/4 right-[-5%] h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        </>
      )}

      <div
        className={cn(
          "relative w-full",
          maxWidth === "full"
            ? "px-6 py-6 sm:px-10 lg:px-12 lg:py-8 xl:px-16"
            : "mx-auto px-4 py-6 sm:px-6 lg:py-8",
          maxWidth !== "full" && maxWidthClass[maxWidth],
          centered && maxWidth !== "full" && "flex min-h-screen flex-col justify-center",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
