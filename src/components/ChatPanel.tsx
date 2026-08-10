import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Bot, User, Sparkles, MessageSquare, Copy, Check, Trash2, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BackButton } from "@/components/layout/BackButton";
import { sendAdminChatMessage } from "@/lib/api";
import { getStoredSession } from "@/lib/api";
import { normalizeAssistantMarkdown } from "@/lib/normalizeAssistantMarkdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const DEFAULT_WELCOME_CONTENT =
  "Hello! I'm your **ACME ONE** chatbot. 👋\n\nUpload documents, then ask me anything. I answer using **RAG** over your embedded chunks.";

function createWelcomeMessage(content: string): Message {
  return {
    id: "welcome",
    role: "assistant",
    content,
    timestamp: new Date(),
  };
}

const MAX_STORED_CHAT_TURNS = 10;
const MAX_STORED_MESSAGES = MAX_STORED_CHAT_TURNS * 2;

function chatStorageKeyForBot(botId: number): string {
  const session = getStoredSession();
  const companyId = session?.admin?.company_id ?? "no_company";
  return `acme_one_chat_messages_v1_company_${companyId}_bot_${botId}`;
}

function toStoredMessage(m: Message): StoredMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
  };
}

function fromStoredMessage(m: StoredMessage): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
  };
}

function clampConversation(messages: Message[], welcomeMessage: Message): Message[] {
  const withoutWelcome = messages.filter((m) => m.id !== "welcome");
  const trimmed = withoutWelcome.slice(-MAX_STORED_MESSAGES);
  return [welcomeMessage, ...trimmed];
}

interface ChatPanelProps {
  onBack?: () => void;
  botId: number;
  welcomeMessage?: string;
  companyId?: number;
}

const ChatPanel = ({ onBack, botId, welcomeMessage: welcomeMessageProp, companyId }: ChatPanelProps) => {
  const storageKey = chatStorageKeyForBot(botId);
  const welcomeContent = (welcomeMessageProp || "").trim() || DEFAULT_WELCOME_CONTENT;
  const welcomeMessage = useMemo(() => createWelcomeMessage(welcomeContent), [welcomeContent]);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [welcomeMessage];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [welcomeMessage];
      const parsed = JSON.parse(raw) as StoredMessage[];
      if (!Array.isArray(parsed)) return [welcomeMessage];
      const restored = parsed
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map(fromStoredMessage);
      return clampConversation([welcomeMessage, ...restored], welcomeMessage);
    } catch {
      return [welcomeMessage];
    }
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasConversation = messages.some((m) => m.id !== "welcome");
  const visibleMessages = hasConversation ? messages : messages.filter((m) => m.id !== "welcome");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const withoutWelcome = messages.filter((m) => m.id !== "welcome");
    if (withoutWelcome.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    const trimmed = withoutWelcome.slice(-MAX_STORED_MESSAGES).map(toStoredMessage);
    window.localStorage.setItem(storageKey, JSON.stringify(trimmed));
  }, [messages, storageKey]);

  useEffect(() => {
    setMessages((prev) => clampConversation(prev, welcomeMessage));
  }, [welcomeMessage]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => clampConversation([...prev, userMsg], welcomeMessage));
    setInput("");
    setIsTyping(true);

    try {
      const answer = await sendAdminChatMessage({ botId, message: msg, history: [], companyId });
      setIsTyping(false);
      setMessages((prev) =>
        clampConversation([
          ...prev,
          { id: (Date.now() + 1).toString(), role: "assistant", content: answer, timestamp: new Date() },
        ], welcomeMessage)
      );
    } catch (error) {
      setIsTyping(false);
      const message = error instanceof Error ? error.message : "Failed to send message";
      toast.error(message);
    }
  }, [botId, companyId, input, welcomeMessage]);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleClear = useCallback(() => {
    setMessages([welcomeMessage]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    toast.success("Chat cleared");
  }, [storageKey, welcomeMessage]);

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      // Remove last assistant message and retry
      setMessages((prev) => {
        let idx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === "assistant" && prev[i].id !== "welcome") { idx = i; break; }
        }
        return idx > -1 ? prev.slice(0, idx) : prev;
      });
      handleSend(lastUserMsg.content);
    }
  }, [messages, handleSend]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5, type: "spring", stiffness: 100 }}
      className="flex h-[min(78vh,600px)] min-h-[460px] flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-elevated)] sm:min-h-[520px]"
    >
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border px-3 py-3 sm:px-5 sm:py-4">
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy to-navy-light animate-gradient" />
        <div className="absolute inset-0 noise-overlay" />

        <div className="relative flex items-center gap-2.5 sm:gap-3">
          {onBack && (
            <BackButton onClick={onBack} label="Back" variant="inverted" size="sm" iconOnly />
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint/20 backdrop-blur-sm border border-mint/20">
            <Sparkles className="h-5 w-5 text-mint" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-display font-bold tracking-wide text-primary-foreground">ACME ONE Chat</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
              <p className="hidden text-xs text-primary-foreground/65 sm:block">Answers from your knowledge base</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 1 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClear}
                title="Clear chat"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/10 backdrop-blur-sm hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 text-primary-foreground/70" />
              </motion.button>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/10 backdrop-blur-sm">
              <MessageSquare className="h-4 w-4 text-primary-foreground/60" />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5">
        {!hasConversation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-4 w-full max-w-2xl rounded-2xl border border-border bg-muted/40 p-5 shadow-sm"
          >
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {normalizeAssistantMarkdown(welcomeMessage.content)}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}
        <AnimatePresence>
          {visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className={`group flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-navy to-navy-light"
                    : "bg-gradient-to-br from-mint to-mint-glow"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <User className="h-4 w-4 text-primary-foreground" />
                )}
              </motion.div>
              <div className="relative max-w-[84%] sm:max-w-[78%]">
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === "assistant"
                    ? "bg-muted/60 text-foreground rounded-tl-md backdrop-blur-sm"
                    : "bg-gradient-to-r from-navy to-navy-light text-primary-foreground rounded-tr-md"
                }`}>
                  {msg.role === "assistant" ? (
                    <div
                      className={cn(
                        "prose prose-sm max-w-none break-words",
                        "prose-p:my-2 prose-p:leading-relaxed first:prose-p:mt-0 last:prose-p:mb-0",
                        "prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground",
                        "prose-h2:text-base prose-h2:mt-3 prose-h2:mb-2 prose-h3:text-sm",
                        "prose-strong:text-foreground prose-strong:font-semibold",
                        "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
                        "prose-li:marker:text-mint",
                        "prose-blockquote:border-l-mint/50 prose-blockquote:text-muted-foreground",
                        "prose-code:text-foreground prose-code:bg-muted/80 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none",
                        "prose-pre:bg-muted/80 prose-pre:border prose-pre:border-border/60",
                        "prose-hr:border-border",
                        "prose-a:text-mint prose-a:font-medium prose-a:no-underline hover:prose-a:underline"
                      )}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {normalizeAssistantMarkdown(msg.content)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-1.5 ${
                    msg.role === "assistant" ? "text-muted-foreground/60" : "text-primary-foreground/40"
                  }`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {/* Action buttons on hover */}
                {msg.id !== "welcome" && (
                  <div className={`absolute -bottom-3 ${msg.role === "user" ? "right-2" : "left-2"} flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100`}>
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-card border border-border shadow-sm hover:bg-muted transition-colors"
                      title="Copy"
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3 text-mint" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-navy-light shadow-sm">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted/60 px-5 py-3.5 backdrop-blur-sm">
              <span className="typing-dot h-2 w-2 rounded-full bg-mint" />
              <span className="typing-dot h-2 w-2 rounded-full bg-mint" />
              <span className="typing-dot h-2 w-2 rounded-full bg-mint" />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/80 px-3 py-3 backdrop-blur-sm sm:px-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-1.5 backdrop-blur-sm transition-all duration-300 focus-within:border-mint/40 focus-within:ring-2 focus-within:ring-mint/20">
          <input
            ref={inputRef}
            id="chat-message-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !isTyping && handleSend()}
            placeholder="Ask anything about your documents..."
            disabled={isTyping}
            className="flex-1 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          {messages.length > 2 && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.1, rotate: -30 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRetry}
              title="Retry last question"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-mint hover:bg-mint/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </motion.button>
          )}
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-navy to-navy-light text-primary-foreground shadow-sm transition-all duration-300 hover:shadow-[var(--shadow-glow-navy)] disabled:opacity-30"
          >
            <Send className="h-4 w-4" aria-hidden />
          </motion.button>
        </div>
        <p className="mt-2 hidden text-center text-[10px] text-muted-foreground/50 sm:block">
          Press <kbd className="rounded border border-border/40 bg-muted/30 px-1 py-0.5 font-mono text-[9px]">Enter</kbd> to send
        </p>
      </div>
    </motion.div>
  );
};

export default ChatPanel;
