import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Bot, FileText, MessageSquare, Percent, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchSuperAdminCompanies, logoutAdmin, peekSuperAdminCompaniesCache, type SuperAdminCompanyRow, type SuperAdminOverview } from "@/lib/api";
import { toast } from "sonner";
import { FullWidthShell } from "@/components/layout/FullWidthShell";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { GlassCard } from "@/components/layout/GlassCard";
import { StatCard } from "@/components/layout/StatCard";

const SuperAdminPage = () => {
  const navigate = useNavigate();
  const initialCache = peekSuperAdminCompaniesCache();
  const [overview, setOverview] = useState<SuperAdminOverview | null>(
    initialCache?.totals ? { totals: initialCache.totals } : null
  );
  const [companies, setCompanies] = useState<SuperAdminCompanyRow[]>(initialCache?.companies ?? []);
  const [loading, setLoading] = useState(!initialCache);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!initialCache) setLoading(true);
      try {
        const data = await fetchSuperAdminCompanies();
        if (cancelled) return;
        setCompanies(data.companies || []);
        if (data.totals) {
          setOverview({ totals: data.totals });
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutAdmin();
    toast.success("Logged out.");
    navigate("/welcome", { replace: true });
  };

  const stats = [
    { label: "Companies", value: overview?.totals.companies ?? 0, icon: Building2 },
    { label: "Admins", value: overview?.totals.admins ?? 0, icon: Users },
    { label: "Bots", value: overview?.totals.bots ?? 0, icon: Bot },
    { label: "Documents", value: overview?.totals.documents ?? 0, icon: FileText },
    { label: "Queries", value: overview?.totals.chat_queries ?? 0, icon: MessageSquare },
    {
      label: "Fallback rate",
      value: `${((overview?.totals.fallback_rate ?? 0) * 100).toFixed(1)}%`,
      icon: Percent,
    },
  ] as const;

  return (
    <FullWidthShell
      theme="dark"
      topBar={<AppTopBar onLogout={handleLogout} isLoggingOut={isLoggingOut} dark className="mb-0 justify-end" />}
      contentClassName="space-y-8"
    >
      <header className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[hsl(226,55%,12%)] via-[hsl(224,34%,14%)] to-[hsl(245,32%,16%)] px-8 py-10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-64 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Platform control</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Super Admin Dashboard
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Platform-wide analytics, company performance visibility, and instant workspace access.
          </p>
        </div>
      </header>

      <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} loading={loading} dark />
        ))}
      </div>

      <GlassCard dark padding="lg" className="w-full">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">Companies</h2>
          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-slate-200">
            {loading ? "Loading..." : `${companies.length} total`}
          </span>
        </div>

        <div className="w-full overflow-x-auto rounded-xl border border-white/15">
          <table className="min-w-full w-full text-sm">
            <thead>
              <tr className="border-b border-white/15 bg-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-slate-300">
                <th className="py-4 pl-5 pr-4">Company</th>
                <th className="px-4 py-4">Bots</th>
                <th className="px-4 py-4">Documents</th>
                <th className="px-4 py-4">Queries</th>
                <th className="hidden px-4 py-4 lg:table-cell">Created</th>
                <th className="px-4 py-4 text-right" />
              </tr>
            </thead>
            <tbody>
              {!loading &&
                companies.map((row) => (
                  <tr
                    key={row.company_id}
                    className="border-b border-white/10 transition-colors last:border-b-0 hover:bg-white/10"
                  >
                    <td className="py-5 pl-5 pr-4 text-base font-semibold text-white">{row.name}</td>
                    <td className="px-4 py-5 font-medium text-slate-100">{row.bot_count}</td>
                    <td className="px-4 py-5 font-medium text-slate-100">{row.document_count}</td>
                    <td className="px-4 py-5 font-medium text-slate-100">{row.query_count}</td>
                    <td className="hidden px-4 py-5 text-slate-300 lg:table-cell">{row.created_at}</td>
                    <td className="px-4 py-5">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="hero"
                          onClick={() =>
                            navigate(`/admin/add-bot?company_id=${row.company_id}`, {
                              state: { companyName: row.name },
                            })
                          }
                        >
                          Open workspace
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-300">
                    Loading companies...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </FullWidthShell>
  );
};

export default SuperAdminPage;
