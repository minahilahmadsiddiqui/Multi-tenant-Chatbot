import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Bot, Building2, Code2, FileText, LayoutDashboard, MessageSquare, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createBot,
  fetchCurrentAdminCompany,
  listBots,
  logoutAdmin,
  type BotItem,
} from "@/lib/api";
import { toast } from "sonner";
import { SplitScreenShell } from "@/components/layout/SplitScreenShell";
import { MarketingPanel } from "@/components/layout/MarketingPanel";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { IconBadge } from "@/components/layout/IconBadge";
import { FormPanel } from "@/components/layout/FormPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormField } from "@/components/layout/FormField";
import { InfoBanner } from "@/components/layout/InfoBanner";

const workspaceFeatures = [
  { icon: LayoutDashboard, label: "System prompt" },
  { icon: FileText, label: "Documents" },
  { icon: Code2, label: "Widget" },
  { icon: MessageSquare, label: "Test chat" },
] as const;

const AddBotPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state || {}) as { companyName?: string };
  const [searchParams] = useSearchParams();
  const companyId = Number(searchParams.get("company_id"));
  const scopedCompanyId = Number.isFinite(companyId) && companyId > 0 ? companyId : undefined;
  const [bots, setBots] = useState<BotItem[]>([]);
  const [loadingBots, setLoadingBots] = useState(true);
  const [loadingCompanyName, setLoadingCompanyName] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const botDashboardSuffix = scopedCompanyId != null ? `?company_id=${encodeURIComponent(String(scopedCompanyId))}` : "";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingBots(true);
      setLoadingCompanyName(true);

      const prefetchedCompanyName = String(locationState.companyName || "").trim();
      if (prefetchedCompanyName) {
        setCompanyName(prefetchedCompanyName);
        setLoadingCompanyName(false);
      }

      try {
        const botsPromise = listBots(scopedCompanyId);
        const companyPromise =
          !prefetchedCompanyName && !scopedCompanyId
            ? fetchCurrentAdminCompany().catch(() => null)
            : Promise.resolve(null);

        const [rows, company] = await Promise.all([botsPromise, companyPromise]);
        if (cancelled) return;

        setBots(rows);
        if (!prefetchedCompanyName) {
          if (company) setCompanyName(company.name || "");
          else if (!scopedCompanyId) setCompanyName("");
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load bots");
      } finally {
        if (!cancelled) {
          setLoadingBots(false);
          setLoadingCompanyName(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [scopedCompanyId, locationState.companyName]);

  const hasExistingBot = !loadingBots && bots.length > 0;
  const canCreateBot = !loadingBots && bots.length === 0;
  const existingBot = hasExistingBot ? bots[0] : null;
  const displayCompanyName = loadingCompanyName ? "Loading company..." : companyName || "Company workspace";

  const handleCreate = async () => {
    if (!name.trim() || !canCreateBot) return;
    setIsSubmitting(true);
    try {
      const data = await createBot({
        name: name.trim(),
        system_prompt: "",
        plan_type: "free",
        ...(scopedCompanyId ? { company_id: scopedCompanyId } : {}),
      });
      toast.success("Bot created.");
      navigate(`/admin/bot/${data.bot.id}${botDashboardSuffix}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bot creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutAdmin();
    toast.success("Logged out.");
    navigate("/welcome", { replace: true });
  };

  return (
    <SplitScreenShell
      marketing={
        <MarketingPanel
          step={{ current: 2, total: 2 }}
          showBrand={false}
          title="Launch your"
          titleAccent="company bot"
          description={
            hasExistingBot
              ? `${displayCompanyName} already has an active bot. Open the dashboard to manage prompts, documents, and widget deployment.`
              : "Give your chatbot a name and identity. Next you'll configure prompts, upload knowledge, and generate an embeddable widget."
          }
          highlights={[
            {
              icon: Bot,
              title: "One bot per company",
              description: "Each company workspace supports a single dedicated chatbot instance.",
            },
            {
              icon: Upload,
              title: "RAG knowledge base",
              description: "Upload documents and text to power accurate, grounded responses.",
            },
            {
              icon: Code2,
              title: "Embeddable widget",
              description: "Generate a script snippet to deploy chat on your website.",
            },
          ]}
        />
      }
      topBar={<AppTopBar onLogout={handleLogout} isLoggingOut={isLoggingOut} className="mb-0" />}
      contentClassName={hasExistingBot ? "w-full items-stretch justify-start" : "w-full items-stretch"}
    >
      {loadingBots && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          Loading bot setup...
        </div>
      )}

      {hasExistingBot && existingBot && (
        <div className="flex w-full min-h-[calc(100vh-8rem)] flex-col lg:min-h-[calc(100vh-5rem)]">
          <header className="border-b border-border/50 pb-6 sm:pb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <IconBadge icon={Building2} variant="navy" size="md" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Company workspace
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                    {displayCompanyName}
                  </h1>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active bot
              </span>
            </div>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center py-10 sm:py-12 lg:py-16">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-navy/15 bg-gradient-to-br from-[hsl(226,55%,12%)] via-[hsl(224,34%,16%)] to-[hsl(245,32%,18%)] p-8 text-center text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] sm:p-10 lg:p-12">
              <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-72 rounded-full bg-violet-400/10 blur-3xl" />

              <div className="relative mx-auto flex flex-col items-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                  <Bot className="h-10 w-10 text-mint" />
                </div>

                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Your bot</p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{existingBot.name}</h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
                  Configure prompts, upload knowledge, deploy your widget, and test chat - all from one dashboard.
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                  {workspaceFeatures.map((feature) => (
                    <span
                      key={feature.label}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-medium text-white/85 backdrop-blur-sm"
                    >
                      <feature.icon className="h-4 w-4 text-mint" />
                      {feature.label}
                    </span>
                  ))}
                </div>

                <Button
                  variant="hero"
                  size="lg"
                  className="mt-10 h-14 w-full max-w-sm px-8 text-base"
                  onClick={() => navigate(`/admin/bot/${existingBot.id}${botDashboardSuffix}`)}
                >
                  Open dashboard
                  <ArrowUpRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canCreateBot && (
        <FormPanel className="w-full">
          <PageHeader
            icon={Bot}
            title="Add a bot"
            description="Choose a clear name your team will recognize - e.g. HR Assistant, Support Bot."
          />

          <InfoBanner variant="success" className="mb-8">
            One bot per company. Create yours to continue to the configuration dashboard.
          </InfoBanner>

          <div className="space-y-6">
            <FormField label="Bot name" hint="Displayed in the widget and admin dashboard.">
              <Input
                placeholder="e.g., HR Assistant"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-base"
              />
            </FormField>

            <Button
              variant="premium"
              size="lg"
              className="h-12 w-full text-base"
              onClick={handleCreate}
              disabled={isSubmitting || !name.trim()}
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? "Creating bot..." : "Create bot & open dashboard"}
            </Button>
          </div>
        </FormPanel>
      )}
    </SplitScreenShell>
  );
};

export default AddBotPage;
