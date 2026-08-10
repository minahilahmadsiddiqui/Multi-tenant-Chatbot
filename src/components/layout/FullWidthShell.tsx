import { cn } from "@/lib/utils";

type ShellTheme = "light" | "dark" | "hero";

interface FullWidthShellProps {
  children: React.ReactNode;
  theme?: ShellTheme;
  className?: string;
  contentClassName?: string;
  topBar?: React.ReactNode;
}

const themeClass: Record<ShellTheme, string> = {
  light: "page-bg-light text-foreground",
  dark: "page-bg-dark text-slate-100",
  hero: "page-bg-hero text-white",
};

export function FullWidthShell({
  children,
  theme = "light",
  className,
  contentClassName,
  topBar,
}: FullWidthShellProps) {
  return (
    <div className={cn("relative min-h-screen w-full overflow-x-hidden", themeClass[theme], className)}>
      <div className="pointer-events-none absolute inset-0 page-grid-overlay" aria-hidden />
      <div className="pointer-events-none absolute inset-0 page-dot-overlay" aria-hidden />

      {theme === "hero" && (
        <>
          <div className="pointer-events-none absolute -top-20 left-[-8%] h-72 w-72 rounded-full bg-mint/25 blur-3xl" />
          <div className="pointer-events-none absolute top-1/4 right-[-5%] h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
        </>
      )}

      {topBar && (
        <div
          className={cn(
            "relative z-20 border-b px-6 py-4 backdrop-blur-md sm:px-10 lg:px-12 xl:px-16",
            theme === "hero"
              ? "border-white/10 bg-[hsl(226,55%,10%)]/80"
              : theme === "dark"
                ? "border-white/10 bg-[hsl(224,34%,10%)]/80"
                : "border-border/60 bg-background/90"
          )}
        >
          {topBar}
        </div>
      )}

      <div
        className={cn(
          "relative w-full px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 xl:px-16 xl:py-14",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
