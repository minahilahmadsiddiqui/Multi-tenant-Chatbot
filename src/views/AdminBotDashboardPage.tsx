import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bot, Check, CircleHelp, Code2, Copy, Eye, EyeOff, FileText, LayoutDashboard, Loader2, RefreshCw, Save, Upload, Layers, Hash, Database } from "lucide-react";
import DocumentList, { type DocumentItem } from "@/components/DocumentList";
import ChatPanel from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  deleteDocument,
  fetchBotWorkspace,
  fetchProviderModels,
  fetchPublicWidgetConfig,
  generateWidgetScript,
  invalidateBotWorkspaceCache,
  logoutAdmin,
  peekBotWorkspaceCache,
  type BotItem,
  updateBot,
  uploadFileDocument,
  uploadTextDocument,
} from "@/lib/api";
import { toast } from "sonner";
import { FullWidthShell } from "@/components/layout/FullWidthShell";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { StatCard } from "@/components/layout/StatCard";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { WorkflowStepHeader } from "@/components/layout/WorkflowStepHeader";
import { FormField } from "@/components/layout/FormField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CHAT_PROVIDERS,
  normalizeChatModel,
  providerApiKeyLabel,
  providerApiKeyPlaceholder,
  isChatProvider,
  type ChatModelOption,
  type ChatProvider,
} from "@/lib/modelCatalog";
import UploadSection from "@/components/UploadSection";

const deriveWelcomeMessageFromBot = (bot: BotItem | null): string => {
  if (!bot) return "";
  const botName = String(bot.name || "").trim() || "your assistant";
  const prompt = String(bot.system_prompt || "").trim();
  if (!prompt) {
    return `Hi! I'm ${botName}. Ask me anything related to your company's uploaded knowledge base.`;
  }

  let firstLine = "";
  for (const line of prompt.split("\n")) {
    const cleaned = line.trim();
    if (cleaned) {
      firstLine = cleaned;
      break;
    }
  }
  if (!firstLine) {
    return `Hi! I'm ${botName}. Ask me anything related to your company's uploaded knowledge base.`;
  }

  let preview = firstLine.length > 220 ? `${firstLine.slice(0, 220).trimEnd()}...` : firstLine;
  const lowered = preview.toLowerCase();
  if (lowered.startsWith("you are an ")) preview = preview.slice(11).trim();
  else if (lowered.startsWith("you are a ")) preview = preview.slice(10).trim();
  else if (lowered.startsWith("you are ")) preview = preview.slice(8).trim();
  if (preview.toLowerCase().startsWith("the ")) preview = preview.slice(4).trim();
  if (preview.toLowerCase().endsWith("for this company.")) preview = preview.slice(0, -17).trim();
  else if (preview.toLowerCase().endsWith("for this company")) preview = preview.slice(0, -16).trim();
  if (preview && !preview.endsWith(".")) preview = `${preview}.`;

  return `Hi! I'm ${botName}. I can help with ${preview}`;
};

const AdminBotDashboardPage = () => {
  const { botId: botIdParam } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const botId = Number(botIdParam);
  const companyId = Number(searchParams.get("company_id"));
  const scopedCompanyId = Number.isFinite(companyId) && companyId > 0 ? companyId : undefined;
  const initialWorkspace = Number.isFinite(botId) ? peekBotWorkspaceCache(botId, scopedCompanyId) : null;
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(!initialWorkspace);
  const [activeBot, setActiveBot] = useState<BotItem | null>(initialWorkspace?.bot ?? null);
  const [documents, setDocuments] = useState<DocumentItem[]>(initialWorkspace?.documents ?? []);
  const [workspaceStats, setWorkspaceStats] = useState({
    total_documents: initialWorkspace?.stats.total_documents ?? 0,
    total_chunks: initialWorkspace?.stats.total_chunks ?? 0,
    total_embeddings: initialWorkspace?.stats.total_embeddings ?? 0,
    total_tokens: initialWorkspace?.stats.total_tokens ?? 0,
  });
  const initialProvider: ChatProvider = isChatProvider(initialWorkspace?.bot?.chat_provider)
    ? initialWorkspace.bot.chat_provider
    : "openrouter";
  const [widgetScript, setWidgetScript] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(initialWorkspace?.bot?.system_prompt ?? "");
  const [draftChatProvider, setDraftChatProvider] = useState<ChatProvider>(initialProvider);
  const [draftChatModel, setDraftChatModel] = useState(
    normalizeChatModel(initialProvider, initialWorkspace?.bot?.chat_model)
  );
  const [draftChatApiKey, setDraftChatApiKey] = useState(initialWorkspace?.bot?.chat_api_key ?? "");
  const [chatModelOptions, setChatModelOptions] = useState<ChatModelOption[]>(() => {
    const savedModel = String(initialWorkspace?.bot?.chat_model || "").trim();
    return savedModel ? [{ id: savedModel, label: savedModel }] : [];
  });
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isChatKeyCopied, setIsChatKeyCopied] = useState(false);
  const [showChatApiKey, setShowChatApiKey] = useState(false);
  const [isScriptCopied, setIsScriptCopied] = useState(false);
  const [testingWelcomeMessage, setTestingWelcomeMessage] = useState(
    initialWorkspace?.bot ? deriveWelcomeMessageFromBot(initialWorkspace.bot) : ""
  );
  const [openSteps, setOpenSteps] = useState<string[]>(["step-1", "step-2"]);

  const loadProviderModels = useCallback(
    async (provider: ChatProvider, apiKey: string, preferModel?: string) => {
      const key = apiKey.trim();
      if (!key) {
        toast.error(`Enter your ${providerApiKeyLabel(provider)} first.`);
        return;
      }
      setIsLoadingModels(true);
      try {
        const models = await fetchProviderModels(provider, key);
        setChatModelOptions(models);
        setModelsLoaded(models.length > 0);
        const preferred = String(preferModel || "").trim();
        if (preferred && models.some((item) => item.id === preferred)) {
          setDraftChatModel(preferred);
        } else if (models.length > 0) {
          setDraftChatModel(models[0].id);
        } else {
          setDraftChatModel("");
          toast.error("No chat models were returned for this API key.");
        }
      } catch (error) {
        setChatModelOptions([]);
        setModelsLoaded(false);
        toast.error(error instanceof Error ? error.message : "Failed to load models");
      } finally {
        setIsLoadingModels(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!Number.isFinite(botId)) return;
    let cancelled = false;

    const load = async () => {
      if (!initialWorkspace) {
        setIsLoadingWorkspace(true);
        setTestingWelcomeMessage("");
      }
      try {
        const workspace = await fetchBotWorkspace(botId, scopedCompanyId);
        if (cancelled) return;
        setActiveBot(workspace.bot);
        setDocuments(workspace.documents);
        setWorkspaceStats(workspace.stats);
        setDraftPrompt(workspace.bot?.system_prompt ?? "");
        const provider = isChatProvider(workspace.bot?.chat_provider) ? workspace.bot.chat_provider : "openrouter";
        setDraftChatProvider(provider);
        setDraftChatModel(normalizeChatModel(provider, workspace.bot?.chat_model));
        const chatKey = String(workspace.bot?.chat_api_key || "").trim();
        setDraftChatApiKey(workspace.bot?.chat_api_key ?? "");
        setTestingWelcomeMessage(deriveWelcomeMessageFromBot(workspace.bot));
        if (chatKey) {
          void loadProviderModels(provider, chatKey, workspace.bot?.chat_model);
        } else {
          const savedModel = String(workspace.bot?.chat_model || "").trim();
          setChatModelOptions(savedModel ? [{ id: savedModel, label: savedModel }] : []);
          setModelsLoaded(false);
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load workspace");
      } finally {
        if (!cancelled) setIsLoadingWorkspace(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [botId, scopedCompanyId, loadProviderModels]);

  const stats = useMemo(() => {
    return {
      totalDocuments: workspaceStats.total_documents,
      totalTokens: workspaceStats.total_tokens,
      totalChunks: workspaceStats.total_chunks,
      totalEmbeddings: workspaceStats.total_embeddings,
    };
  }, [workspaceStats]);

  const hasSavedSystemPrompt = Boolean(String(activeBot?.system_prompt || "").trim());
  const hasSavedChatProvider = isChatProvider(activeBot?.chat_provider);
  const hasSavedChatModel = Boolean(String(activeBot?.chat_model || "").trim());
  const hasSavedChatApiKey = Boolean(String(activeBot?.chat_api_key || "").trim());
  const hasIndexedDocuments = documents.length > 0;
  const canGenerateWidgetScript =
    hasSavedSystemPrompt &&
    hasSavedChatProvider &&
    hasSavedChatModel &&
    hasSavedChatApiKey &&
    hasIndexedDocuments;

  useEffect(() => {
    if (!openSteps.includes("step-5")) return;
    const widgetKey = String(activeBot?.widget_key || "").trim();
    if (!widgetKey) return;

    let cancelled = false;
    const loadWelcomeMessage = async () => {
      try {
        const config = await fetchPublicWidgetConfig(widgetKey);
        if (cancelled) return;
        const dynamicMessage = String(config?.welcome_message || "").trim();
        if (dynamicMessage) setTestingWelcomeMessage(dynamicMessage);
      } catch {
        // keep locally derived message
      }
    };
    void loadWelcomeMessage();
    return () => {
      cancelled = true;
    };
  }, [openSteps, activeBot?.widget_key]);

  const isTestingWelcomeReady = Boolean(testingWelcomeMessage.trim()) || Boolean(activeBot);

  const handleUploadText = async (text: string) => {
    const newDoc = await uploadTextDocument(text, botId, scopedCompanyId);
    invalidateBotWorkspaceCache(botId, scopedCompanyId);
    setDocuments((prev) => [newDoc, ...prev]);
    setWorkspaceStats((prev) => ({
      ...prev,
      total_documents: prev.total_documents + 1,
      total_tokens: prev.total_tokens + (newDoc.token_count || 0),
      total_chunks: prev.total_chunks + (newDoc.chunk_count || 0),
      total_embeddings: prev.total_embeddings + (newDoc.embedding_count || 0),
    }));
  };

  const handleUploadFile = async (file: File) => {
    const newDoc = await uploadFileDocument(file, botId, scopedCompanyId);
    invalidateBotWorkspaceCache(botId, scopedCompanyId);
    setDocuments((prev) => [newDoc, ...prev]);
    setWorkspaceStats((prev) => ({
      ...prev,
      total_documents: prev.total_documents + 1,
      total_tokens: prev.total_tokens + (newDoc.token_count || 0),
      total_chunks: prev.total_chunks + (newDoc.chunk_count || 0),
      total_embeddings: prev.total_embeddings + (newDoc.embedding_count || 0),
    }));
  };

  const handleDelete = async (id: string) => {
    try {
      const removed = documents.find((d) => d.id === id);
      await deleteDocument(id, botId, scopedCompanyId);
      invalidateBotWorkspaceCache(botId, scopedCompanyId);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (removed) {
        setWorkspaceStats((prev) => ({
          ...prev,
          total_documents: Math.max(0, prev.total_documents - 1),
          total_tokens: Math.max(0, prev.total_tokens - (removed.token_count || 0)),
          total_chunks: Math.max(0, prev.total_chunks - (removed.chunk_count || 0)),
          total_embeddings: Math.max(0, prev.total_embeddings - (removed.embedding_count || 0)),
        }));
      }
      toast.success("Document deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete document.");
    }
  };

  const handleSavePrompt = async () => {
    if (!activeBot) return;
    if (!draftChatModel.trim()) {
      toast.error("Load models and select a chat model before saving.");
      return;
    }
    if (!draftChatApiKey.trim()) {
      toast.error(`Enter your ${providerApiKeyLabel(draftChatProvider)} before saving.`);
      return;
    }
    setIsSavingPrompt(true);
    try {
      const data = await updateBot(activeBot.id, {
        system_prompt: draftPrompt,
        chat_provider: draftChatProvider,
        chat_model: draftChatModel,
        chat_api_key: draftChatApiKey,
        ...(scopedCompanyId != null ? { company_id: scopedCompanyId } : {}),
      });
      setActiveBot(data.bot);
      setTestingWelcomeMessage(deriveWelcomeMessageFromBot(data.bot));
      invalidateBotWorkspaceCache(botId, scopedCompanyId);
      toast.success("Bot configuration saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save prompt");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!canGenerateWidgetScript) {
      const missingSteps: string[] = [];
      if (!hasSavedSystemPrompt) missingSteps.push("save a system prompt");
      if (!hasSavedChatModel) missingSteps.push("load models and save a chat model");
      if (!hasSavedChatApiKey) missingSteps.push(`save a ${providerApiKeyLabel(draftChatProvider).toLowerCase()}`);
      if (!hasIndexedDocuments) missingSteps.push("upload and index at least one document");
      toast.error(`Complete previous steps first: ${missingSteps.join(", ")}.`);
      return;
    }
    setIsGeneratingScript(true);
    try {
      const data = await generateWidgetScript(botId, scopedCompanyId);
      setWidgetScript(data.widget_script || "");
      toast.success("Widget script generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate script");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutAdmin();
    toast.success("Logged out.");
    navigate("/welcome", { replace: true });
  };

  const handleCopyChatApiKey = async () => {
    const key = draftChatApiKey.trim();
    if (!key) {
      toast.error(`${providerApiKeyLabel(draftChatProvider)} is empty.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(key);
      setIsChatKeyCopied(true);
      toast.success(`${providerApiKeyLabel(draftChatProvider)} copied.`);
      window.setTimeout(() => setIsChatKeyCopied(false), 1500);
    } catch {
      toast.error("Failed to copy API key.");
    }
  };

  const handleProviderChange = (value: string) => {
    if (!isChatProvider(value)) return;
    const savedProvider = isChatProvider(activeBot?.chat_provider) ? activeBot.chat_provider : null;
    const isReturningToSavedProvider = savedProvider === value;

    setDraftChatProvider(value);
    setShowChatApiKey(false);
    setDraftChatApiKey(isReturningToSavedProvider ? (activeBot?.chat_api_key ?? "") : "");
    setDraftChatModel(
      isReturningToSavedProvider ? normalizeChatModel(value, activeBot?.chat_model) : ""
    );
    setChatModelOptions(
      isReturningToSavedProvider && activeBot?.chat_model
        ? [{ id: String(activeBot.chat_model), label: String(activeBot.chat_model) }]
        : []
    );
    setModelsLoaded(false);
  };

  const handleLoadModels = () => {
    void loadProviderModels(draftChatProvider, draftChatApiKey, draftChatModel);
  };

  const handleCopyWidgetScript = async () => {
    const script = widgetScript.trim();
    if (!script) {
      toast.error("Widget script is empty.");
      return;
    }
    try {
      await navigator.clipboard.writeText(script);
      setIsScriptCopied(true);
      toast.success("Widget script copied.");
      window.setTimeout(() => setIsScriptCopied(false), 1500);
    } catch {
      toast.error("Failed to copy widget script.");
    }
  };

  if (!Number.isFinite(botId)) {
    return <div className="p-6">Invalid bot id.</div>;
  }

  return (
    <FullWidthShell theme="light" contentClassName="space-y-6">
      <TooltipProvider>
        <div className="flex justify-end">
          <AppTopBar onLogout={handleLogout} isLoggingOut={isLoggingOut} className="mb-0 w-auto" />
        </div>

        <DashboardHeader
          className="w-full rounded-2xl lg:rounded-3xl"
          eyebrow="Bot Dashboard"
          title={activeBot?.name || "Bot Workspace"}
          description="Configure prompts, upload knowledge, generate your widget, and test the bot experience."
          loading={isLoadingWorkspace}
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Documents" value={stats.totalDocuments} icon={FileText} loading={isLoadingWorkspace} />
          <StatCard label="Chunks" value={stats.totalChunks} icon={Layers} loading={isLoadingWorkspace} />
          <StatCard label="Embeddings" value={stats.totalEmbeddings} icon={Database} loading={isLoadingWorkspace} />
          <StatCard label="Tokens" value={stats.totalTokens.toLocaleString()} icon={Hash} loading={isLoadingWorkspace} />
        </div>

        <Accordion type="multiple" value={openSteps} onValueChange={setOpenSteps} className="space-y-4">
          <AccordionItem value="step-1" className="overflow-hidden rounded-2xl border border-border/60 border-l-4 border-l-navy/30 bg-card shadow-[var(--shadow-card)] data-[state=open]:border-l-mint">
            <AccordionTrigger className="px-5 py-5 hover:no-underline sm:px-6">
              <div className="flex flex-1 items-center gap-2">
                <WorkflowStepHeader step={1} icon={LayoutDashboard} title="Model & Prompt" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Step 1 help">
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Configure the system prompt, chat provider, model, and API key.
                  </TooltipContent>
                </Tooltip>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border/40 px-5 pb-6 pt-5 sm:px-6">
              <div className="space-y-6">
                <FormField label="System prompt">
                  {isLoadingWorkspace ? (
                    <Skeleton className="min-h-[160px] w-full rounded-md" />
                  ) : (
                    <Textarea
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                      placeholder="Define bot behavior, tone, and constraints..."
                      className="min-h-[160px]"
                    />
                  )}
                </FormField>

                <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chat model</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Chat model help">
                          <CircleHelp className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>The results can vary depending on your selected chat model.</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 md:items-end">
                    <FormField label="Provider">
                      {isLoadingWorkspace ? (
                        <Skeleton className="h-11 w-full rounded-xl" />
                      ) : (
                        <Select value={draftChatProvider} onValueChange={handleProviderChange}>
                          <SelectTrigger className="h-11 rounded-xl px-4 text-left [&>span]:flex-1 [&>span]:text-left">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {CHAT_PROVIDERS.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id}>
                                {provider.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>

                    <FormField label={providerApiKeyLabel(draftChatProvider)}>
                      <div className="relative">
                        {isLoadingWorkspace ? (
                          <Skeleton className="h-11 w-full rounded-xl" />
                        ) : (
                          <Input
                            value={draftChatApiKey}
                            onChange={(e) => {
                              setDraftChatApiKey(e.target.value);
                              setModelsLoaded(false);
                            }}
                            placeholder={providerApiKeyPlaceholder(draftChatProvider)}
                            type={showChatApiKey ? "text" : "password"}
                            className="h-11 pr-20"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setShowChatApiKey((prev) => !prev)}
                          aria-label={showChatApiKey ? "Hide API key" : "Show API key"}
                          title={showChatApiKey ? "Hide API key" : "Show API key"}
                          className="absolute right-10 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          disabled={isLoadingWorkspace}
                        >
                          {showChatApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyChatApiKey}
                          aria-label={`Copy ${providerApiKeyLabel(draftChatProvider)}`}
                          title={`Copy ${providerApiKeyLabel(draftChatProvider)}`}
                          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          disabled={isLoadingWorkspace}
                        >
                          {isChatKeyCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormField>
                  </div>
                  <p className="text-xs text-muted-foreground/80">
                    Required for {CHAT_PROVIDERS.find((item) => item.id === draftChatProvider)?.label || "selected provider"} chat responses.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleLoadModels}
                      disabled={isLoadingWorkspace || isLoadingModels || !draftChatApiKey.trim()}
                    >
                      {isLoadingModels ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {isLoadingModels ? "Loading models..." : "Load models"}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {modelsLoaded
                        ? `${chatModelOptions.length} model${chatModelOptions.length === 1 ? "" : "s"} available for your API key.`
                        : "Load models from your provider using the API key above."}
                    </p>
                  </div>

                  <FormField label="Model">
                    {isLoadingWorkspace || isLoadingModels ? (
                      <Skeleton className="h-11 w-full rounded-xl" />
                    ) : (
                      <Select
                        value={draftChatModel}
                        onValueChange={setDraftChatModel}
                        disabled={!modelsLoaded || chatModelOptions.length === 0}
                      >
                        <SelectTrigger className="h-11 rounded-xl px-4 text-left [&>span]:flex-1 [&>span]:text-left">
                          <SelectValue placeholder={modelsLoaded ? "Select model" : "Load models first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {chatModelOptions.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                </div>

                <div className="flex justify-end">
                  <Button variant="premium" onClick={handleSavePrompt} disabled={isSavingPrompt || isLoadingWorkspace}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingPrompt ? "Saving..." : "Save configuration"}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="step-2" className="overflow-hidden rounded-2xl border border-border/60 border-l-4 border-l-navy/30 bg-card shadow-[var(--shadow-card)] data-[state=open]:border-l-mint">
            <AccordionTrigger className="px-5 py-5 hover:no-underline sm:px-6">
              <div className="flex flex-1 items-center gap-2">
                <WorkflowStepHeader step={2} icon={Upload} title="Upload Knowledge" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Step 2 help">
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Upload text/files to index knowledge for this bot.</TooltipContent>
                </Tooltip>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border/40 px-5 pb-6 pt-5 sm:px-6">
              <UploadSection onUploadText={handleUploadText} onUploadFile={handleUploadFile} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="step-3" className="overflow-hidden rounded-2xl border border-border/60 border-l-4 border-l-navy/30 bg-card shadow-[var(--shadow-card)] data-[state=open]:border-l-mint">
            <AccordionTrigger className="px-5 py-5 hover:no-underline sm:px-6">
              <div className="flex flex-1 items-center gap-2">
                <WorkflowStepHeader step={3} icon={FileText} title="Indexed Documents" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Step 3 help">
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Review and manage the documents already indexed.</TooltipContent>
                </Tooltip>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border/40 px-5 pb-6 pt-5 sm:px-6">
              <DocumentList documents={documents} onDelete={handleDelete} isLoading={isLoadingWorkspace} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="step-4" className="overflow-hidden rounded-2xl border border-border/60 border-l-4 border-l-navy/30 bg-card shadow-[var(--shadow-card)] data-[state=open]:border-l-mint">
            <AccordionTrigger className="px-5 py-5 hover:no-underline sm:px-6">
              <div className="flex flex-1 items-center gap-2">
                <WorkflowStepHeader step={4} icon={Code2} title="Generate Widget Script" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Step 4 help">
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Generate widget script after steps 1-3 are complete.</TooltipContent>
                </Tooltip>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border/40 px-5 pb-6 pt-5 sm:px-6">
              <Button variant="premium" onClick={handleGenerateScript} disabled={isGeneratingScript || !canGenerateWidgetScript}>
                {isGeneratingScript ? "Generating..." : "Generate script"}
              </Button>
              {!canGenerateWidgetScript && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Complete Step 1 (saved prompt + key) and Step 2/3 (at least one indexed doc) first.
                </p>
              )}
              <div className="relative mt-3">
                <Input
                  value={widgetScript}
                  readOnly
                  placeholder="Generated widget script will appear here"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={handleCopyWidgetScript}
                  aria-label="Copy widget script"
                  title="Copy widget script"
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {isScriptCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="step-5" className="overflow-hidden rounded-2xl border border-border/60 border-l-4 border-l-navy/30 bg-card shadow-[var(--shadow-card)] data-[state=open]:border-l-mint">
            <AccordionTrigger className="px-5 py-5 hover:no-underline sm:px-6">
              <div className="flex flex-1 items-center gap-2">
                <WorkflowStepHeader step={5} icon={Bot} title="Testing Bot" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Step 5 help">
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Test responses with the live configured prompt and documents.</TooltipContent>
                </Tooltip>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t border-border/40 px-5 pb-6 pt-5 sm:px-6">
              {isTestingWelcomeReady ? (
                <ChatPanel botId={botId} companyId={scopedCompanyId} welcomeMessage={testingWelcomeMessage} />
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Loading exact preview message...
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </TooltipProvider>
    </FullWidthShell>
  );
};

export default AdminBotDashboardPage;
