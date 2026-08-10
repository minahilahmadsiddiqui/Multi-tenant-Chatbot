import { Trash2, FileText, Hash, Database, Coins, Calendar, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface DocumentItem {
  id: string;
  name: string;
  chunk_count: number;
  embedding_count: number;
  token_count: number;
  created_at: string;
  size: string;
}

interface DocumentListProps {
  documents: DocumentItem[];
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

const DocumentList = ({ documents, onDelete, isLoading = false }: DocumentListProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 100 }}
      className="relative overflow-hidden rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]"
    >
      {/* Decorative */}
      <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-gradient-to-tr from-navy/5 to-transparent blur-2xl pointer-events-none" />

      <div className="relative">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-mint to-mint-glow">
              <Database className="h-4 w-4 text-primary-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">Knowledge Base</h3>
          </div>
          <span className="text-xs font-semibold text-mint-glow bg-mint/10 px-3 py-1.5 rounded-full">
            {documents.length} docs
          </span>
        </div>
        <p className="mb-5 max-w-lg border-l-2 border-mint/40 pl-3.5 text-[13px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">Indexed uploads</span>-chunked, embedded, and
          searched by the assistant via{" "}
          <span className="font-medium text-foreground/90">RAG</span>.
        </p>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">Loading library…</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">Nothing indexed yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Add content in Upload Knowledge above.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
            <AnimatePresence>
              {documents.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16, height: 0, marginBottom: 0, padding: 0 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 120 }}
                  className="group relative overflow-hidden rounded-xl border border-border bg-background/50 p-4 hover:border-mint/30 hover:shadow-[var(--shadow-card)] transition-all duration-300"
                >
                  {/* Hover shimmer */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />

                  <div className="relative flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-navy-light shadow-sm">
                      <FileText className="h-5 w-5 text-primary-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{doc.name}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-2">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Hash className="h-3 w-3 shrink-0 text-navy/50" />{doc.chunk_count} chunks
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Database className="h-3 w-3 shrink-0 text-mint-glow/70" />{doc.embedding_count} embeddings
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Coins className="h-3 w-3 shrink-0 text-navy/50" />{doc.token_count.toLocaleString()} tokens
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0 text-mint-glow/70" />{doc.created_at}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <HardDrive className="h-3 w-3 shrink-0 text-navy/50" />{doc.size}
                        </span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onDelete(doc.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DocumentList;
