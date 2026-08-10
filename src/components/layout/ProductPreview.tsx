import { Bot, MessageSquare, Sparkles } from "lucide-react";

export function ProductPreview() {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-mint/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/[0.08] p-3 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-4">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(226,55%,12%)] via-[hsl(226,45%,18%)] to-[hsl(166,40%,24%)]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint/20">
                <Bot className="h-4 w-4 text-mint" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">ACME Support Bot</p>
                <p className="text-xs text-white/60">Workspace dashboard</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
              Live
            </span>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {[
              { label: "Documents", value: "24" },
              { label: "Queries", value: "1.2k" },
              { label: "Accuracy", value: "94%" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">{stat.label}</p>
                <p className="mt-1 font-display text-xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 px-5 pb-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <MessageSquare className="h-4 w-4 text-cyan-200" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/85">
                How do I reset my employee portal password?
              </div>
            </div>
            <div className="flex items-start justify-end gap-3">
              <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-mint/20 bg-mint/15 px-4 py-3 text-sm text-white/90">
                Open the HR portal → Account → Reset password. I pulled this from your onboarding doc.
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint/20">
                <Sparkles className="h-4 w-4 text-mint" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
