import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketingHighlight {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface MarketingPanelProps {
  eyebrow?: string;
  step?: { current: number; total: number };
  title: string;
  titleAccent?: string;
  description: string;
  highlights?: MarketingHighlight[];
  showBrand?: boolean;
  className?: string;
}

export function MarketingPanel({
  eyebrow,
  step,
  title,
  titleAccent,
  description,
  highlights = [],
  showBrand = false,
  className,
}: MarketingPanelProps) {
  const hasHighlights = highlights.length > 0;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[42vh] flex-col overflow-hidden bg-gradient-to-br from-[hsl(226,55%,10%)] via-[hsl(226,45%,18%)] to-[hsl(166,40%,22%)] px-8 py-12 text-white sm:px-10 sm:py-14 lg:min-h-screen lg:px-14 lg:py-16 xl:px-16",
        hasHighlights ? "justify-between" : "justify-center",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 page-grid-overlay opacity-30 [background-size:40px_40px]" />
      <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-mint/20 blur-3xl animate-float" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="noise-overlay pointer-events-none absolute inset-0" />

      {showBrand && (
        <div className="relative flex shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <span className="font-display text-lg font-bold text-mint">◇</span>
          </div>
          <span className="text-sm font-semibold tracking-wide text-white/80">Chatbot Platform</span>
        </div>
      )}

      <div
        className={cn(
          "relative w-full max-w-xl",
          showBrand && hasHighlights && "my-8 lg:my-10",
          !showBrand && hasHighlights && "flex flex-1 flex-col justify-center py-6 lg:py-10",
          !showBrand && !hasHighlights && "py-4 sm:py-6"
        )}
      >
        {step && (
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: step.total }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 w-8 rounded-full transition-colors",
                    i < step.current ? "bg-mint" : "bg-white/25"
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-semibold tracking-wide text-white/80">
              Step {step.current} of {step.total}
            </span>
          </div>
        )}
        {eyebrow && !step && (
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl xl:text-[3.25rem]">
          {title}
          {titleAccent && (
            <span className="mt-2 block bg-gradient-to-r from-cyan-100 via-mint to-cyan-100 bg-clip-text text-transparent">
              {titleAccent}
            </span>
          )}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/75 sm:text-lg lg:max-w-lg">{description}</p>
      </div>

      {hasHighlights && (
        <div className="relative hidden shrink-0 gap-3 lg:grid">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/[0.09]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/15 to-white/5 ring-1 ring-white/15">
                <item.icon className="h-5 w-5 text-mint" />
              </div>
              <div>
                <p className="font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
