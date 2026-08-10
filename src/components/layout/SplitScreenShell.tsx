import { cn } from "@/lib/utils";

interface SplitScreenShellProps {
  marketing: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  topBar?: React.ReactNode;
}

export function SplitScreenShell({
  marketing,
  children,
  className,
  contentClassName,
  topBar,
}: SplitScreenShellProps) {
  return (
    <div className={cn("flex min-h-screen w-full flex-col lg:flex-row", className)}>
      <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:h-screen lg:w-[46%] xl:w-[44%]">
        {marketing}
      </aside>

      <main className="relative flex min-h-[50vh] flex-1 flex-col lg:min-h-screen">
        <div className="pointer-events-none absolute inset-0 page-bg-light opacity-90" />
        <div className="pointer-events-none absolute inset-0 page-dot-overlay" />

        {topBar && (
          <div className="relative z-20 border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-xl sm:px-10 lg:px-12 xl:px-16">
            {topBar}
          </div>
        )}

        <div
          className={cn(
            "relative z-10 flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-14 xl:px-16 xl:py-16",
            contentClassName
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
