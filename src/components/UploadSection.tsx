import { useState } from "react";
import { Upload, FileText, Type, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface UploadSectionProps {
  onUploadText: (text: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
}

const UploadSection = ({ onUploadText, onUploadFile }: UploadSectionProps) => {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (mode === "text") {
      if (!text.trim()) { toast.error("Please enter some text"); return; }
      try {
        setIsSubmitting(true);
        await onUploadText(text);
        setText("");
        toast.success("Text uploaded & processed!");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to upload text";
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!selectedFile) { toast.error("Please select a file"); return; }
      try {
        setIsSubmitting(true);
        await onUploadFile(selectedFile);
        setSelectedFile(null);
        toast.success("File uploaded & processed!");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to upload file";
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
      className="relative overflow-hidden rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]"
    >
      {/* Decorative corner gradient */}
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br from-mint/10 to-transparent blur-2xl pointer-events-none" />

      <div className="relative">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-navy-light">
            <Upload className="h-4 w-4 text-primary-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">Upload Knowledge</h3>
        </div>
        <p className="mb-5 max-w-lg border-l-2 border-navy/25 pl-3.5 text-[13px] leading-snug text-muted-foreground">
          Paste or upload-content is embedded and listed in{" "}
          <span className="font-medium text-foreground">Knowledge Base</span> for the bot.
        </p>

        {/* Toggle */}
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1 mb-5 backdrop-blur-sm">
          {[
            { id: "text" as const, label: "Paste Text", icon: Type },
            { id: "file" as const, label: "Upload File", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-300 ${
                mode === tab.id
                  ? "text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === tab.id && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-0 rounded-lg bg-card shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {mode === "text" ? (
            <motion.div key="text" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }}>
              <Textarea
                placeholder="Paste your text content here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[140px] resize-none rounded-xl border-border bg-background/50 focus:ring-2 focus:ring-mint/20 focus:border-mint/50 transition-all text-sm"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {text.length > 0 && (
                  <span className="text-mint-glow font-medium">{text.length.toLocaleString()}</span>
                )}
                {text.length === 0 ? "0" : ""} characters
              </p>
            </motion.div>
          ) : (
            <motion.div key="file" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all duration-300 cursor-pointer overflow-hidden ${
                  dragOver
                    ? "border-mint bg-mint/5 scale-[1.01]"
                    : "border-border bg-background/30 hover:border-mint/40 hover:bg-mint/[0.02]"
                }`}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                {dragOver && (
                  <div className="absolute inset-0 animate-shimmer pointer-events-none" />
                )}
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-all duration-300 ${
                  dragOver ? "bg-mint/15 scale-110" : "bg-muted/60"
                }`}>
                  <Upload className={`h-6 w-6 transition-colors duration-300 ${dragOver ? "text-mint-glow" : "text-muted-foreground"}`} />
                </div>
                <p className="text-sm font-medium text-foreground">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1.5">Supports .txt files only</p>
                <input id="file-input" type="file" className="hidden" accept=".txt" onChange={handleFileSelect} />
              </div>
              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center gap-3 rounded-xl bg-mint/5 border border-mint/20 px-4 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint/10">
                    <FileText className="h-4 w-4 text-mint-glow" />
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1 truncate">{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10">
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="mt-5 w-full h-11 bg-gradient-to-r from-navy-deep via-navy to-navy-light text-primary-foreground hover:shadow-[var(--shadow-glow-navy)] transition-all duration-500 font-medium rounded-xl animate-gradient group"
        >
          <Sparkles className="mr-2 h-4 w-4 group-hover:animate-spin transition-transform" />
          {isSubmitting ? "Processing..." : "Upload & Process"}
        </Button>
      </div>
    </motion.div>
  );
};

export default UploadSection;
