import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowStepHeaderProps {
  step: number;
  icon: LucideIcon;
  title: string;
  className?: string;
}

export function WorkflowStepHeader({ step, icon: Icon, title, className }: WorkflowStepHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 text-left", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-navy to-mint text-xs font-bold text-white shadow-sm">
        {step}
      </span>
      <Icon className="h-5 w-5 text-mint" />
      <h2 className="font-display text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
    </div>
  );
}
