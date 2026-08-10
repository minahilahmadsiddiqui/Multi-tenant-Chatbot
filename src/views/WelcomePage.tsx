import { useNavigate } from "react-router-dom";
import { ArrowRight, Bot, Globe, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullWidthShell } from "@/components/layout/FullWidthShell";
import { ProductPreview } from "@/components/layout/ProductPreview";

const features = [
  { icon: Bot, title: "Bot workspaces", desc: "Prompts, docs, widget & test chat" },
  { icon: ShieldCheck, title: "Tenant isolation", desc: "Strict per-company boundaries" },
  { icon: Globe, title: "Widget deploy", desc: "Embed on any website in minutes" },
] as const;

const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <FullWidthShell theme="hero" contentClassName="flex min-h-screen flex-col justify-center py-14 lg:py-20">
      <section className="grid w-full items-center gap-14 lg:grid-cols-2 lg:gap-20 xl:gap-28">
        <div>
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-mint" />
            <span className="text-xs font-semibold tracking-[0.18em] text-white/90">ENTERPRISE CHATBOT PLATFORM</span>
          </div>

          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl xl:text-[4.25rem]">
            Build & deploy
            <span className="mt-2 block bg-gradient-to-r from-cyan-100 via-mint to-emerald-200 bg-clip-text text-transparent">
              AI assistants at scale
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75 lg:text-xl">
            Multi-tenant admin platform for company bots, RAG knowledge bases, and embeddable chat widgets - all in one
            place.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button variant="hero" size="lg" className="min-w-[180px] px-8" onClick={() => navigate("/auth?mode=signup")}>
              Get started free
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button variant="hero-outline" size="lg" className="min-w-[140px]" onClick={() => navigate("/auth?mode=login")}>
              Sign in
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap gap-6 border-t border-white/10 pt-8">
            {features.map((f) => (
              <div key={f.title} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-4 w-4 text-mint" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-white/55">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ProductPreview />
      </section>

      <section className="mt-16 grid w-full gap-4 border-t border-white/10 pt-10 sm:grid-cols-3 lg:mt-20">
        {[
          { icon: Layers, value: "Multi-tenant", label: "Company-scoped data & retrieval" },
          { icon: Sparkles, value: "RAG-powered", label: "Grounded document answers" },
          { icon: Globe, value: "Widget-ready", label: "One-click embed script" },
        ].map((stat) => (
          <div
            key={stat.value}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-5 backdrop-blur-sm"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <stat.icon className="h-5 w-5 text-mint" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-white">{stat.value}</p>
              <p className="text-sm text-white/60">{stat.label}</p>
            </div>
          </div>
        ))}
      </section>
    </FullWidthShell>
  );
};

export default WelcomePage;
