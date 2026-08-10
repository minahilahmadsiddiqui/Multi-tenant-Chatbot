import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Bot, FileText, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCompany, getStoredSession, logoutAdmin } from "@/lib/api";
import { toast } from "sonner";
import { SplitScreenShell } from "@/components/layout/SplitScreenShell";
import { MarketingPanel } from "@/components/layout/MarketingPanel";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { FormPanel } from "@/components/layout/FormPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormField } from "@/components/layout/FormField";
import { InfoBanner } from "@/components/layout/InfoBanner";

const AddCompanyPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCheckingCompany, setIsCheckingCompany] = useState(true);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.admin?.company_id != null) {
      navigate("/admin/add-bot", { replace: true });
      return;
    }
    setIsCheckingCompany(false);
  }, [navigate]);

  const handleCreateCompany = async () => {
    setIsSubmitting(true);
    try {
      await createCompany({ name: name.trim(), plan_type: "free" });
      toast.success("Company created.");
      navigate("/admin/add-bot");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Company creation failed");
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

  if (isCheckingCompany) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <SplitScreenShell
          marketing={
        <MarketingPanel
          step={{ current: 1, total: 2 }}
          showBrand
          title="Create your"
          titleAccent="company workspace"
          description="Your company is the top-level tenant. Bots, documents, analytics, and widget keys all live under this workspace."
          highlights={[
            {
              icon: Building2,
              title: "One company per admin",
              description: "Your account manages a single isolated company workspace.",
            },
            {
              icon: Bot,
              title: "Ready for your first bot",
              description: "Next you'll create and configure your company chatbot.",
            },
            {
              icon: FileText,
              title: "Knowledge base ownership",
              description: "All documents and embeddings are scoped to your company.",
            },
          ]}
        />
      }
      topBar={<AppTopBar onLogout={handleLogout} isLoggingOut={isLoggingOut} className="mb-0" />}
    >
      <FormPanel>
        <PageHeader
          icon={Building2}
          title="Add your company"
          description="Name your organization to unlock bot creation and document uploads."
        />

        <InfoBanner icon={Building2} variant="success" className="mb-8">
          This company will own your bot, documents, and chatbot data. You can create one bot per company.
        </InfoBanner>

        <div className="space-y-6">
          <FormField label="Company name" hint="This name appears in your admin dashboard and bot widget.">
            <Input
              placeholder="e.g., ACME ONE"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base"
            />
          </FormField>

          <Button
            variant="premium"
            size="lg"
            className="w-full sm:w-auto sm:min-w-[260px]"
            onClick={handleCreateCompany}
            disabled={isSubmitting || !name.trim()}
          >
            <Sparkles className="h-4 w-4" />
            {isSubmitting ? "Creating..." : "Create company & continue"}
          </Button>
        </div>
      </FormPanel>
    </SplitScreenShell>
  );
};

export default AddCompanyPage;
